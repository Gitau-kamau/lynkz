import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { dropResponses, drops, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/utils";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") ?? "trending";
    const category = url.searchParams.get("category");

    const rows = await db.select().from(drops)
      .where(and(
        category && category !== "All" ? eq(drops.category, category) : sql`true`,
        tab === "mine" ? eq(drops.userId, me.id) : sql`true`
      ))
      .orderBy(tab === "latest" ? desc(drops.createdAt) : desc(drops.responseCount), desc(drops.createdAt))
      .limit(48);

    const creatorIds = [...new Set(rows.map((d) => d.userId))];
    const [creators, myResponses] = await Promise.all([
      creatorIds.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, creatorIds))
        : Promise.resolve([]),
      db.select({ dropId: dropResponses.dropId }).from(dropResponses).where(eq(dropResponses.userId, me.id)),
    ]);
    const creatorById = new Map(creators.map((u) => [u.id, u]));
    const responded = new Set(myResponses.map((r) => r.dropId));
    return ok({
      items: rows.map((d) => {
        const c = creatorById.get(d.userId);
        return {
          id: d.id, prompt: d.prompt, kind: d.kind, category: d.category, responseCount: d.responseCount,
          createdAt: d.createdAt.toISOString(), mine: d.userId === me.id, responded: responded.has(d.id),
          creator: { id: d.userId, username: c?.username ?? "?", displayName: c?.displayName ?? "?", avatarUrl: c?.avatarUrl ?? null },
        };
      }),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({
      prompt: z.string().min(5, "Give your DROP a longer prompt.").max(200),
      kind: z.enum(["challenge", "question"]).optional().default("challenge"),
      category: z.string().max(30).optional().default("Other"),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid DROP.");
    const category = CATEGORIES.includes(parsed.data.category) ? parsed.data.category : "Other";
    const [d] = await db.insert(drops).values({
      userId: me.id,
      prompt: parsed.data.prompt.trim(),
      kind: parsed.data.kind,
      category,
    }).returning();
    return ok({ id: d!.id });
  });
}
