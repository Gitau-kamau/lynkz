import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { validateMediaDataUrl } from "@/lib/utils";

const schema = z.object({
  avatar: z.string().nullish(),
  bio: z.string().max(160).optional().default(""),
  interests: z.array(z.string().max(24)).max(10).optional().default([]),
  followIds: z.array(z.string().uuid()).max(12).optional().default([]),
  skip: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid input.");
    const d = parsed.data;
    if (d.avatar) {
      const err = validateMediaDataUrl(d.avatar, "image");
      if (err) throw new ApiError(400, err);
    }
    const updates: Record<string, unknown> = {
      onboardingDone: true,
      bio: d.bio,
      interests: d.interests,
    };
    if (d.avatar) updates.avatarUrl = d.avatar;
    await db.update(users).set(updates).where(eq(users.id, me.id));

    for (const targetId of d.followIds) {
      if (targetId === me.id) continue;
      const target = await db.select({ id: users.id, isPrivate: users.isPrivate }).from(users).where(eq(users.id, targetId)).limit(1);
      if (!target[0]) continue;
      const status = target[0].isPrivate ? "pending" : "accepted";
      await db
        .insert(follows)
        .values({ followerId: me.id, followingId: targetId, status })
        .onConflictDoNothing();
    }
    return ok();
  });
}
