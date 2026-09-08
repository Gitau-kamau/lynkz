"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, Segmented, Skeleton, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { formatCount, timeAgo } from "@/lib/utils";
import { LynkEmpty, LynkViewer, type LynkDTO } from "@/components/Lynks";

export default function LynksPage() {
  const { me } = useSession();
  const [scope, setScope] = useState("following");
  const [items, setItems] = useState<LynkDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const res = await api<{ items: LynkDTO[] }>(`/api/lynks?scope=${scope}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load LYNKs.");
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const onChanged = (u: LynkDTO) => setItems((ls) => ls?.map((l) => (l.id === u.id ? u : l)) ?? ls);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Link size={20} className="text-[color:var(--a2)]" /> LYNKs
        </h1>
        <Link href="/create?tab=lynk"><Button size="sm"><Icon.Plus size={14} /> New LYNK</Button></Link>
      </div>
      <p className="text-[13px] text-[color:var(--muted)] -mt-2">
        ⚡ LYNKs are temporary — every {`one`} disappears after 24 hours.
      </p>
      <Segmented value={scope} onChange={(v) => setScope(v)} options={["Following", "For You", "Mine"]} />

      {error ? (
        <div className="card"><ErrorState msg={error} onRetry={load} /></div>
      ) : items === null ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          {scope === "mine" ? (
            <EmptyState icon={<Icon.Link size={24} />} title="You haven't posted a LYNK" desc="Drop a photo, a question or a song — it vanishes in 24h, no pressure." action={<Link href="/create?tab=lynk"><Button><Icon.Plus size={15} /> Create a LYNK</Button></Link>} />
          ) : (
            <LynkEmpty />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {items.map((l, i) => (
            <button key={l.id} onClick={() => setIdx(i)} className="group relative aspect-square overflow-hidden rounded-3xl border border-[color:var(--line)] bg-white/4 transition hover:border-[color:var(--a2)]/50" aria-label={`View LYNK by ${l.author.displayName}`}>
              {l.mediaUrl && l.type !== "poll" && l.type !== "text" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="text-center px-2">
                    <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl grad text-white">
                      {l.type === "poll" ? <Icon.Poll size={17} /> : l.type === "music" ? <Icon.Music size={17} /> : l.type === "question" ? <Icon.Question size={17} /> : l.type === "video" ? <Icon.Play size={17} /> : <Icon.At size={17} />}
                    </span>
                    <span className="block text-[11px] font-semibold line-clamp-2">{l.content || l.type}</span>
                  </span>
                </span>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-left">
                <span className="block text-[11px] font-bold text-white truncate">{l.author.displayName}</span>
                <span className="flex items-center gap-2 text-[9.5px] text-white/70">
                  <span className="flex items-center gap-0.5"><Icon.Eye size={9} /> {formatCount(l.viewCount)}</span>
                  <span className="flex items-center gap-0.5"><Icon.Heart size={9} /> {formatCount(l.reactionCount)}</span>
                  <span>{timeAgo(l.createdAt)}</span>
                  {l.expiresAt && new Date(l.expiresAt).getTime() < Date.now() + 2 * 3600000 && <span className="text-amber-300">· ending soon</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {idx !== null && items && <LynkViewer lynks={items} startIndex={idx} onClose={() => setIdx(null)} onChanged={onChanged} />}
    </div>
  );
}
