"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, ErrorState, Skeleton, Tabs, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { CATEGORIES, formatCount } from "@/lib/utils";
import { CategoryChip, DropCard, RoomCard, type DropDTO, type RoomDTO } from "@/components/cards";
import { FollowButton, UserRow } from "@/components/interact";
import type { PostDTO } from "@/components/PostCard";

type ExploreData = {
  hashtags: { name: string; postCount: number }[];
  users: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string; isVerified: boolean; isPrivate: boolean; following: boolean; pending: boolean }[];
  posts: PostDTO[];
  lynks: { id: string; type: string; content: string; author: { username: string; displayName: string; avatarUrl: string | null }; viewCount: number }[];
  rooms: RoomDTO[];
  drops: DropDTO[];
};

export default function ExplorePage() {
  const { me } = useSession();
  const [data, setData] = useState<ExploreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("trending");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<ExploreData>("/api/explore");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load explore.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Compass size={20} className="text-[color:var(--a2)]" /> Explore
        </h1>
        <Link href="/search" className="btn h-9 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-white/4 px-3.5 text-[13px] font-medium text-[color:var(--muted)] hover:bg-white/8 inline-flex">
          <Icon.Search size={15} /> Search
        </Link>
      </div>

      {error ? (
        <div className="card"><ErrorState msg={error} onRetry={load} /></div>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          {/* categories + hashtags */}
          <section className="card p-4" aria-label="Trending hashtags">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-[14px] font-bold"><Icon.Hash size={16} className="text-[color:var(--a2)]" /> Trending hashtags</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.hashtags.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">No hashtags yet.</p>}
              {data.hashtags.map((h) => (
                <Link
                  key={h.name}
                  href={`/hashtag/${h.name}`}
                  className="rounded-2xl border border-[color:var(--line)] bg-white/4 px-3.5 py-2.5 transition hover:border-[color:var(--a2)]/50 hover:bg-white/8"
                >
                  <span className="block text-[13.5px] font-bold text-[color:var(--a2)]">#{h.name}</span>
                  <span className="block text-[11px] text-[color:var(--muted)]">{formatCount(h.postCount)} posts</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[color:var(--line)] pt-3">
              {CATEGORIES.map((c) => (
                <Link key={c} href={`/rooms?category=${encodeURIComponent(c)}`}>
                  <CategoryChip category={c} />
                </Link>
              ))}
            </div>
          </section>

          <Tabs
            tabs={[
              { id: "trending", label: "🔥 Trending" },
              { id: "creators", label: "✨ Creators" },
              { id: "lynks", label: "⚡ LYNKs" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "trending" && (
            <section aria-label="Trending posts">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.posts.filter((p) => p.media.length > 0).map((p) => (
                  <Link
                    key={p.id}
                    href={`/profile/${p.author.username}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-white/5"
                    aria-label={`Post by ${p.author.username}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.media[0]!.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    {p.media.length > 1 && (
                      <span className="absolute top-2 right-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <Icon.Image size={10} className="inline mr-0.5" />{p.media.length}
                      </span>
                    )}
                    <span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
                      <Icon.HeartFill size={10} className="text-rose-400" /> {formatCount(p.likeCount)}
                    </span>
                  </Link>
                ))}
                {data.posts.filter((p) => p.media.length > 0).length === 0 && (
                  <p className="col-span-3 text-center text-sm text-[color:var(--muted)] py-8">Trending media will appear here.</p>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {data.posts.slice(0, 2).map((p) => (
                  <PostPreview key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}

          {tab === "creators" && (
            <section className="card p-4" aria-label="Suggested creators">
              <h2 className="flex items-center gap-2 text-[14px] font-bold mb-2"><Icon.Sparkles size={16} className="text-[color:var(--a1)]" /> Suggested creators</h2>
              {data.users.filter((u) => u.id !== me?.id).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  right={<FollowButton userId={u.id} initial={u.following} initialPending={u.pending} size="sm" />}
                />
              ))}
              {data.users.length === 0 && <p className="text-[13px] text-[color:var(--muted)] py-4 text-center">No suggestions right now.</p>}
            </section>
          )}

          {tab === "lynks" && (
            <section className="space-y-3" aria-label="Popular LYNKs">
              {data.lynks.slice(0, 8).map((l) => (
                <Link key={l.id} href="/lynks" className="card flex items-center gap-3 p-4 hover:border-[color:var(--a2)]/40 transition">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl grad text-white shrink-0">
                    {l.type === "photo" || l.type === "video" ? <Icon.Camera size={18} /> : l.type === "poll" ? <Icon.Poll size={18} /> : l.type === "music" ? <Icon.Music size={18} /> : l.type === "question" ? <Icon.Question size={18} /> : <Icon.Link size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold truncate">{l.content || `${l.author.displayName}'s ${l.type} LYNK`}</p>
                    <p className="text-[11.5px] text-[color:var(--muted)]">@{l.author.username} · {formatCount(l.viewCount)} views</p>
                  </div>
                  <span className="text-xs font-bold text-[color:var(--a2)]">View →</span>
                </Link>
              ))}
              {data.lynks.length === 0 && <p className="text-center text-sm text-[color:var(--muted)] py-6">No popular LYNKs right now.</p>}
            </section>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <section aria-label="Popular rooms">
              <h2 className="flex items-center gap-2 text-[14px] font-bold mb-2.5">
                <Icon.Users size={16} className="text-[color:var(--a1)]" /> Popular LYNK ROOMS
              </h2>
              <div className="space-y-3">
                {data.rooms.slice(0, 3).map((r) => <RoomCard key={r.id} room={r} />)}
                {data.rooms.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">No rooms yet — create the first one.</p>}
              </div>
            </section>
            <section aria-label="Trending drops">
              <h2 className="flex items-center gap-2 text-[14px] font-bold mb-2.5">
                <Icon.Zap size={16} className="text-amber-400" /> Trending DROPs
              </h2>
              <div className="space-y-3">
                {data.drops.slice(0, 3).map((d) => <DropCard key={d.id} drop={d} compact />)}
                {data.drops.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">No drops yet — drop the first challenge.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function PostPreview({ post }: { post: PostDTO }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={38} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">
          {post.author.displayName} <span className="text-[color:var(--muted)] font-normal">· @{post.author.username}</span>
        </p>
        <p className="text-[13.5px] mt-1 line-clamp-2">{post.content}</p>
        <div className="mt-2 flex gap-4 text-[12px] text-[color:var(--muted)]">
          <span className="flex items-center gap-1"><Icon.Heart size={13} className="text-rose-400" /> {formatCount(post.likeCount)}</span>
          <span className="flex items-center gap-1"><Icon.Comment size={13} /> {formatCount(post.commentCount)}</span>
          <span className="flex items-center gap-1"><Icon.Eye size={13} /> {formatCount(post.viewCount)}</span>
        </div>
      </div>
    </div>
  );
}

