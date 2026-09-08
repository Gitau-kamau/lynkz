import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roomMembers, rooms, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedIds } from "@/lib/posts";
import { CATEGORIES } from "@/lib/utils";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const category = new URL(req.url).searchParams.get("category");
    const blocked = await blockedIds(me.id);
    const roomRows = await db.select().from(rooms)
      .where(and(
        category && category !== "All" ? eq(rooms.category, category) : sql`true`,
        blocked.length ? ne(rooms.creatorId, sql`ANY(${blocked}::uuid[])`) : sql`true`
      ))
      .orderBy(desc(rooms.memberCount), desc(rooms.createdAt))
      .limit(48);
    const creatorIds = [...new Set(roomRows.map((r) => r.creatorId))];
    const [creators, memberships] = await Promise.all([
      creatorIds.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, creatorIds))
        : Promise.resolve([]),
      db.select().from(roomMembers).where(eq(roomMembers.userId, me.id)),
    ]);
    const creatorById = new Map(creators.map((u) => [u.id, u]));
    const joined = new Set(memberships.map((m) => m.roomId));
    return ok({
      items: roomRows.map((r) => {
        const c = creatorById.get(r.creatorId);
        return {
          id: r.id, name: r.name, description: r.description, category: r.category,
          isClosed: r.isClosed, memberCount: r.memberCount, messageCount: r.messageCount,
          createdAt: r.createdAt.toISOString(), mine: r.creatorId === me.id, joined: joined.has(r.id),
          creator: { id: r.creatorId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({
      name: z.string().min(3, "Room name must be at least 3 characters.").max(60),
      description: z.string().max(300).optional().default(""),
      category: z.string().optional().default("Local"),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid room.");
    const category = CATEGORIES.includes(parsed.data.category) ? parsed.data.category : "Local";
    const [room] = await db.insert(rooms).values({
      name: parsed.data.name.trim(),
      description: parsed.data.description.trim(),
      category,
      creatorId: me.id,
    }).returning();
    await db.insert(roomMembers).values({ roomId: room!.id, userId: me.id, role: "creator" });
    await db.update(rooms).set({ memberCount: 1 }).where(eq(rooms.id, room!.id));
    return ok({ id: room!.id });
  });
}
