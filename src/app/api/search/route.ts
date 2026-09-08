import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { dropResponses, drops, follows, hashtags, posts, rooms, users } from "@/db/schema";
import { handle, ok, requireUser } from "@/lib/auth";
import { blockedIds, serializePosts } from "@/lib/posts";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (!q) return ok({ users: [], posts: [], hashtags: [], rooms: [], drops: [] });
    const like = `%${q}%`;
    const blocked = await blockedIds(me.id);
    const exclude = [...blocked, me.id];
    const notBlocked = exclude.length ? ne(users.id, sql`ANY(${exclude}::uuid[])`) : sql`true`;

    const [userRows, postRows, tagRows, roomRows, dropRows, followState, dropRespIds] = await Promise.all([
      db.select({
        id: users.id, username: users.username, displayName: users.displayName,
        avatarUrl: users.avatarUrl, bio: users.bio, isVerified: users.isVerified, isPrivate: users.isPrivate,
      }).from(users)
        .where(and(notBlocked, or(ilike(users.username, like), ilike(users.displayName, like)), eq(users.isActive, true), eq(users.isBanned, false)))
        .orderBy(desc(sql`(SELECT count(*)::int FROM follows f WHERE f.following_id = ${users.id})`))
        .limit(6),
      db.select({ id: posts.id }).from(posts)
        .where(and(
          sql`${posts.deletedAt} IS NULL`, ne(posts.visibility, "only_me"),
          ilike(posts.content, like),
          blocked.length ? ne(posts.authorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(posts.createdAt))
        .limit(12),
      db.select().from(hashtags).where(ilike(hashtags.name, like)).orderBy(desc(hashtags.postCount)).limit(8),
      db.select().from(rooms)
        .where(and(or(ilike(rooms.name, like), ilike(rooms.description, like), ilike(rooms.category, like)), blocked.length ? ne(rooms.creatorId, sql`ANY(${blocked}::uuid[])`) : sql`true`))
        .orderBy(desc(rooms.memberCount))
        .limit(6),
      db.select().from(drops).where(ilike(drops.prompt, like)).orderBy(desc(drops.responseCount)).limit(6),
      db.select().from(follows).where(eq(follows.followerId, me.id)),
      db.select({ dropId: dropResponses.dropId }).from(dropResponses).where(eq(dropResponses.userId, me.id)),
    ]);

    const followMap = new Map(followState.map((f) => [f.followingId, f.status]));
    const responded = new Set(dropRespIds.map((d) => d.dropId));

    const [roomCreators, dropCreators, postItems] = await Promise.all([
      roomRows.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, roomRows.map((r) => r.creatorId)))
        : Promise.resolve([]),
      dropRows.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, dropRows.map((d) => d.userId)))
        : Promise.resolve([]),
      serializePosts(postRows.map((p) => p.id), me.id),
    ]);
    const roomCreatorById = new Map(roomCreators.map((u) => [u.id, u]));
    const dropCreatorById = new Map(dropCreators.map((u) => [u.id, u]));

    return ok({
      users: userRows.map((u) => ({
        ...u,
        following: followMap.get(u.id) === "accepted",
        pending: followMap.get(u.id) === "pending",
      })),
      posts: postItems,
      hashtags: tagRows.map((t) => ({ name: t.name, postCount: t.postCount })),
      rooms: roomRows.map((r) => {
        const c = roomCreatorById.get(r.creatorId);
        return {
          id: r.id, name: r.name, description: r.description, category: r.category, isClosed: r.isClosed,
          memberCount: r.memberCount, messageCount: r.messageCount, createdAt: r.createdAt.toISOString(),
          mine: r.creatorId === me.id, joined: false,
          creator: { id: r.creatorId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
      drops: dropRows.map((d) => {
        const c = dropCreatorById.get(d.userId);
        return {
          id: d.id, prompt: d.prompt, kind: d.kind, category: d.category, responseCount: d.responseCount,
          createdAt: d.createdAt.toISOString(), mine: d.userId === me.id, responded: responded.has(d.id),
          creator: { id: d.userId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
    });
  });
}
