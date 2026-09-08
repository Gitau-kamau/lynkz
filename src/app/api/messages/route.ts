import { and, desc, eq, inArray, isNull, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversationMembers, conversations, follows, messages, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";
import { validateMediaDataUrl } from "@/lib/utils";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const memberships = await db
      .select({ conversationId: conversationMembers.conversationId, unread: conversationMembers.unreadCount })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, me.id));
    if (memberships.length === 0) return ok({ items: [] });

    const convIds = memberships.map((m) => m.conversationId);
    const convRows = await db.select().from(conversations).where(inArray(conversations.id, convIds));
    const allMembers = await db
      .select({ conversationId: conversationMembers.conversationId, userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(inArray(conversationMembers.conversationId, convIds));
    const otherUserIds = allMembers
      .filter((m) => m.userId !== me.id)
      .map((m) => ({ conversationId: m.conversationId, userId: m.userId }));
    const userRows = otherUserIds.length
      ? await db.select().from(users).where(inArray(users.id, otherUserIds.map((o) => o.userId)))
      : [];
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const lastMsgs = await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, convIds))
      .orderBy(desc(messages.createdAt))
      .limit(200);
    const lastByConv = new Map<string, typeof lastMsgs[number]>();
    for (const m of lastMsgs) {
      if (!lastByConv.has(m.conversationId) && !m.deletedAt) lastByConv.set(m.conversationId, m);
    }
    const unreadByConv = new Map(memberships.map((m) => [m.conversationId, m.unread]));
    const typingByConv = new Map<string, Record<string, number>>();
    for (const c of convRows) {
      const typing = (c.typing ?? {}) as Record<string, number>;
      const live: Record<string, number> = {};
      for (const [uid, ts] of Object.entries(typing)) {
        if (uid !== me.id && Date.now() - ts < 5000) live[uid] = ts;
      }
      typingByConv.set(c.id, live);
    }

    const items = convRows
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .map((c) => {
        const otherInfo = otherUserIds.find((o) => o.conversationId === c.id);
        const other = otherInfo ? userById.get(otherInfo.userId) : undefined;
        const last = lastByConv.get(c.id);
        const typingUid = Object.keys(typingByConv.get(c.id) ?? {})[0];
        const typingUser = typingUid ? userById.get(typingUid) : undefined;
        return {
          id: c.id,
          lastMessage: last
            ? { content: last.content, mediaUrl: last.mediaUrl, senderId: last.senderId, createdAt: last.createdAt.toISOString() }
            : null,
          unread: unreadByConv.get(c.id) ?? 0,
          other: other
            ? {
                id: other.id,
                username: other.username,
                displayName: other.displayName,
                avatarUrl: other.avatarUrl,
                online: !!other.lastSeenAt && other.lastSeenAt.getTime() > Date.now() - 2 * 60_000,
              }
            : { id: "", username: "unknown", displayName: "Unknown", avatarUrl: null, online: false },
          typing: !!typingUser,
        };
      });
    return ok({ items });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({ to: z.string().min(1), content: z.string().max(2000).optional().default(""), mediaUrl: z.string().max(25_000_000).nullish() })
      .safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid message.");
    const d = parsed.data;

    const targetRows = await db.select().from(users).where(eq(users.username, d.to.toLowerCase().replace(/^@/, ""))).limit(1);
    const target = targetRows[0];
    if (!target) throw new ApiError(404, "User not found.");
    if (target.id === me.id) throw new ApiError(400, "You can't message yourself.");
    if (await blockedBetween(me.id, target.id)) throw new ApiError(403, "You can't message this account.");
    if (d.mediaUrl) {
      const err = validateMediaDataUrl(d.mediaUrl, d.mediaUrl.startsWith("data:video") ? "video" : "image");
      if (err) throw new ApiError(400, err);
    }

    // find existing conversation between the two
    const myConvs = await db.select({ conversationId: conversationMembers.conversationId }).from(conversationMembers).where(eq(conversationMembers.userId, me.id));
    let convId: string | null = null;
    if (myConvs.length) {
      const shared = await db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(and(inArray(conversationMembers.conversationId, myConvs.map((m) => m.conversationId)), eq(conversationMembers.userId, target.id)))
        .limit(1);
      convId = shared[0]?.conversationId ?? null;
    }

    if (!convId) {
      const [conv] = await db.insert(conversations).values({}).returning();
      convId = conv!.id;
      await db.insert(conversationMembers).values([
        { conversationId: convId, userId: me.id },
        { conversationId: convId, userId: target.id },
      ]);
    }

    if (d.content || d.mediaUrl) {
      const [msg] = await db.insert(messages).values({
        conversationId: convId, senderId: me.id, content: d.content.trim(), mediaUrl: d.mediaUrl ?? null,
      }).returning();
      void msg;
      await db.update(conversations).set({ lastMessageAt: new Date(), typing: {} }).where(eq(conversations.id, convId));
      await db.update(conversationMembers).set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
        .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, target.id)));
      await notify(target.id, me.id, "message");
    }
    return ok({ id: convId });
  });
}
