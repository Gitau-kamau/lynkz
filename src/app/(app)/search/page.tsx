"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Input, Tabs, toast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, useDebounced } from "@/lib/client";
import { formatCount, timeAgo } from "@/lib/utils";
import { CategoryChip, DropCard, RoomCard, type DropDTO, type RoomDTO } from "@/components/cards";
import { FollowButton } from "@/components/interact";
import type { PostDTO } from "@/components/PostCard";
import PostCard from "@/components/PostCard";

type SearchResults = {
  users: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string; isVerified: boolean; isPrivate: boolean; following: boolean; pending: boolean }[];
  posts: PostDTO[];
  hashtags: { name: string; postCount: number }[];
  rooms: RoomDTO[];
  drops: DropDTO[];
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const [tab, setTab] = useState("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // recent searches in localStorage
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("lynkz-recent-searches") ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  const saveRecent = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem("lynkz-recent-searches", JSON.stringify(next)); } catch { /* ignore */ }
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem("lynkz-recent-searches"); } catch { /* ignore */ }
  };

  const search = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`);
      setResults(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dq.trim().length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    search(dq);
  }, [dq, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasResults =
    (results?.users.length ?? 0) + (results?.posts.length ?? 0) + (results?.hashtags.length ?? 0) +
    (results?.rooms.length ?? 0) + (results?.drops.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Icon.Search size={20} className="text-[color:var(--a2)]" /> Search
      </h1>

      <div className="relative">
        <Icon.Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users, posts, hashtags, rooms, drops…"
          className="pl-10 py-3"
          aria-label="Search LYNKZ"
        />
      </div>

      {!q.trim() && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13.5px] font-bold flex items-center gap-2"><Icon.Clock size={15} className="text-[color:var(--muted)]" /> Recent searches</p>
            {recent.length > 0 && (
              <button onClick={clearRecent} className="text-[12px] font-semibold text-[color:var(--muted)] hover:text-rose-400">Clear all</button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-[color:var(--muted)] py-2">Search for people, hashtags, rooms or drops. Try “gaming” or “naya”.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} onClick={() => { setQ(r); saveRecent(r); }} className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] hover:border-[color:var(--a2)]/50">
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-center text-sm text-[color:var(--muted)] py-10" role="status">Searching…</p>}
      {error && <div className="card p-6 text-center text-sm text-rose-400">{error}</div>}

      {results && !loading && (
        <>
          {!hasResults && (
            <div className="card">
              <EmptyState icon={<Icon.Search size={24} />} title="No results found" desc={`Nothing matched “${dq}”. Try different keywords.`} />
            </div>
          )}

          <Tabs
            tabs={[
              { id: "all", label: "All" },
              { id: "users", label: `People (${results.users.length})` },
              { id: "posts", label: `Posts (${results.posts.length})` },
              { id: "hashtags", label: `Hashtags (${results.hashtags.length})` },
              { id: "rooms", label: `Rooms (${results.rooms.length})` },
              { id: "drops", label: `DROPs (${results.drops.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />

          {(tab === "all" || tab === "users") && results.users.length > 0 && (
            <div className="card p-3">
              <p className="px-2 pt-1 pb-2 text-[13px] font-bold">People</p>
              {results.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-2 py-2.5">
                  <Link href={`/profile/${u.username}`} className="flex flex-1 items-center gap-3 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.displayName} size={40} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold truncate">{u.displayName} {u.isVerified && <Icon.Check size={12} className="inline text-[color:var(--a2)]" />}</span>
                      <span className="block text-xs text-[color:var(--muted)] truncate">@{u.username}{u.isPrivate && " · Private"}</span>
                    </span>
                  </Link>
                  <FollowButton userId={u.id} initial={u.following} initialPending={u.pending} size="sm" />
                </div>
              ))}
            </div>
          )}

          {(tab === "all" || tab === "posts") && results.posts.length > 0 && (
            <div className="space-y-3">
              {results.posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          )}

          {(tab === "all" || tab === "hashtags") && results.hashtags.length > 0 && (
            <div className="card p-4">
              <p className="text-[13px] font-bold mb-2">Hashtags</p>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map((h) => (
                  <Link key={h.name} href={`/hashtag/${h.name}`} className="rounded-xl border border-[color:var(--line)] px-3 py-2 hover:border-[color:var(--a2)]/50">
                    <span className="block text-[13px] font-bold text-[color:var(--a2)]">#{h.name}</span>
                    <span className="block text-[11px] text-[color:var(--muted)]">{formatCount(h.postCount)} posts</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(tab === "all" || tab === "rooms") && results.rooms.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {results.rooms.map((r) => <RoomCard key={r.id} room={r} />)}
            </div>
          )}

          {(tab === "all" || tab === "drops") && results.drops.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {results.drops.map((d) => <DropCard key={d.id} drop={d} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
