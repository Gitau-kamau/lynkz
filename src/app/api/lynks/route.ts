import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { follows, lynks, lynkReactions, lynkViews, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedIds } from "@/lib/posts";
import { validateMediaDataUrl } from "@/lib/utils";

function serializeLynk(l: typeof lynks.$inferSelect, author: typeof users.$inferSelect, viewerId: string, myReaction: string | null, viewers: { username: string; displayName: string; avatarUrl: string | null }[] | null = null) {
  return {
    id: l.id,
    type: l.type,
    content: l.content,
    mediaUrl: l.mediaUrl,
    poll: l.poll,
    music: l.music,
    viewCount: l.viewCount,
    reactionCount: l.reactionCount,
    replyCount: l.replyCount,
    expiresAt: l.expiresAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
    mine: l.userId === viewerId,
    myReaction,
    viewers,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      isVerified: author.isVerified,
    },
  };
}

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "home";
    const userParam = url.searchParams.get("user");

    const blocked = await blockedIds(me.id);
    const activeCond = and(gt(lynks.expiresAt, new Date()), sql`${lynks.deletedAt} IS NULL`);

    let rows: (typeof lynks.$inferSelect)[] = [];
    if (scope === "user" && userParam) {
      const u = (await db.select().from(users).where(eq(users.username, userParam.toLowerCase())).limit(1))[0];
      if (!u) throw new ApiError(404, "User not found.");
      rows = await db.select().from(lynks)
        .where(and(eq(lynks.userId, u.id), activeCond, u.id === me.id ? sql`true` : sql`${lynks.userId} = ANY((SELECT following_id FROM follows WHERE follower_id = ${me.id} AND status = 'accepted')::uuid[]) OR ${lynks.userId} = ${me.id}`))
        .orderBy(desc(lynks.createdAt))
        .limit(30);
    } else if (scope === "mine") {
      rows = await db.select().from(lynks).where(and(eq(lynks.userId, me.id), activeCond)).orderBy(desc(lynks.createdAt)).limit(30);
    } else if (scope === "all") {
      rows = await db.select().from(lynks)
        .where(and(activeCond, blocked.length ? ne(lynks.userId, sql`ANY(${blocked}::uuid[])`) : sql`true`))
        .orderBy(desc(lynks.viewCount))
        .limit(30);
    } else {
      // home: mine + followed (seeded) + popular others
      const followed = await db.select({ id: follows.followingId }).from(follows).where(and(eq(follows.followerId, me.id), eq(follows.status, "accepted")));
      const followedIds = [...new Set([me.id, ...followed.map((f) => f.id)])];
      const mine = await db.select().from(lynks).where(and(inArray(lynks.userId, followedIds), activeCond)).orderBy(desc(lynks.createdAt)).limit(20);
      const others = await db.select().from(lynks)
        .where(and(
          activeCond,
          followedIds.length ? ne(lynks.userId, sql`ANY(${followedIds}::uuid[])`) : sql`false`,
          blocked.length ? ne(lynks.userId, sql`ANY(${blocked}::uuid[])`) : sql`true`
        ))
        .orderBy(desc(lynks.viewCount))
        .limit(8);
      rows = [...mine, ...others];
    }

    const authorIds = [...new Set(rows.map((r) => r.userId))];
    const authors = authorIds.length ? await db.select().from(users).where(inArray(users.id, authorIds)) : [];
    const authorById = new Map(authors.map((u) => [u.id, u]));
    const reactions = rows.length
      ? await db.select().from(lynkReactions).where(and(inArray(lynkReactions.lynkId, rows.map((r) => r.id)), eq(lynkReactions.userId, me.id)))
      : [];
    const reactionByLynk = new Map(reactions.map((r) => [r.lynkId, r.emoji]));

    return ok({
      items: rows.map((l) => {
        const author = authorById.get(l.userId);
        if (!author) return null;
        return serializeLynk(l, author, me.id, reactionByLynk.get(l.id) ?? null);
      }).filter(Boolean),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({
      type: z.enum(["photo", "video", "text", "poll", "question", "music"]),
      content: z.string().max(500).optional().default(""),
      mediaUrl: z.string().max(25_000_000).nullish(),
      poll: z.object({
        question: z.string().min(1).max(200),
        options: z.array(z.string().min(1).max(100)).min(2).max(4),
      }).nullish(),
      music: z.object({ title: z.string().min(1).max(150), artist: z.string().max(150).optional().default("") }).nullish(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid LYNK.");
    const d = parsed.data;

    if ((d.type === "photo" || d.type === "video") && !d.mediaUrl) throw new ApiError(400, `${d.type} LYNKs need media.`);
    if (d.mediaUrl) {
      const err = validateMediaDataUrl(d.mediaUrl, d.type === "video" || d.mediaUrl.startsWith("data:video") ? "video" : "image");
      if (err) throw new ApiError(400, err);
    }
    if (d.type === "poll" && !d.poll) throw new ApiError(400, "Poll LYNKs need a question and options.");
    if (d.type === "music" && !d.music && !d.content.trim()) throw new ApiError(400, "Music LYNKs need a song.");

    const expires = new Date(Date.now() + 24 * 3600 * 1000);
    const [l] = await db.insert(lynks).values({
      userId: me.id,
      type: d.type,
      content: d.content.trim(),
      mediaUrl: d.mediaUrl ?? null,
      poll: d.poll ? { question: d.poll.question, options: d.poll.options.map((o) => o.trim()), votes: new Array(d.poll.options.length).fill(0) } : null,
      music: d.music ?? null,
      expiresAt: expires,
    }).returning();
    return ok({ id: l!.id });
  });
}
