import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { dropResponses, drops, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { validateMediaDataUrl } from "@/lib/utils";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const drop = (await db.select().from(drops).where(eq(drops.id, id)).limit(1))[0];
    if (!drop) throw new ApiError(404, "DROP not found.");
    const [creator, responses, myResponse] = await Promise.all([
      db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, drop.userId)).limit(1),
      db.select().from(dropResponses).where(eq(dropResponses.dropId, id)).orderBy(desc(dropResponses.createdAt)).limit(60),
      db.select().from(dropResponses).where(and(eq(dropResponses.dropId, id), eq(dropResponses.userId, me.id))).limit(1),
    ]);
    const userIds = [...new Set(responses.map((r) => r.userId))];
    const rUsers = userIds.length
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eqIn(userIds))
      : [];
    const userById = new Map(rUsers.map((u) => [u.id, u]));

    return ok({
      id: drop.id,
      prompt: drop.prompt,
      kind: drop.kind,
      category: drop.category,
      responseCount: drop.responseCount,
      mine: drop.userId === me.id,
      responded: !!myResponse[0],
      myResponseId: myResponse[0]?.id ?? null,
      creator: creator[0] ?? { id: drop.userId, username: "?", displayName: "?", avatarUrl: null },
      responses: responses.map((r) => ({
        id: r.id,
        content: r.content,
        mediaUrl: r.mediaUrl,
        createdAt: r.createdAt.toISOString(),
        mine: r.userId === me.id,
        user: userById.get(r.userId) ?? { id: r.userId, username: "?", displayName: "?", avatarUrl: null },
      })),
    });
  });
}

function eqIn(ids: string[]) {
  return inArray(users.id, ids);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const parsed = z.object({
      type: z.enum(["respond", "remove_response"]),
      content: z.string().max(500).optional().default(""),
      mediaUrl: z.string().max(25_000_000).nullish(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid request.");
    const drop = (await db.select().from(drops).where(eq(drops.id, id)).limit(1))[0];
    if (!drop) throw new ApiError(404, "DROP not found.");

    if (parsed.data.type === "remove_response") {
      const [del] = await db.delete(dropResponses).where(and(eq(dropResponses.dropId, id), eq(dropResponses.userId, me.id))).returning();
      if (del) await db.update(drops).set({ responseCount: sql`GREATEST(0, ${drops.responseCount} - 1)` }).where(eq(drops.id, id));
      return ok();
    }

    const existing = (await db.select().from(dropResponses).where(and(eq(dropResponses.dropId, id), eq(dropResponses.userId, me.id))).limit(1))[0];
    if (existing) throw new ApiError(400, "You already responded to this DROP.");
    if (!parsed.data.content.trim() && !parsed.data.mediaUrl) throw new ApiError(400, "Add text or media to your response.");
    if (parsed.data.mediaUrl) {
      const err = validateMediaDataUrl(parsed.data.mediaUrl, parsed.data.mediaUrl.startsWith("data:video") ? "video" : "image");
      if (err) throw new ApiError(400, err);
    }
    const [r] = await db.insert(dropResponses).values({
      dropId: id, userId: me.id, content: parsed.data.content.trim(), mediaUrl: parsed.data.mediaUrl ?? null,
    }).returning();
    await db.update(drops).set({ responseCount: sql`${drops.responseCount} + 1` }).where(eq(drops.id, id));
    await notify(drop.userId, me.id, "drop", { dropId: id, text: parsed.data.content.slice(0, 60) });
    return ok({ id: r!.id });
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const drop = (await db.select().from(drops).where(eq(drops.id, id)).limit(1))[0];
    if (!drop) throw new ApiError(404, "DROP not found.");
    if (drop.userId !== me.id) throw new ApiError(403, "You can only delete your own DROPs.");
    await db.delete(drops).where(eq(drops.id, id));
    return ok();
  });
}
