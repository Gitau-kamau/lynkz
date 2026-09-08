import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError, createSession, destroySession, handle, hashPassword, mePayload, ok, requireUser, verifyPassword } from "@/lib/auth";
import { validateMediaDataUrl } from "@/lib/utils";

export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    if (url.searchParams.get("view") === "full") {
      const sess = await db.select().from(sessions).where(eq(sessions.userId, me.id)).orderBy(sql`${sessions.createdAt} DESC`);
      const currentHashed = (await import("next/headers")).cookies().then(async (c) => {
        const t = c.get("lynkz_session")?.value;
        if (!t) return null;
        const { createHash } = await import("crypto");
        return createHash("sha256").update(t).digest("hex");
      });
      const cur = await currentHashed;
      return ok({
        prefs: me.prefs,
        sessions: sess.map((s) => ({
          token: s.token,
          userAgent: s.userAgent,
          ip: s.ip,
          createdAt: s.createdAt.toISOString(),
          current: s.token === cur,
        })),
      });
    }
    return ok({ prefs: me.prefs });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string }).action;

    if (action === "update_profile") {
      const parsed = z.object({
        displayName: z.string().min(2).max(60),
        username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, "Invalid username."),
        email: z.string().email(),
        bio: z.string().max(160).optional().default(""),
        website: z.string().max(120).optional().default(""),
        location: z.string().max(80).optional().default(""),
        avatarUrl: z.string().max(25_000_000).nullish(),
      }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid input.");
      const d = parsed.data;
      const username = d.username.toLowerCase();
      const email = d.email.toLowerCase();
      const clash = await db.select().from(users)
        .where(and(eq(users.id, me.id), sql`false`));
      void clash;
      const unameClash = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), ne(users.id, me.id))).limit(1);
      if (unameClash[0]) throw new ApiError(400, "That username is taken.");
      const emailClash = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, me.id))).limit(1);
      if (emailClash[0]) throw new ApiError(400, "That email is already in use.");
      if (d.avatarUrl) {
        const err = validateMediaDataUrl(d.avatarUrl, "image");
        if (err) throw new ApiError(400, err);
      }
      const [u] = await db.update(users).set({
        displayName: d.displayName.trim(),
        username,
        email,
        bio: d.bio,
        website: d.website,
        location: d.location,
        avatarUrl: d.avatarUrl ?? me.avatarUrl,
      }).where(eq(users.id, me.id)).returning();
      const m = await mePayload(u!);
      return ok({ user: m.user });
    }

    if (action === "privacy") {
      const parsed = z.object({
        isPrivate: z.boolean(),
        messaging: z.string().optional(),
        mentions: z.string().optional(),
        tags: z.string().optional(),
      }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid privacy settings.");
      const prefs = { ...(me.prefs as Record<string, unknown>), messaging: parsed.data.messaging, mentions: parsed.data.mentions, tags: parsed.data.tags };
      await db.update(users).set({ isPrivate: parsed.data.isPrivate, prefs }).where(eq(users.id, me.id));
      return ok();
    }

    if (action === "notifications") {
      const parsed = z.object({ notif: z.record(z.string(), z.boolean()) }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid notification settings.");
      const prefs = { ...(me.prefs as Record<string, unknown>), notif: parsed.data.notif };
      await db.update(users).set({ prefs }).where(eq(users.id, me.id));
      return ok();
    }

    if (action === "password") {
      const parsed = z.object({ current: z.string(), password: z.string().min(8) }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "New password must be at least 8 characters.");
      if (!(await verifyPassword(parsed.data.current, me.passwordHash))) throw new ApiError(400, "Current password is incorrect.");
      await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, me.id));
      return ok();
    }

    if (action === "revoke_session") {
      const token = z.string().parse((body as { token?: string }).token ?? "");
      await db.delete(sessions).where(eq(sessions.token, token));
      return ok();
    }

    if (action === "deactivate") {
      await db.update(users).set({ isActive: false }).where(eq(users.id, me.id));
      await destroySession();
      return ok();
    }

    if (action === "delete_account") {
      await db.delete(users).where(eq(users.id, me.id));
      await destroySession();
      return ok();
    }

    throw new ApiError(400, "Unknown action.");
  });
}
