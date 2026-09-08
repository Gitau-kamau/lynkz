import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { User } from "@/db/schema";

const COOKIE = "lynkz_session";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const ok = (data: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: true, ...data });

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hashStr: string) {
  return bcrypt.compare(pw, hashStr);
}

export async function createSession(userId: string, remember: boolean, req: Request) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(
    Date.now() + (remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24)
  );
  await db.insert(sessions).values({
    token: hash(token),
    userId,
    expiresAt: expires,
    userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? "",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 60) ?? "",
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, hash(token))).catch(() => {});
  }
  cookieStore.delete(COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, hash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user) return null;
  if (!user.isActive) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "You need to sign in.");
  if (user.isBanned) throw new ApiError(403, "This account has been suspended.");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ApiError(403, "Admin access required.");
  return user;
}

export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isVerified: u.isVerified,
    isAdmin: u.isAdmin,
    isPrivate: u.isPrivate,
    location: u.location,
    website: u.website,
    interests: u.interests,
    onboardingDone: u.onboardingDone,
    createdAt: u.createdAt,
    lastSeenAt: u.lastSeenAt,
  };
}

export async function mePayload(u: User) {
  return {
    user: {
      ...publicUser(u),
      email: u.email,
      prefs: (u.prefs ?? {}) as Record<string, unknown>,
    },
  };
}

/** Wrap a route handler with error handling + auth helpers. */
export function handle(fn: () => Promise<Response>) {
  return fn().catch((e: unknown) => {
    if (e instanceof ApiError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("[api]", e);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  });
}
