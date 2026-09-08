import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blocks, comments, commentLikes, follows, hashtags, pollVotes, postLikes, posts, postMedia, reposts, savedPosts, users,
} from "@/db/schema";

export type SerializedPost = {
  id: string;
  content: string;
  location: string;
  question: string;
  poll: { question: string; options: { id: number; text: string; votes: number }[]; voted: number | null } | null;
  tags: string[];
  createdAt: string;
  visibility: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  media: { url: string; type: string }[];
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean; isPrivate: boolean };
  repostedBy: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean } | null;
};

export async function serializePosts(
  ids: string[],
  viewerId: string,
  repostMeta?: Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean }>
): Promise<SerializedPost[]> {
  if (ids.length === 0) return [];
  const postRows = await db.select().from(posts).where(inArray(posts.id, ids));
  const authorIds = [...new Set(postRows.map((p) => p.authorId))];
  const [mediaRows, likeRows, saveRows, repostRows, authorRows, voteRows] = await Promise.all([
    db.select().from(postMedia).where(inArray(postMedia.postId, ids)),
    db.select({ postId: postLikes.postId }).from(postLikes).where(and(inArray(postLikes.postId, ids), eq(postLikes.userId, viewerId))),
    db.select({ postId: savedPosts.postId }).from(savedPosts).where(and(inArray(savedPosts.postId, ids), eq(savedPosts.userId, viewerId))),
    db.select({ postId: reposts.postId }).from(reposts).where(and(inArray(reposts.postId, ids), eq(reposts.userId, viewerId))),
    db.select().from(users).where(inArray(users.id, authorIds)),
    db.select({ postId: pollVotes.postId, option: pollVotes.option }).from(pollVotes)
      .where(and(inArray(pollVotes.postId, ids), eq(pollVotes.userId, viewerId))),
  ]);
  const mediaByPost = new Map<string, { url: string; type: string }[]>();
  for (const m of mediaRows) {
    const arr = mediaByPost.get(m.postId) ?? [];
    arr[m.position] = { url: m.url, type: m.type };
    mediaByPost.set(m.postId, arr);
  }
  const liked = new Set(likeRows.map((r) => r.postId));
  const saved = new Set(saveRows.map((r) => r.postId));
  const reposted = new Set(repostRows.map((r) => r.postId));
  const votedByPost = new Map(voteRows.map((r) => [r.postId, r.option]));
  const userById = new Map(authorRows.map((u) => [u.id, u]));
  const byId = new Map(postRows.map((p) => [p.id, p]));

  return ids.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    const author = userById.get(p.authorId);
    if (!author) return [];
    let poll: SerializedPost["poll"] = null;
    if (p.poll) {
      const raw = p.poll as { question: string; options: string[]; votes?: number[] };
      const votes = raw.votes ?? new Array(raw.options.length).fill(0);
      poll = {
        question: raw.question,
        options: raw.options.map((text, i) => ({ id: i, text, votes: votes[i] ?? 0 })),
        voted: votedByPost.get(p.id) ?? null,
      };
    }
    const rb = repostMeta?.get(id) ?? null;
    return [{
      id: p.id,
      content: p.content,
      location: p.location,
      question: p.question,
      poll,
      tags: p.tags,
      createdAt: p.createdAt.toISOString(),
      visibility: p.visibility,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      repostCount: p.repostCount,
      viewCount: p.viewCount,
      liked: liked.has(p.id),
      saved: saved.has(p.id),
      reposted: reposted.has(p.id),
      media: mediaByPost.get(p.id) ?? [],
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        isVerified: author.isVerified,
        isPrivate: author.isPrivate,
      },
      repostedBy: rb,
    } satisfies SerializedPost];
  });
}

export async function getPostById(id: string) {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function touchHashtags(tags: string[], delta: 1 | -1) {
  for (const t of tags) {
    const existing = await db.select({ id: hashtags.id }).from(hashtags).where(eq(hashtags.name, t)).limit(1);
    if (delta === 1) {
      if (existing[0]) {
        await db.update(hashtags).set({ postCount: sql`${hashtags.postCount} + 1` }).where(eq(hashtags.id, existing[0].id));
      } else {
        await db.insert(hashtags).values({ name: t, postCount: 1 }).onConflictDoNothing();
      }
    } else if (existing[0]) {
      await db.update(hashtags).set({ postCount: sql`GREATEST(0, ${hashtags.postCount} - 1)` }).where(eq(hashtags.id, existing[0].id));
    }
  }
}

/** Accepts-follows union: ids I follow + my id + users who follow me. */
export async function visibleAuthorIds(viewerId: string): Promise<string[]> {
  const [f1, f2] = await Promise.all([
    db.select({ id: follows.followingId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.status, "accepted"))),
    db.select({ id: follows.followerId }).from(follows).where(and(eq(follows.followingId, viewerId), eq(follows.status, "accepted"))),
  ]);
  return [...new Set([viewerId, ...f1.map((r) => r.id), ...f2.map((r) => r.id)])];
}

export async function blockedIds(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)));
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
  return [...ids];
}

export async function commentDTO(commentId: string, viewerId: string) {
  const rows = await db
    .select({ c: comments, u: users, liked: commentLikes.userId })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .leftJoin(commentLikes, and(eq(commentLikes.commentId, comments.id), eq(commentLikes.userId, viewerId)))
    .where(eq(comments.id, commentId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.c.id,
    content: r.c.content,
    createdAt: r.c.createdAt.toISOString(),
    likeCount: r.c.likeCount,
    liked: !!r.liked,
    me: r.c.authorId === viewerId,
    author: { username: r.u.username, displayName: r.u.displayName, avatarUrl: r.u.avatarUrl },
  };
}

export const trendOrder = () =>
  desc(sql`(${posts.likeCount} * 2 + ${posts.commentCount} * 3 + ${posts.repostCount} * 4 + ${posts.viewCount} * 0.05)`);

export const newestOrder = () => desc(posts.createdAt);

export { desc, eq, inArray, isNull };
