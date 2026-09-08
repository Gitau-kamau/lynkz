import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { follows, pollVotes, postLikes, posts, postMedia, reposts, savedPosts, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { blockedIds, getPostById, newestOrder, serializePosts, touchHashtags, trendOrder, visibleAuthorIds } from "@/lib/posts";
import { parseMentions, parseTags, validateMediaDataUrl } from "@/lib/utils";

const LIMIT = 8;

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "home";
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const userParam = url.searchParams.get("user");
    const tag = url.searchParams.get("tag");

    const blocked = await blockedIds(me.id);
    const notIn = (col: typeof posts.authorId) => (blocked.length ? ne(col, sql`ANY(${blocked}::uuid[])`) : undefined);

    let ids: string[] = [];
    let total = 0;

    if (type === "saved") {
      const saved = await db
        .select({ id: savedPosts.postId, at: savedPosts.createdAt })
        .from(savedPosts)
        .where(eq(savedPosts.userId, me.id))
        .orderBy(desc(savedPosts.createdAt))
        .limit(LIMIT + 1)
        .offset(offset);
      ids = saved.map((s) => s.id);
    } else if (type === "hashtag" && tag) {
      const rows = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(
          sql`array_position(${posts.tags}, ${tag.toLowerCase()}) is not null`,
          isNull(posts.deletedAt),
          ne(posts.visibility, "only_me"),
          blocked.length ? ne(posts.authorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(posts.createdAt))
        .limit(LIMIT + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    } else if (type === "profile" || type === "media") {
      const urows = await db.select({ id: users.id }).from(users).where(eq(users.username, (userParam ?? "").toLowerCase())).limit(1);
      const author = urows[0];
      if (!author) throw new ApiError(404, "User not found.");
      const visible = await visibleAuthorIds(me.id);
      const canSee = author.id === me.id || visible.includes(author.id);
      const rows = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(
          eq(posts.authorId, author.id),
          isNull(posts.deletedAt),
          canSee ? sql`true` : eq(posts.visibility, "everyone"),
          type === "media" ? sql`EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = ${posts.id})` : sql`true`
        ))
        .orderBy(desc(posts.createdAt))
        .limit(LIMIT + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    } else if (type === "home" || type === "following") {
      const followed = await db.select({ id: follows.followingId }).from(follows)
        .where(and(eq(follows.followerId, me.id), eq(follows.status, "accepted")));
      const followedIds = followed.map((f) => f.id);
      // posts by followed users
      const postRows = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(
          followedIds.length ? inArray(posts.authorId, followedIds) : sql`false`,
          isNull(posts.deletedAt),
          blocked.length ? ne(posts.authorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(newestOrder())
        .limit(LIMIT + 1)
        .offset(offset);
      const repostRows = await db
        .select({ id: reposts.postId, name: users.displayName, username: users.username, avatarUrl: users.avatarUrl, isVerified: users.isVerified, rid: reposts.userId })
        .from(reposts)
        .innerJoin(users, eq(users.id, reposts.userId))
        .where(and(
          followedIds.length ? inArray(reposts.userId, followedIds) : sql`false`,
          blocked.length ? ne(reposts.userId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(reposts.createdAt))
        .limit(LIMIT + 1)
        .offset(offset);
      ids = [...postRows.map((r) => r.id), ...repostRows.map((r) => r.id)];
      // build repost meta
      const repostMeta = new Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean }>();
      for (const r of repostRows) {
        if (!repostMeta.has(r.id)) {
          repostMeta.set(r.id, { id: r.rid, username: r.username, displayName: r.name, avatarUrl: r.avatarUrl, isVerified: r.isVerified });
        }
      }
      const items = await serializePosts(ids, me.id, repostMeta);
      return ok({ items, next: ids.length > LIMIT ? String(offset + LIMIT) : null });
    } else {
      // foryou / explore — trending public posts
      const rows = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(
          isNull(posts.deletedAt),
          ne(posts.visibility, "only_me"),
          type === "explore" ? sql`EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = ${posts.id})` : sql`true`,
          blocked.length ? ne(posts.authorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(trendOrder(), desc(posts.createdAt))
        .limit(LIMIT + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    }

    if (type === "saved" || type === "profile" || type === "media" || type === "hashtag") {
      const items = await serializePosts(ids, me.id);
      const countRows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(posts)
        .where(and(
          isNull(posts.deletedAt),
          type === "saved" ? inArray(posts.id, await savedIds(me.id)) :
          type === "hashtag" ? sql`array_position(${posts.tags}, ${(tag ?? "").toLowerCase()}) is not null` :
          type === "profile" || type === "media" ? sql`true` : sql`true`
        ));
      total = countRows[0]?.c ?? 0;
      return ok({ items, next: ids.length > LIMIT ? String(offset + LIMIT) : null, count: total });
    }

    return ok({ items: await serializePosts(ids.slice(0, LIMIT), me.id), next: ids.length > LIMIT ? String(offset + LIMIT) : null });
  });
}

async function savedIds(userId: string) {
  const rows = await db.select({ id: savedPosts.postId }).from(savedPosts).where(eq(savedPosts.userId, userId));
  return rows.map((r) => r.id);
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      content: z.string().max(2000).optional().default(""),
      media: z.array(z.object({ url: z.string().max(25_000_000), type: z.enum(["image", "video"]) })).max(4).optional().default([]),
      location: z.string().max(80).optional().default(""),
      visibility: z.enum(["everyone", "followers", "only_me"]).optional().default("everyone"),
      question: z.string().max(300).optional().default(""),
      poll: z.object({
        question: z.string().min(1, "Poll needs a question.").max(200),
        options: z.array(z.string().min(1, "Options can't be empty.").max(100)).min(2).max(4),
      }).nullish(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid post.");
    const d = parsed.data;
    if (!d.content.trim() && d.media.length === 0 && !d.question.trim() && !d.poll) {
      throw new ApiError(400, "Write something, add media, or a poll first.");
    }
    for (const m of d.media) {
      const err = validateMediaDataUrl(m.url, m.type);
      if (err) throw new ApiError(400, err);
    }
    if (d.poll && d.poll.options.filter((o) => o.trim()).length < 2) throw new ApiError(400, "A poll needs at least 2 options.");

    const tags = parseTags(d.content);
    const mentions = parseMentions(d.content);
    const [p] = await db
      .insert(posts)
      .values({
        authorId: me.id,
        content: d.content.trim(),
        location: d.location.trim(),
        visibility: d.visibility,
        question: d.question.trim(),
        poll: d.poll ? { question: d.poll.question.trim(), options: d.poll.options.map((o) => o.trim()), votes: new Array(d.poll.options.length).fill(0) } : null,
        tags,
      })
      .returning();
    const postId = p!.id;
    if (d.media.length) {
      await db.insert(postMedia).values(d.media.map((m, i) => ({ postId, url: m.url, type: m.type, position: i })));
    }
    await touchHashtags(tags, 1);

    // notify mentioned users
    for (const uname of mentions) {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, uname)).limit(1);
      const target = rows[0];
      if (target && target.id !== me.id) await notify(target.id, me.id, "mention", { postId, text: d.content });
    }
    return ok({ id: postId });
  });
}
