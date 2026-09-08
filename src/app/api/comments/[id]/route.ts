import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, commentLikes, posts } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const parsed = z.object({ type: z.enum(["like", "unlike"]) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "Invalid action.");
    const found = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    const c = found[0];
    if (!c || c.deletedAt) throw new ApiError(404, "Comment not found.");
    if (parsed.data.type === "like") {
      const [ins] = await db.insert(commentLikes).values({ commentId: id, userId: me.id }).onConflictDoNothing().returning();
      if (ins) await db.update(comments).set({ likeCount: sql`${comments.likeCount} + 1` }).where(eq(comments.id, id));
    } else {
      const [del] = await db.delete(commentLikes).where(and(eq(commentLikes.commentId, id), eq(commentLikes.userId, me.id))).returning();
      if (del) await db.update(comments).set({ likeCount: sql`GREATEST(0, ${comments.likeCount} - 1)` }).where(eq(comments.id, id));
    }
    return ok();
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const found = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    const c = found[0];
    if (!c) throw new ApiError(404, "Comment not found.");
    if (c.authorId !== me.id && !me.isAdmin) throw new ApiError(403, "You can only delete your own comments.");
    await db.update(comments).set({ deletedAt: new Date(), content: "[deleted]" }).where(eq(comments.id, id));
    await db.update(posts).set({ commentCount: sql`GREATEST(0, ${posts.commentCount} - 1)` }).where(eq(posts.id, c.postId));
    return ok();
  });
}
