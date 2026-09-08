import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blocks, follows, mutes, posts, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";
import { blockedIds } from "@/lib/posts";

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { username } = await ctx.params;
    const url = new URL(req.url);
    const list = url.searchParams.get("list");

    const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
    const u = rows[0];
    if (!u) throw new ApiError(404, "User not found.");
    if (await blockedBetween(me.id, u.id)) {
      return ok({
        user: { id: u.id, username: u.username, displayName: u.displayName, isVerified: u.isVerified, isPrivate: u.isPrivate, blocked: true },
        me: { following: false, pending: false, blocked: true, muted: false, requests: [] },
        canView: false,
        list: [],
      });
    }

    const [followersCount, followingCount, postsCount, followRel, blockRel, muteRel, blockedByMe] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(follows).where(and(eq(follows.followingId, u.id), eq(follows.status, "accepted"))),
      db.select({ c: sql<number>`count(*)::int` }).from(follows).where(and(eq(follows.followerId, u.id), eq(follows.status, "accepted"))),
      db.select({ c: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.authorId, u.id), sql`${posts.deletedAt} IS NULL`)),
      db.select().from(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, u.id))).limit(1),
      db.select().from(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, u.id))).limit(1),
      db.select().from(mutes).where(and(eq(mutes.muterId, me.id), eq(mutes.mutedId, u.id))).limit(1),
      db.select().from(blocks).where(and(eq(blocks.blockerId, u.id), eq(blocks.blockedId, me.id))).limit(1),
    ]);

    // pending follow requests TO this user (only if I am this user)
    const requests = u.id === me.id
      ? await db
          .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followerId))
          .where(and(eq(follows.followingId, u.id), eq(follows.status, "pending")))
          .limit(20)
      : [];

    const canView = u.id === me.id || !u.isPrivate || (followRel[0]?.status === "accepted");

    const base = {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      coverUrl: u.coverUrl,
      bio: u.bio,
      website: u.website,
      location: u.location,
      isVerified: u.isVerified,
      isPrivate: u.isPrivate,
      createdAt: u.createdAt.toISOString(),
      online: !!u.lastSeenAt && u.lastSeenAt.getTime() > Date.now() - 2 * 60_000,
      followers: followersCount[0]?.c ?? 0,
      following: followingCount[0]?.c ?? 0,
      postsCount: postsCount[0]?.c ?? 0,
    };

    if (list) {
      const isFollowers = list === "followers";
      const rel = isFollowers ? follows.followerId : follows.followingId;
      const target = isFollowers ? follows.followingId : follows.followerId;
      const listRows = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(follows)
        .innerJoin(users, eq(users.id, rel))
        .where(and(eq(target, u.id), eq(follows.status, "accepted")))
        .limit(60);
      return ok({ user: base, me: followMailbox(me, u, followRel, blockRel, muteRel, requests, blockedByMe), canView, list: listRows });
    }

    return ok({ user: base, me: followMailbox(me, u, followRel, blockRel, muteRel, requests, blockedByMe), canView });
  });
}

function followMailbox(
  me: typeof users.$inferSelect, u: typeof users.$inferSelect,
  followRel: { status: string }[], blockRel: unknown[], muteRel: unknown[],
  requests: unknown[], blockedByMe: unknown[]
) {
  void me;
  return {
    following: followRel[0]?.status === "accepted",
    pending: followRel[0]?.status === "pending",
    blocked: blockRel.length > 0,
    muted: muteRel.length > 0,
    requests,
    iBlockedThem: blockedByMe.length > 0,
    isSelf: u.id === me.id,
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ username: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { username } = await ctx.params;
    const parsed = z.object({ type: z.string(), emoji: z.string().optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid action.");
    const { type } = parsed.data;
    const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
    const u = rows[0];
    if (!u) throw new ApiError(404, "User not found.");
    if (!me.isAdmin && type.startsWith("admin_")) throw new ApiError(403, "Not allowed.");

    switch (type) {
      case "follow": {
        if (u.id === me.id) throw new ApiError(400, "You can't follow yourself.");
        if (await blockedBetween(me.id, u.id)) throw new ApiError(403, "You can't follow this account.");
        const status = u.isPrivate ? "pending" : "accepted";
        const [f] = await db.insert(follows).values({ followerId: me.id, followingId: u.id, status }).onConflictDoNothing().returning();
        if (f) await notify(u.id, me.id, status === "pending" ? "follow_request" : "follow");
        return ok({ pending: status === "pending" });
      }
      case "unfollow": {
        await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, u.id)));
        return ok({ pending: false });
      }
      case "accept":
      case "reject": {
        if (u.id !== me.id) throw new ApiError(403, "You can only respond to your own requests.");
        if (type === "accept") {
          const [f2] = await db.update(follows).set({ status: "accepted" })
            .where(and(eq(follows.followingId, me.id), eq(follows.followerId, username))).returning();
          void f2;
          // notify requester
          const requester = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
          if (requester[0]) await notify(requester[0].id, me.id, "follow_accepted");
        } else {
          await db.delete(follows).where(and(eq(follows.followingId, me.id), eq(follows.followerId, username)));
        }
        return ok();
      }
      case "block": {
        if (u.id === me.id) throw new ApiError(400, "You can't block yourself.");
        await db.insert(blocks).values({ blockerId: me.id, blockedId: u.id }).onConflictDoNothing();
        await db.delete(follows).where(or(
          and(eq(follows.followerId, me.id), eq(follows.followingId, u.id)),
          and(eq(follows.followerId, u.id), eq(follows.followingId, me.id))
        ));
        return ok();
      }
      case "unblock":
        await db.delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, u.id)));
        return ok();
      case "mute":
        await db.insert(mutes).values({ muterId: me.id, mutedId: u.id }).onConflictDoNothing();
        return ok();
      case "unmute":
        await db.delete(mutes).where(and(eq(mutes.muterId, me.id), eq(mutes.mutedId, u.id)));
        return ok();
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
}
