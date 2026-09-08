import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversationMembers, conversations, messages, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { validateMediaDataUrl } from "@/lib/utils";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;

    const members = await db
      .select({ userId: conversationMembers.userId, unread: conversationMembers.unreadCount })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, id), inArray(conversationMembers.userId, [me.id])))
      .limit(1);
    if (!members[0]) throw new ApiError(403, "You're not part of this conversation.");

    const allMembers = await db.select({ userId: conversationMembers.userId }).from(conversationMembers)
      .where(eq(conversationMembers.conversationId, id));
    const otherId = allMembers.find((m) => m.userId !== me.id)?.userId;
    const other = otherId
      ? (await db.select().from(users).where(eq(users.id, otherId)).limit(1))[0]
      : undefined;
    if (!other) throw new ApiError(404, "Conversation not found.");

    const [msgRows, conv] = await Promise.all([
      db.select().from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.createdAt))
        .limit(60),
      db.select().from(conversations).where(eq(conversations.id, id)).limit(1),
    ]);

    // mark all incoming as read
    await db.update(messages).set({ isRead: true })
      .where(and(eq(messages.conversationId, id), eq(messages.senderId, otherId ?? "")));
    await db.update(conversationMembers).set({ unreadCount: 0, lastReadAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, me.id)));

    const typing = (conv[0]?.typing ?? {}) as Record<string, number>;
    const typingLive = otherId ? !!typing[otherId] && Date.now() - typing[otherId] < 5000 : false;

    // reply previews
    const replyIds = msgRows.map((m) => m.replyToId).filter((x): x is string => !!x);
    let replyMap = new Map<string, { content: string; senderName: string }>();
    if (replyIds.length) {
      const replies = await db
        .select({ id: messages.id, content: messages.content, senderId: messages.senderId, username: users.username })
        .from(messages)
        .innerJoin(users, eq(users.id, messages.senderId))
        .where(inArray(messages.id, replyIds));
      replyMap = new Map(replies.map((r) => [r.id, { content: r.content.slice(0, 80), senderName: r.username }]));
    }

    return ok({
      other: {
        id: other.id,
        username: other.username,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
        online: !!other.lastSeenAt && other.lastSeenAt.getTime() > Date.now() - 2 * 60_000,
      },
      typing: typingLive,
      messages: msgRows
        .filter((m) => !m.deletedAt)
        .reverse()
        .map((m) => ({
          id: m.id,
          content: m.content,
          mediaUrl: m.mediaUrl,
          replyTo: m.replyToId ? replyMap.get(m.replyToId) ?? null : null,
          senderId: m.senderId,
          createdAt: m.createdAt.toISOString(),
          deleted: !!m.deletedAt,
          mine: m.senderId === me.id,
        })),
    });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const parsed = z.object({
      type: z.enum(["send", "typing", "delete", "read"]),
      content: z.string().max(2000).optional().default(""),
      mediaUrl: z.string().max(25_000_000).nullish(),
      replyToId: z.string().uuid().nullish(),
      messageId: z.string().uuid().optional(),
      stop: z.boolean().optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid request.");
    const d = parsed.data;

    const member = await db.select().from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, me.id)))
      .limit(1);
    if (!member[0]) throw new ApiError(403, "You're not part of this conversation.");

    if (d.type === "typing") {
      const conv = (await db.select().from(conversations).where(eq(conversations.id, id)).limit(1))[0];
      const typing = { ...((conv?.typing ?? {}) as Record<string, number>) };
      if (d.stop) delete typing[me.id];
      else typing[me.id] = Date.now();
      await db.update(conversations).set({ typing }).where(eq(conversations.id, id));
      return ok();
    }

    if (d.type === "read") {
      await db.update(conversationMembers).set({ unreadCount: 0 }).where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, me.id)));
      return ok();
    }

    if (d.type === "delete") {
      if (!d.messageId) throw new ApiError(400, "Missing message.");
      const msg = (await db.select().from(messages).where(and(eq(messages.id, d.messageId), eq(messages.conversationId, id))).limit(1))[0];
      if (!msg) throw new ApiError(404, "Message not found.");
      if (msg.senderId !== me.id) throw new ApiError(403, "You can only delete your own messages.");
      await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, d.messageId));
      return ok();
    }

    // send
    if (!d.content?.trim() && !d.mediaUrl) throw new ApiError(400, "Message is empty.");
    if (d.mediaUrl) {
      const err = validateMediaDataUrl(d.mediaUrl, d.mediaUrl.startsWith("data:video") ? "video" : "image");
      if (err) throw new ApiError(400, err);
    }
    const others = await db.select({ userId: conversationMembers.userId }).from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, id), sql`${conversationMembers.userId} <> ${me.id}`));
    const [msg] = await db.insert(messages).values({
      conversationId: id, senderId: me.id, content: d.content.trim(), mediaUrl: d.mediaUrl ?? null, replyToId: d.replyToId ?? null,
    }).returning();
    await db.update(conversations).set({ lastMessageAt: new Date(), typing: {} }).where(eq(conversations.id, id));
    for (const o of others) {
      await db.update(conversationMembers).set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
        .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, o.userId)));
      await notify(o.userId, me.id, "message");
    }
    return ok({ id: msg!.id });
  });
}
