import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lynkReactions, lynkReplies, lynkViews, lynks, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const wantReplies = url.searchParams.get("replies") === "1";
    const rows = await db.select().from(lynks).where(eq(lynks.id, id)).limit(1);
    const l = rows[0];
    if (!l || l.deletedAt || l.expiresAt < new Date()) throw new ApiError(404, "LYNK not found or expired.");

    const author = (await db.select().from(users).where(eq(users.id, l.userId)).limit(1))[0];
    const reaction = (await db.select().from(lynkReactions).where(and(eq(lynkReactions.lynkId, id), eq(lynkReactions.userId, me.id))).limit(1))[0];
    const viewers = l.userId === me.id
      ? await db.select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
          .from(lynkViews).innerJoin(users, eq(users.id, lynkViews.userId))
          .where(eq(lynkViews.lynkId, id)).limit(24)
      : null;

    let replies: { id: string; content: string; createdAt: string; user: { username: string; displayName: string; avatarUrl: string | null } }[] = [];
    if (wantReplies) {
      replies = (await db
        .select({ id: lynkReplies.id, content: lynkReplies.content, createdAt: lynkReplies.createdAt, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(lynkReplies).innerJoin(users, eq(users.id, lynkReplies.userId))
        .where(eq(lynkReplies.lynkId, id)).orderBy(sql`${lynkReplies.createdAt} ASC`).limit(60))
        .map((r) => ({ id: r.id, content: r.content, createdAt: r.createdAt.toISOString(), user: { username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl } }));
    }

    return ok({
      lynk: {
        id: l.id, type: l.type, content: l.content, mediaUrl: l.mediaUrl, poll: l.poll, music: l.music,
        viewCount: l.viewCount, reactionCount: l.reactionCount, replyCount: l.replyCount,
        expiresAt: l.expiresAt.toISOString(), createdAt: l.createdAt.toISOString(),
        mine: l.userId === me.id, myReaction: reaction?.emoji ?? null, viewers,
        author: { id: author!.id, username: author!.username, displayName: author!.displayName, avatarUrl: author!.avatarUrl, isVerified: author!.isVerified },
      },
      replies,
    });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const parsed = z.object({
      type: z.enum(["view", "react", "reply", "vote", "delete"]),
      emoji: z.string().max(8).optional(),
      content: z.string().max(300).optional().default(""),
      option: z.number().int().optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid action.");

    const rows = await db.select().from(lynks).where(eq(lynks.id, id)).limit(1);
    const l = rows[0];
    if (!l || l.deletedAt || l.expiresAt < new Date()) throw new ApiError(404, "LYNK not found or expired.");
    if (await blockedBetween(me.id, l.userId)) throw new ApiError(403, "You can't interact with this account.");

    switch (parsed.data.type) {
      case "view": {
        const [v] = await db.insert(lynkViews).values({ lynkId: id, userId: me.id }).onConflictDoNothing().returning();
        if (v) await db.update(lynks).set({ viewCount: sql`${lynks.viewCount} + 1` }).where(eq(lynks.id, id));
        return ok();
      }
      case "react": {
        const emoji = parsed.data.emoji ?? "❤️";
        const existing = (await db.select().from(lynkReactions).where(and(eq(lynkReactions.lynkId, id), eq(lynkReactions.userId, me.id))).limit(1))[0];
        let reaction: string | null = null;
        let count = l.reactionCount;
        if (existing) {
          if (existing.emoji === emoji) {
            await db.delete(lynkReactions).where(eq(lynkReactions.id, existing.id));
            count = Math.max(0, count - 1);
          } else {
            await db.update(lynkReactions).set({ emoji }).where(eq(lynkReactions.id, existing.id));
            reaction = emoji;
          }
        } else {
          await db.insert(lynkReactions).values({ lynkId: id, userId: me.id, emoji });
          count = count + 1;
          reaction = emoji;
          await notify(l.userId, me.id, "lynk_reaction", { lynkId: id });
        }
        await db.update(lynks).set({ reactionCount: count }).where(eq(lynks.id, id));
        return ok({ reaction, count });
      }
      case "reply": {
        const content = parsed.data.content.trim();
        if (!content) throw new ApiError(400, "Reply can't be empty.");
        await db.insert(lynkReplies).values({ lynkId: id, userId: me.id, content });
        await db.update(lynks).set({ replyCount: sql`${lynks.replyCount} + 1` }).where(eq(lynks.id, id));
        await notify(l.userId, me.id, "lynk_reaction", { lynkId: id, text: content.slice(0, 60) });
        return ok({ count: l.replyCount + 1 });
      }
      case "vote": {
        if (!l.poll) throw new ApiError(400, "This LYNK has no poll.");
        const opts = (l.poll as { options: string[] }).options;
        const opt = parsed.data.option;
        if (opt === undefined || opt < 0 || opt >= opts.length) throw new ApiError(400, "Invalid option.");
        const poll = l.poll as { question: string; options: string[]; votes: number[] };
        // track votes inside the poll jsonb for simplicity (single vote per user is enforced client-side)
        const votes = [...poll.votes];
        votes[opt] = (votes[opt] ?? 0) + 1;
        await db.update(lynks).set({ poll: { ...poll, votes } }).where(eq(lynks.id, id));
        return ok();
      }
      case "delete": {
        if (l.userId !== me.id) throw new ApiError(403, "You can only delete your own LYNKs.");
        await db.update(lynks).set({ deletedAt: new Date() }).where(eq(lynks.id, id));
        return ok();
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
}
