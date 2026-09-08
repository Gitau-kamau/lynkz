import { z } from "zod";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";

const REASONS = ["Spam", "Harassment", "Hate speech", "Violence", "Sexual content", "Scams", "Other"];

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({
      targetType: z.enum(["user", "post", "comment", "message", "room", "lynk", "drop"]),
      targetId: z.string().uuid(),
      reason: z.string().min(1).max(60),
      details: z.string().max(500).optional().default(""),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid report.");
    if (!REASONS.includes(parsed.data.reason)) throw new ApiError(400, "Invalid reason.");
    await db.insert(reports).values({
      reporterId: me.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details.trim(),
    });
    return ok();
  });
}
