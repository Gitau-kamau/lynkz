import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversationMembers, notifications, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    if (url.searchParams.get("counts") === "1") {
      const [notifCount, msgCount] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, me.id), eq(notifications.isRead, false))),
        db.select({ c: sql<number>`count(*)::int` }).from(conversationMembers)
          .where(and(eq(conversationMembers.userId, me.id), sql`${conversationMembers.unreadCount} > 0`)),
      ]);
      return ok({ counts: { notifications: notifCount[0]?.c ?? 0, messages: msgCount[0]?.c ?? 0 } });
    }

    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "50"));
    const onlyUnread = url.searchParams.get("onlyUnread") === "1";
    const rows = await db
      .select({
        id: notifications.id, type: notifications.type, text: notifications.text,
        isRead: notifications.isRead, createdAt: notifications.createdAt,
        postId: notifications.postId, roomId: notifications.roomId,
        lynkId: notifications.lynkId, dropId: notifications.dropId,
        actorId: notifications.actorId,
        username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(and(eq(notifications.userId, me.id), onlyUnread ? eq(notifications.isRead, false) : sql`true`))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return ok({
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        text: n.text,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        postId: n.postId,
        roomId: n.roomId,
        lynkId: n.lynkId,
        dropId: n.dropId,
        actor: n.actorId ? { username: n.username, displayName: n.displayName, avatarUrl: n.avatarUrl } : null,
      })),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({ type: z.enum(["read", "read_all"]), ids: z.array(z.string().uuid()).optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid request.");
    if (parsed.data.type === "read_all") {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, me.id));
    } else if (parsed.data.ids?.length) {
      await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.userId, me.id), sql`${notifications.id} = ANY(${parsed.data.ids}::uuid[])`));
    }
    return ok();
  });
}
