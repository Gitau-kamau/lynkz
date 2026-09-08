import { createHash, randomBytes } from "crypto";
import { and, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { resetTokens, sessions, users } from "@/db/schema";
import {
  createSession, destroySession, handle, hashPassword, mePayload,
  ok, publicUser, requireUser, verifyPassword, ApiError,
} from "@/lib/auth";
import { validateMediaDataUrl } from "@/lib/utils";

const registerSchema = z.object({
  action: z.literal("register"),
  displayName: z.string().min(2, "Please enter your full name.").max(60),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, "Username must be 3-20 characters (letters, numbers, underscores)."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  avatar: z.string().nullish(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string }).action;

    if (action === "register") {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid input.");
      const d = parsed.data;
      if (d.avatar) {
        const err = validateMediaDataUrl(d.avatar, "image");
        if (err) throw new ApiError(400, err);
      }
      const existing = await db
        .select({ username: users.username, email: users.email })
        .from(users)
        .where(or(eq(users.username, d.username.toLowerCase()), eq(users.email, d.email.toLowerCase())))
        .limit(2);
      if (existing.some((e) => e.username === d.username.toLowerCase())) throw new ApiError(400, "That username is taken.");
      if (existing.some((e) => e.email === d.email.toLowerCase())) throw new ApiError(400, "An account with this email already exists.");
      const [u] = await db
        .insert(users)
        .values({
          username: d.username.toLowerCase(),
          email: d.email.toLowerCase(),
          displayName: d.displayName.trim(),
          passwordHash: await hashPassword(d.password),
          avatarUrl: d.avatar ?? null,
        })
        .returning();
      await createSession(u!.id, true, req);
      return ok(await mePayload(u!));
    }

    if (action === "login") {
      const parsed = z.object({
        identifier: z.string().min(1),
        password: z.string().min(1),
        remember: z.boolean().optional().default(true),
      }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Please enter your email or username and password.");
      const { identifier, password, remember } = parsed.data;
      const idn = identifier.toLowerCase().replace(/^@/, "");
      const rows = await db
        .select()
        .from(users)
        .where(or(eq(users.username, idn), eq(users.email, idn)))
        .limit(1);
      const u = rows[0];
      if (!u || !(await verifyPassword(password, u.passwordHash)))
        throw new ApiError(401, "Incorrect email/username or password.");
      if (u.isBanned) throw new ApiError(403, "This account has been banned.");
      if (!u.isActive) throw new ApiError(403, "This account is deactivated.");
      await createSession(u.id, remember, req);
      return ok({ ...(await mePayload(u)), onboardingDone: u.onboardingDone });
    }

    if (action === "logout") {
      await destroySession();
      return ok();
    }

    if (action === "forgot") {
      const parsed = z.object({ email: z.string().email() }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Enter a valid email.");
      const rows = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
      const u = rows[0];
      if (!u) throw new ApiError(404, "No account found with that email.");
      const raw = randomBytes(5).toString("hex").toUpperCase();
      const expires = new Date(Date.now() + 30 * 60 * 1000);
      await db.insert(resetTokens).values({ userId: u.id, tokenHash: hashToken(raw), expiresAt: expires });
      // Demo limitation: no email service — the token is returned so the flow remains usable.
      return ok({ demoToken: raw });
    }

    if (action === "reset") {
      const parsed = z.object({ token: z.string().min(4), password: z.string().min(8) }).safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid token or password too short.");
      const rows = await db
        .select({ rt: resetTokens, email: users.email })
        .from(resetTokens)
        .innerJoin(users, eq(users.id, resetTokens.userId))
        .where(and(eq(resetTokens.tokenHash, hashToken(parsed.data.token)), gt(resetTokens.expiresAt, new Date())))
        .limit(1);
      const r = rows[0];
      if (!r) throw new ApiError(400, "Invalid or expired reset code.");
      await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, r.rt.userId));
      await db.delete(resetTokens).where(eq(resetTokens.userId, r.rt.userId));
      await db.delete(sessions).where(eq(sessions.userId, r.rt.userId));
      return ok();
    }

    if (action === "heartbeat") {
      const me = await requireUser();
      if (!me.lastSeenAt || me.lastSeenAt.getTime() < Date.now() - 60_000) {
        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, me.id));
      }
      return ok();
    }

    throw new ApiError(400, "Unknown action.");
  });
}

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    if (!me.lastSeenAt || me.lastSeenAt.getTime() < Date.now() - 60_000) {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, me.id));
    }
    return ok(await mePayload(me));
  });
}

function hashToken(t: string) {
  return createHash("sha256").update(t.toLowerCase()).digest("hex");
}

// keep publicUser referenced for potential use
void publicUser;
