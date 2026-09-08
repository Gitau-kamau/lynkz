"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, FeedSkeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { formatCount } from "@/lib/utils";
import PostCard, { type PostDTO } from "@/components/PostCard";

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<PostDTO[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setPosts(null);
    try {
      const res = await api<{ items: PostDTO[]; count: number }>(`/api/posts?type=hashtag&tag=${encodeURIComponent(tag)}&limit=20`);
      setPosts(res.items);
      setCount(res.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load hashtag.");
    }
  }, [tag]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl grad text-white text-2xl font-bold">#</span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold truncate">#{tag}</h1>
          <p className="text-[13px] text-[color:var(--muted)]">{count === null ? "Loading…" : `${formatCount(count)} public posts`}</p>
        </div>
        <Link href="/create" className="ml-auto">
          <Button size="sm"><Icon.Plus size={14} /> Post with #{tag}</Button>
        </Link>
      </div>

      {error ? (
        <div className="card"><ErrorState msg={error} onRetry={load} /></div>
      ) : posts === null ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Icon.Hash size={24} />}
            title="No posts with this hashtag yet"
            desc={`Be the first to post with #${tag}`}
            action={<Link href="/create"><Button><Icon.Plus size={15} /> Create a post</Button></Link>}
          />
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onUpdate={(np) => setPosts((ps) => ps?.map((x) => (x.id === np.id ? np : x)) ?? ps)} />)
      )}
    </div>
  );
}
