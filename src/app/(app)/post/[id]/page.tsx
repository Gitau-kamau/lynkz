"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, PageLoader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import PostCard, { type PostDTO } from "@/components/PostCard";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<{ post: PostDTO; comments: unknown[] }>(`/api/posts/${id}?comments=1`);
      setPost(res.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load post.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="card">
        <ErrorState msg={error} onRetry={load} />
        <div className="flex justify-center pb-6">
          <Link href="/home"><Button variant="ghost" size="sm"><Icon.ChevronL size={14} /> Back to feed</Button></Link>
        </div>
      </div>
    );
  }
  if (!post) return <PageLoader label="Loading post…" />;
  return (
    <div className="space-y-3">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)]">
        <Icon.ChevronL size={15} /> Back to feed
      </Link>
      <PostCard post={post} onUpdate={setPost} showAllComments />
    </div>
  );
}

export const _ = EmptyState;
