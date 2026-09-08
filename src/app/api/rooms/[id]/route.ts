import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roomMembers, roomMessages, rooms, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";
import { blockedIds } from "@/lib/posts";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const room = (await db.select().from(rooms).where(eq(rooms.id, id)).limit(1))[0];
    if (!room) throw new ApiError(404, "Room not found.");
    if (await blockedBetween(me.id, room.creatorId)) throw new ApiError(403, "You can't view this room.");

    const [creator, myMembership, members, msgs] = await Promise.all([
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, room.creatorId)).limit(1),
      db.select().from(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, me.id))).limit(1),
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: roomMembers.role })
        .from(roomMembers).innerJoin(users, eq(users.id, roomMembers.userId))
        .where(eq(roomMembers.roomId, id)).limit(100),
      db.select().from(roomMessages).where(and(eq(roomMessages.roomId, id), sql`${roomMessages.deletedAt} IS NULL`)).orderBy(desc(roomMessages.createdAt)).limit(80),
    ]);
    const mutedIds = (room.mutedIds as string[]) ?? [];

    const msgAuthorIds = [...new Set(msgs.map((m) => m.userId))];
    const msgAuthors = msgAuthorIds.length
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, msgAuthorIds))
      : [];
    const authorById = new Map(msgAuthors.map((u) => [u.id, u]));

    return ok({
      id: room.id,
      name: room.name,
      description: room.description,
      category: room.category,
      isClosed: room.isClosed,
      memberCount: room.memberCount,
      createdAt: room.createdAt.toISOString(),
      mine: room.creatorId === me.id,
      canModerate: !!myMembership[0] && (myMembership[0].role === "creator" || myMembership[0].role === "moderator"),
      joined: !!myMembership[0],
      muted: mutedIds.includes(me.id),
      creator: creator[0] ?? { id: "", username: "?", displayName: "?", avatarUrl: null },
      members: members.filter((m) => !mutedIds.includes(m.id) || m.id === me.id),
      messages: msgs.reverse().map((m) => {
        const a = authorById.get(m.userId);
        return {
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          isPinned: m.isPinned,
          mine: m.userId === me.id,
          author: a ?? { id: m.userId, username: "?", displayName: "?", avatarUrl: null },
        };
      }),
    });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const parsed = z.object({
      type: z.enum(["join", "leave", "message", "pin", "unpin", "remove", "mute", "unmute", "close", "reopen", "delete", "report_msg"]),
      content: z.string().max(500).optional().default(""),
      messageId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      emoji: z.string().optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid action.");
    const d = parsed.data;

    const room = (await db.select().from(rooms).where(eq(rooms.id, id)).limit(1))[0];
    if (!room) throw new ApiError(404, "Room not found.");
    const membership = (await db.select().from(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, me.id))).limit(1))[0];
    const isMod = membership && (membership.role === "creator" || membership.role === "moderator");
    const mutedIds = (room.mutedIds as string[]) ?? [];

    switch (d.type) {
      case "join": {
        if (room.isClosed && !isMod) throw new ApiError(403, "This room is closed.");
        if (await blockedBetween(me.id, room.creatorId)) throw new ApiError(403, "You can't join this room.");
        const [m] = await db.insert(roomMembers).values({ roomId: id, userId: me.id, role: "member" }).onConflictDoNothing().returning();
        if (m) await db.update(rooms).set({ memberCount: sql`${rooms.memberCount} + 1` }).where(eq(rooms.id, id));
        return ok();
      }
      case "leave": {
        if (membership && membership.role === "creator") throw new ApiError(400, "Creators can't leave their own room — close it instead.");
        const [del] = await db.delete(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, me.id))).returning();
        if (del) await db.update(rooms).set({ memberCount: sql`GREATEST(1, ${rooms.memberCount} - 1)` }).where(eq(rooms.id, id));
        return ok();
      }
      case "message": {
        if (!membership) throw new ApiError(403, "Join the room to post.");
        if (mutedIds.includes(me.id)) throw new ApiError(403, "You've been muted in this room.");
        if (room.isClosed && !isMod) throw new ApiError(403, "This room is closed.");
        const content = d.content.trim();
        if (!content) throw new ApiError(400, "Message can't be empty.");
        await db.insert(roomMessages).values({ roomId: id, userId: me.id, content });
        await db.update(rooms).set({ messageCount: sql`${rooms.messageCount} + 1` }).where(eq(rooms.id, id));
        // notify members (a few)
        const members = await db.select({ userId: roomMembers.userId }).from(roomMembers).where(eq(roomMembers.roomId, id));
        for (const m of members.slice(0, 12)) {
          await notify(m.userId, me.id, "room", { roomId: id, text: `${room.name}: ${content.slice(0, 50)}` });
        }
        return ok();
      }
      case "pin":
      case "unpin": {
        if (!isMod) throw new ApiError(403, "Only moderators can pin messages.");
        if (!d.messageId) throw new ApiError(400, "Missing message.");
        await db.update(roomMessages).set({ isPinned: d.type === "pin" }).where(eq(roomMessages.id, d.messageId));
        return ok();
      }
      case "remove": {
        if (!isMod && !d.messageId) throw new ApiError(403, "Not allowed.");
        const msg = d.messageId ? (await db.select().from(roomMessages).where(eq(roomMessages.id, d.messageId)).limit(1))[0] : undefined;
        if (msg && msg.userId !== me.id && !isMod) throw new ApiError(403, "Not allowed.");
        if (msg) await db.update(roomMessages).set({ deletedAt: new Date() }).where(eq(roomMessages.id, msg.id));
        return ok();
      }
      case "mute": {
        if (!isMod) throw new ApiError(403, "Only moderators can mute members.");
        if (!d.userId) throw new ApiError(400, "Missing user.");
        if (d.userId === room.creatorId) throw new ApiError(400, "You can't mute the creator.");
        await db.update(rooms).set({ mutedIds: [...new Set([...mutedIds, d.userId])] }).where(eq(rooms.id, id));
        return ok();
      }
      case "unmute": {
        if (!isMod) throw new ApiError(403, "Only moderators can unmute members.");
        await db.update(rooms).set({ mutedIds: mutedIds.filter((x) => x !== d.userId) }).where(eq(rooms.id, id));
        return ok();
      }
      case "close": {
        if (!isMod) throw new ApiError(403, "Only moderators can close rooms.");
        await db.update(rooms).set({ isClosed: true }).where(eq(rooms.id, id));
        return ok();
      }
      case "reopen": {
        if (!isMod) throw new ApiError(403, "Only moderators can reopen rooms.");
        await db.update(rooms).set({ isClosed: false }).where(eq(rooms.id, id));
        return ok();
      }
      case "delete": {
        if (!isMod && room.creatorId !== me.id) throw new ApiError(403, "Not allowed.");
        await db.delete(rooms).where(eq(rooms.id, id));
        return ok();
      }
      case "report_msg": {
        // handled by reports route; here just acknowledge
        return ok();
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
}
