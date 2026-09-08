import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, drops, follows, lynks, messages, posts, reports, rooms, roomMessages, users } from "@/db/schema";
import { ApiError, handle, ok, requireAdmin } from "@/lib/auth";
import { touchHashtags } from "@/lib/posts";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const view = new URL(req.url).searchParams.get("view") ?? "stats";
    const result: Record<string, unknown> = {};

    if (view === "stats" || view === "users") {
      const [totalUsers, activeUsers, totalPosts, totalComments, totalMessages, pendingReports, totalRooms, totalDrops, totalLynks, userRows] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(users),
        db.select({ c: sql<number>`count(*)::int` }).from(users).where(and(eq(users.isActive, true), eq(users.isBanned, false))),
        db.select({ c: sql<number>`count(*)::int` }).from(posts).where(sql`${posts.deletedAt} IS NULL`),
        db.select({ c: sql<number>`count(*)::int` }).from(comments),
        db.select({ c: sql<number>`count(*)::int` }).from(messages),
        db.select({ c: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "pending")),
        db.select({ c: sql<number>`count(*)::int` }).from(rooms),
        db.select({ c: sql<number>`count(*)::int` }).from(drops),
        db.select({ c: sql<number>`count(*)::int` }).from(lynks).where(sql`${lynks.deletedAt} IS NULL AND ${lynks.expiresAt} > now()`),
        db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, email: users.email, isActive: users.isActive, isBanned: users.isBanned, isAdmin: users.isAdmin, createdAt: users.createdAt })
          .from(users).orderBy(desc(users.createdAt)).limit(60),
      ]);
      result.stats = {
        users: totalUsers[0]?.c ?? 0,
        activeUsers: activeUsers[0]?.c ?? 0,
        posts: totalPosts[0]?.c ?? 0,
        comments: totalComments[0]?.c ?? 0,
        messages: totalMessages[0]?.c ?? 0,
        pendingReports: pendingReports[0]?.c ?? 0,
        rooms: totalRooms[0]?.c ?? 0,
        drops: totalDrops[0]?.c ?? 0,
        lynks: totalLynks[0]?.c ?? 0,
      };
      if (view === "users") {
        const followerCounts = await db
          .select({ userId: follows.followingId, c: sql<number>`count(*)::int` })
          .from(follows).where(eq(follows.status, "accepted"))
          .groupBy(follows.followingId);
        const fc = new Map(followerCounts.map((f) => [f.userId, f.c]));
        result.users = userRows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), followers: fc.get(u.id) ?? 0 }));
      }
    }

    if (view === "posts") {
      const rows = await db
        .select({
          id: posts.id, content: posts.content, authorId: posts.authorId, likeCount: posts.likeCount,
          commentCount: posts.commentCount, createdAt: posts.createdAt,
          username: users.username,
        })
        .from(posts).innerJoin(users, eq(users.id, posts.authorId))
        .where(sql`${posts.deletedAt} IS NULL`)
        .orderBy(desc(posts.createdAt))
        .limit(60);
      result.posts = rows.map((r) => ({ id: r.id, content: r.content, authorUsername: r.username, likeCount: r.likeCount, commentCount: r.commentCount, createdAt: r.createdAt.toISOString() }));
    }

    if (view === "reports") {
      const rows = await db
        .select({
          id: reports.id, targetType: reports.targetType, targetId: reports.targetId,
          reason: reports.reason, details: reports.details, status: reports.status, createdAt: reports.createdAt,
          reporterUsername: users.username,
        })
        .from(reports).innerJoin(users, eq(users.id, reports.reporterId))
        .orderBy(desc(sql`CASE WHEN ${reports.status} = 'pending' THEN 0 ELSE 1 END`), desc(reports.createdAt))
        .limit(60);
      result.reports = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), reporterUsername: r.reporterUsername }));
    }

    if (view === "rooms") {
      const rows = await db.select().from(rooms).orderBy(desc(rooms.createdAt)).limit(60);
      const creatorIds = [...new Set(rows.map((r) => r.creatorId))];
      const creators = creatorIds.length
        ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, creatorIds))
        : [];
      const cById = new Map(creators.map((u) => [u.id, u]));
      result.rooms = rows.map((r) => ({
        id: r.id, name: r.name, category: r.category, isClosed: r.isClosed,
        memberCount: r.memberCount, creatorUsername: cById.get(r.creatorId)?.username ?? "?",
      }));
    }

    return ok(result);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireAdmin();
    const parsed = z.object({
      action: z.enum([
        "ban", "unban", "suspend", "lift_suspend", "delete_post", "delete_comment",
        "resolve_report", "dismiss_report", "close_room", "reopen_room", "delete_room",
      ]),
      id: z.string().uuid().optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !parsed.data.id) throw new ApiError(400, "Invalid request.");
    const { action, id } = parsed.data;

    switch (action) {
      case "ban":
        await db.update(users).set({ isBanned: true, isActive: true }).where(eq(users.id, id));
        return ok();
      case "unban":
        await db.update(users).set({ isBanned: false }).where(eq(users.id, id));
        return ok();
      case "suspend":
        await db.update(users).set({ isActive: false }).where(eq(users.id, id));
        return ok();
      case "lift_suspend":
        await db.update(users).set({ isActive: true }).where(eq(users.id, id));
        return ok();
      case "delete_post": {
        const post = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
        if (post) {
          await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
          await touchHashtags(post.tags, -1);
        }
        await db.update(reports).set({ status: "resolved" }).where(and(eq(reports.targetType, "post"), eq(reports.targetId, id)));
        return ok();
      }
      case "delete_comment": {
        const c = (await db.select().from(comments).where(eq(comments.id, id)).limit(1))[0];
        if (c) {
          await db.update(comments).set({ deletedAt: new Date(), content: "[removed by moderator]" }).where(eq(comments.id, id));
          await db.update(posts).set({ commentCount: sql`GREATEST(0, ${posts.commentCount} - 1)` }).where(eq(posts.id, c.postId));
        }
        await db.update(reports).set({ status: "resolved" }).where(and(eq(reports.targetType, "comment"), eq(reports.targetId, id)));
        return ok();
      }
      case "resolve_report":
        await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, id));
        return ok();
      case "dismiss_report":
        await db.update(reports).set({ status: "dismissed" }).where(eq(reports.id, id));
        return ok();
      case "close_room":
        await db.update(rooms).set({ isClosed: true }).where(eq(rooms.id, id));
        return ok();
      case "reopen_room":
        await db.update(rooms).set({ isClosed: false }).where(eq(rooms.id, id));
        return ok();
      case "delete_room":
        await db.delete(rooms).where(eq(rooms.id, id));
        return ok();
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
}
