import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commentLikes, comments, pollVotes, postLikes, posts, reposts, savedPosts, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";
import { commentDTO, getPostById, serializePosts, touchHashtags } from "@/lib/posts";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const post = await getPostById(id);
    if (!post || post.deletedAt) throw new ApiError(404, "Post not found.");
    const [items] = await Promise.all([
      serializePosts([post.id], me.id),
      db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id)),
    ]);
    const item = items[0];
    if (!item) throw new ApiError(404, "Post not found.");

    const url = new URL(req.url);
    const wantComments = url.searchParams.get("comments") === "1";
    let commentItems: unknown[] = [];
    if (wantComments) {
      const rows = await db
        .select({
          id: comments.id, content: comments.content, createdAt: comments.createdAt,
          likeCount: comments.likeCount, authorId: comments.authorId,
          username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
          liked: commentLikes.userId, parentId: comments.parentId,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .leftJoin(commentLikes, and(eq(commentLikes.commentId, comments.id), eq(commentLikes.userId, me.id)))
        .where(and(eq(comments.postId, id), eq(comments.parentId, sql`NULL`)))
        .orderBy(desc(comments.createdAt))
        .limit(60);
      commentItems = rows.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        likeCount: r.likeCount,
        liked: !!r.liked,
        me: r.authorId === me.id,
        author: { username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
      }));
    }
    return ok({ post: item, comments: commentItems });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ type: z.string(), option: z.number().int().optional(), emoji: z.string().optional() }).safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid action.");
    const { type } = parsed.data;

    const post = await getPostById(id);
    if (!post || post.deletedAt) throw new ApiError(404, "Post not found.");

    switch (type) {
      case "like":
      case "unlike": {
        if (await blockedBetween(me.id, post.authorId)) throw new ApiError(403, "You can't interact with this account.");
        if (type === "like") {
          const [ins] = await db.insert(postLikes).values({ postId: id, userId: me.id }).onConflictDoNothing().returning();
          if (ins) {
            await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, id));
            await notify(post.authorId, me.id, "like", { postId: id });
          }
        } else {
          const [del] = await db.delete(postLikes).where(and(eq(postLikes.postId, id), eq(postLikes.userId, me.id))).returning();
          if (del) await db.update(posts).set({ likeCount: sql`GREATEST(0, ${posts.likeCount} - 1)` }).where(eq(posts.id, id));
        }
        return ok();
      }
      case "save":
      case "unsave": {
        if (type === "save") {
          await db.insert(savedPosts).values({ userId: me.id, postId: id }).onConflictDoNothing();
        } else {
          await db.delete(savedPosts).where(and(eq(savedPosts.postId, id), eq(savedPosts.userId, me.id)));
        }
        return ok();
      }
      case "repost":
      case "unrepost": {
        if (await blockedBetween(me.id, post.authorId)) throw new ApiError(403, "You can't interact with this account.");
        if (type === "repost") {
          const [ins] = await db.insert(reposts).values({ userId: me.id, postId: id }).onConflictDoNothing().returning();
          if (ins) {
            await db.update(posts).set({ repostCount: sql`${posts.repostCount} + 1` }).where(eq(posts.id, id));
            await notify(post.authorId, me.id, "repost", { postId: id });
          }
        } else {
          const [del] = await db.delete(reposts).where(and(eq(reposts.postId, id), eq(reposts.userId, me.id))).returning();
          if (del) await db.update(posts).set({ repostCount: sql`GREATEST(0, ${posts.repostCount} - 1)` }).where(eq(posts.id, id));
        }
        return ok();
      }
      case "vote": {
        if (!post.poll) throw new ApiError(400, "This post has no poll.");
        const opt = parsed.data.option;
        if (opt === undefined || opt < 0 || opt >= (post.poll as { options: string[] }).options.length) throw new ApiError(400, "Invalid option.");
        const [ins] = await db.insert(pollVotes).values({ postId: id, userId: me.id, option: opt }).onConflictDoNothing().returning();
        if (ins) {
          const polls = post.poll as { options: string[]; votes: number[] };
          const votes = [...polls.votes];
          votes[opt] = (votes[opt] ?? 0) + 1;
          await db.update(posts).set({ poll: { ...polls, votes } }).where(eq(posts.id, id));
        }
        return ok();
      }
      case "view": {
        await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id));
        return ok();
      }
      case "delete": {
        if (post.authorId !== me.id && !me.isAdmin) throw new ApiError(403, "You can only delete your own posts.");
        await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
        await touchHashtags(post.tags, -1);
        return ok();
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const post = await getPostById(id);
    if (!post) throw new ApiError(404, "Post not found.");
    if (post.authorId !== me.id && !me.isAdmin) throw new ApiError(403, "You can only delete your own posts.");
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
    await touchHashtags(post.tags, -1);
    return ok();
  });
}
