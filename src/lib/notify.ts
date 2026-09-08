import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, mutes, notifications, users } from "@/db/schema";

type NotifType =
  | "like" | "comment" | "reply" | "repost" | "mention"
  | "follow" | "follow_request" | "follow_accepted"
  | "message" | "lynk_reaction" | "room" | "drop" | "save";

const TYPE_KEYS: Record<NotifType, string> = {
  like: "likes",
  comment: "comments",
  reply: "comments",
  repost: "comments",
  mention: "mentions",
  follow: "followers",
  follow_request: "followers",
  follow_accepted: "followers",
  message: "messages",
  lynk_reaction: "lynks",
  room: "rooms",
  drop: "drops",
  save: "saves",
};

export async function blockedBetween(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function mutedSet(userId: string): Promise<Set<string>> {
  const rows = await db.select({ id: mutes.id, mutedId: mutes.mutedId }).from(mutes)
    .where(eq(mutes.muterId, userId));
  return new Set(rows.map((r) => r.mutedId));
}

export async function notifAllowed(userId: string, type: NotifType): Promise<boolean> {
  const rows = await db.select({ prefs: users.prefs }).from(users).where(eq(users.id, userId)).limit(1);
  const prefs = (rows[0]?.prefs ?? {}) as { notif?: Record<string, boolean> };
  return prefs.notif?.[TYPE_KEYS[type]] !== false;
}

export async function notify(
  userId: string | null | undefined,
  actorId: string,
  type: NotifType,
  data: {
    postId?: string | null;
    roomId?: string | null;
    lynkId?: string | null;
    dropId?: string | null;
    text?: string;
  } = {}
) {
  if (!userId || userId === actorId) return;
  if (await blockedBetween(userId, actorId)) return;
  if (!(await notifAllowed(userId, type))) return;
  const actor = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  const name = actor[0]?.displayName ?? "Someone";
  const texts: Record<NotifType, string> = {
    like: `${name} liked your post`,
    comment: `${name} commented: {{extra}}`,
    reply: `${name} replied to a comment`,
    repost: `${name} reposted your post`,
    mention: `${name} mentioned you`,
    follow: `${name} started following you`,
    follow_request: `${name} requested to follow you`,
    follow_accepted: `${name} accepted your follow request`,
    message: `${name} sent you a message`,
    lynk_reaction: `${name} reacted to your LYNK`,
    room: `${name} posted in a room you're in`,
    drop: `${name} responded to your LYNK DROP`,
    save: `${name} shared your post`,
  };
  let text = texts[type];
  if (type === "comment" && data.text) {
    const snippet = data.text.replace(/\s+/g, " ").slice(0, 60);
    text = `${name} commented: ${snippet}${data.text.length > 60 ? "…" : ""}`;
  }
  await db.insert(notifications).values({
    userId,
    actorId,
    type,
    postId: data.postId ?? null,
    roomId: data.roomId ?? null,
    lynkId: data.lynkId ?? null,
    dropId: data.dropId ?? null,
    text,
  });
}
