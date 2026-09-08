import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, posts, users } from "@/db/schema";
import { ApiError, handle, ok, requireUser } from "@/lib/auth";
import { blockedBetween, notify } from "@/lib/notify";
import { commentDTO, getPostById } from "@/lib/posts";
import { parseMentions } from "@/lib/utils";

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const parsed = z.object({
      postId: z.string().uuid(),
      content: z.string().min(1, "Comment can't be empty.").max(500),
      parentId: z.string().uuid().nullish(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid comment.");
    const d = parsed.data;

    const post = await getPostById(d.postId);
    if (!post || post.deletedAt) throw new ApiError(404, "Post not found.");
    if (await blockedBetween(me.id, post.authorId)) throw new ApiError(403, "You can't interact with this account.");
    if (d.parentId) {
      const parents = await db.select().from(comments).where(eq(comments.id, d.parentId)).limit(1);
      if (!parents[0] || parents[0].postId !== d.postId) throw new ApiError(400, "Invalid reply target.");
    }
    const [c] = await db
      .insert(comments)
      .values({ postId: d.postId, authorId: me.id, content: d.content.trim(), parentId: d.parentId ?? null })
      .returning();
    await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, d.postId));
    await notify(post.authorId, me.id, d.parentId ? "reply" : "comment", { postId: d.postId, text: d.content });
    if (d.parentId) {
      const parent = await db.select().from(comments).where(eq(comments.id, d.parentId)).limit(1);
      if (parent[0]) await notify(parent[0].authorId, me.id, "reply", { postId: d.postId, text: d.content });
    }
    for (const uname of parseMentions(d.content)) {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, uname)).limit(1);
      const target = rows[0];
      if (target) await notify(target.id, me.id, "mention", { postId: d.postId, text: d.content });
    }
    return ok({ item: await commentDTO(c!.id, me.id) });
  });
}
