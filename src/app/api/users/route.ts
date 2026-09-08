import { and, desc, eq, ilike, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, follows, mutes, users } from "@/db/schema";
import { handle, ok, requireUser } from "@/lib/auth";
import { blockedIds } from "@/lib/posts";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const type = url.searchParams.get("type");
    const limit = Math.min(20, Number(url.searchParams.get("limit") ?? "10"));

    const blocked = await blockedIds(me.id);
    const exclude = [...blocked, me.id];
    const baseWhere = exclude.length
      ? ne(users.id, sql`ANY(${exclude}::uuid[])`)
      : undefined;

    if (type === "suggested") {
      const followed = await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, me.id));
      const followedIds = followed.map((f) => f.id);
      const rows = await db
        .select({
          id: users.id, username: users.username, displayName: users.displayName,
          avatarUrl: users.avatarUrl, bio: users.bio, isVerified: users.isVerified, isPrivate: users.isPrivate,
        })
        .from(users)
        .where(and(
          baseWhere ?? sql`true`,
          followedIds.length ? notInArray(users.id, followedIds) : sql`true`,
          eq(users.isActive, true),
          eq(users.isBanned, false)
        ))
        .orderBy(desc(sql`(SELECT count(*)::int FROM follows f WHERE f.following_id = ${users.id})`))
        .limit(limit);
      const followState = await db.select().from(follows).where(eq(follows.followerId, me.id));
      const state = new Map(followState.map((f) => [f.followingId, f.status]));
      return ok({
        users: rows.map((u) => ({
          ...u,
          following: state.has(u.id),
          pending: state.get(u.id) === "pending",
        })),
      });
    }

    if (!q) return ok({ users: [] });

    const rows = await db
      .select({
        id: users.id, username: users.username, displayName: users.displayName,
        avatarUrl: users.avatarUrl, bio: users.bio, isVerified: users.isVerified, isPrivate: users.isPrivate,
      })
      .from(users)
      .where(and(
        baseWhere ?? sql`true`,
        or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`)),
        eq(users.isActive, true),
        eq(users.isBanned, false)
      ))
      .orderBy(desc(sql`(SELECT count(*)::int FROM follows f WHERE f.following_id = ${users.id})`))
      .limit(limit);
    const followState = await db.select().from(follows).where(and(eq(follows.followerId, me.id), inArray(follows.followingId, rows.map((r) => r.id))));
    const state = new Map(followState.map((f) => [f.followingId, f.status]));
    return ok({
      users: rows.map((u) => ({
        ...u,
        following: state.has(u.id),
        pending: state.get(u.id) === "pending",
      })),
    });
  });
}
