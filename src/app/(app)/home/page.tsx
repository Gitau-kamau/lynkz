"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PostCard, { type PostDTO } from "@/components/PostCard";
import { LynkStrip, LynkViewer, type LynkDTO } from "@/components/Lynks";
import { Button, EmptyState, ErrorState, FeedSkeleton, Segmented, useInfinite } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";

export default function HomePage() {
  const [tab, setTab] = useState("following");
  const [lynks, setLynks] = useState<LynkDTO[]>([]);
  const [lynkIdx, setLynkIdx] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const q = new URLSearchParams({ type: tab, limit: "8" });
      if (cursor) q.set("cursor", cursor);
      const res = await api<{ items: PostDTO[]; next: string | null }>(`/api/posts?${q}`);
      return { items: res.items, next: res.next };
    },
    [tab]
  );

  const { items: posts, loading, loadingMore, error, done, sentinelRef, retry, refresh } = useInfinite(fetchPage);

  const loadLynks = useCallback(async () => {
    try {
      const res = await api<{ items: LynkDTO[] }>("/api/lynks?scope=home");
      setLynks(res.items);
    } catch {
      setLynks([]);
    }
  }, []);

  useEffect(() => {
    loadLynks();
  }, [loadLynks]);

  const update = (p: PostDTO) =>
    refresh;
  const onUpdate = (p: PostDTO) => {
    // handled by refetch on refresh; optimistic update via key replacement:
    window.dispatchEvent(new CustomEvent("lynkz-post-update", { detail: p }));
  };

  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<PostDTO>).detail;
      setPostPatch(p);
    };
    window.addEventListener("lynkz-post-update", on);
    return () => window.removeEventListener("lynkz-post-update", on);
  }, []);

  const [patch, setPostPatch] = useState<PostDTO | null>(null);
  const rendered = patch ? posts.map((p) => (p.id === patch.id ? patch : p)) : posts;

  const onLynkChanged = (u: LynkDTO) => setLynks((ls) => ls.map((l) => (l.id === u.id ? u : l)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Home size={20} className="text-[color:var(--a2)]" /> Home
        </h1>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v)}
          options={["Following", "For You"]}
        />
      </div>

      <LynkStrip lynks={lynks} onOpen={(i) => setLynkIdx(i)} />
      {lynkIdx !== null && (
        <LynkViewer lynks={lynks} startIndex={lynkIdx} onClose={() => setLynkIdx(null)} onChanged={onLynkChanged} />
      )}

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="card">
          <ErrorState msg={error} onRetry={retry} />
        </div>
      ) : rendered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Icon.Sparkles size={24} />}
            title={tab === "following" ? "Start following people to build your feed" : "Nothing trending yet"}
            desc={
              tab === "following"
                ? "Follow creators or explore trending content to fill your feed."
                : "Check back soon — content with the most engagement appears here."
            }
            action={
              <div className="flex gap-2">
                <Link href="/explore">
                  <Button variant="soft"><Icon.Compass size={15} /> Explore</Button>
                </Link>
                <Link href="/create">
                  <Button><Icon.Plus size={15} /> Create post</Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {rendered.map((p, i) => (
            <PostCard key={(p.repostedBy ? "r-" : "p-") + p.id + i} post={p} onUpdate={onUpdate} />
          ))}
          {loadingMore && <p className="text-center text-xs text-[color:var(--muted)] py-4">Loading more…</p>}
          {done && rendered.length > 5 && (
            <p className="text-center text-xs text-[color:var(--muted)] py-4">
              You're all caught up ✨{" "}
              <button onClick={() => { loadLynks(); refresh(); }} className="font-semibold text-[color:var(--a2)] hover:underline">
                Refresh
              </button>
            </p>
          )}
          <div ref={sentinelRef} aria-hidden className="h-px" />
        </>
      )}
    </div>
  );
}
