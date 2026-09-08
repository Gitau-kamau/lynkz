import { and, desc, eq, gt, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { dropResponses, drops, follows, hashtags, lynks, posts, roomMembers, rooms, users } from "@/db/schema";
import { handle, ok, requireUser } from "@/lib/auth";
import { blockedIds, serializePosts } from "@/lib/posts";

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const blocked = await blockedIds(me.id);
    const exclude = [...blocked, me.id];

    const [tagRows, userRows, postIds, lynkRows, roomRows, dropRows] = await Promise.all([
      db.select().from(hashtags).orderBy(desc(hashtags.postCount)).limit(10),
      db.select().from(users)
        .where(and(
          exclude.length ? ne(users.id, sql`ANY(${exclude}::uuid[])`) : sql`true`,
          eq(users.isActive, true), eq(users.isBanned, false)
        ))
        .orderBy(desc(sql`(SELECT count(*)::int FROM follows f WHERE f.following_id = ${users.id})`))
        .limit(6),
      db.select({ id: posts.id }).from(posts)
        .where(and(
          sql`${posts.deletedAt} IS NULL`, ne(posts.visibility, "only_me"),
          blocked.length ? ne(posts.authorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(sql`(${posts.likeCount} * 2 + ${posts.commentCount} * 3 + ${posts.repostCount} * 4 + ${posts.viewCount} * 0.05)`))
        .limit(9),
      db.select().from(lynks)
        .where(and(
          gt(lynks.expiresAt, new Date()), sql`${lynks.deletedAt} IS NULL`,
          blocked.length ? ne(lynks.userId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(lynks.viewCount))
        .limit(6),
      db.select().from(rooms)
        .where(blocked.length ? ne(rooms.creatorId, sql`ANY(${blocked}::uuid[])`) : sql`true`)
        .orderBy(desc(rooms.memberCount), desc(rooms.createdAt))
        .limit(4),
      db.select().from(drops).orderBy(desc(drops.responseCount), desc(drops.createdAt)).limit(4),
    ]);

    const [followState, myRoomMemberships, myDropResponses, roomCreators, dropCreators, lynkUsers, postItems] = await Promise.all([
      db.select().from(follows).where(eq(follows.followerId, me.id)),
      db.select({ roomId: rooms.id, roomName: rooms.name, roomDescription: rooms.description, roomCategory: rooms.category, roomClosed: rooms.isClosed, roomMemberCount: rooms.memberCount, roomMessageCount: rooms.messageCount, roomCreatedAt: rooms.createdAt, userId: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(roomMembers).innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
        .innerJoin(users, eq(users.id, rooms.creatorId))
        .where(eq(roomMembers.userId, me.id)),
      db.select({ dropId: dropResponses.dropId }).from(dropResponses).where(eq(dropResponses.userId, me.id)),
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [...new Set(roomRows.map((r) => r.creatorId))])),
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [...new Set(dropRows.map((d) => d.userId))])),
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [...new Set(lynkRows.map((l) => l.userId))])),
      serializePosts(postIds.map((p) => p.id), me.id),
    ]);

    const followedSet = new Set(followState.filter((f) => f.status === "accepted").map((f) => f.followingId));
    const pendingSet = new Set(followState.filter((f) => f.status === "pending").map((f) => f.followingId));
    const joinedRoomIds = new Set(myRoomMemberships.map((m) => m.roomId));
    const respondedDropIds = new Set(myDropResponses.map((d) => d.dropId));
    const roomCreatorById = new Map(roomCreators.map((u) => [u.id, u]));
    const dropCreatorById = new Map(dropCreators.map((u) => [u.id, u]));
    const lynkUserById = new Map(lynkUsers.map((u) => [u.id, u]));

    return ok({
      hashtags: tagRows.map((t) => ({ name: t.name, postCount: t.postCount })),
      users: userRows.map((u) => ({
        id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
        bio: u.bio, isVerified: u.isVerified, isPrivate: u.isPrivate,
        following: followedSet.has(u.id), pending: pendingSet.has(u.id),
      })),
      posts: postItems,
      lynks: lynkRows.map((l) => {
        const a = lynkUserById.get(l.userId);
        return {
          id: l.id, type: l.type, content: l.content, viewCount: l.viewCount,
          author: { username: a?.username ?? "?", displayName: a?.displayName ?? "?", avatarUrl: a?.avatarUrl ?? null },
        };
      }),
      rooms: roomRows.map((r) => {
        const c = roomCreatorById.get(r.creatorId);
        return {
          id: r.id, name: r.name, description: r.description, category: r.category,
          isClosed: r.isClosed, memberCount: r.memberCount, messageCount: r.messageCount,
          createdAt: r.createdAt.toISOString(), mine: r.creatorId === me.id, joined: joinedRoomIds.has(r.id),
          creator: { id: r.creatorId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
      drops: dropRows.map((d) => {
        const c = dropCreatorById.get(d.userId);
        return {
          id: d.id, prompt: d.prompt, kind: d.kind, category: d.category,
          responseCount: d.responseCount, createdAt: d.createdAt.toISOString(),
          mine: d.userId === me.id, responded: respondedDropIds.has(d.id),
          creator: { id: d.userId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
    });
  });
}
