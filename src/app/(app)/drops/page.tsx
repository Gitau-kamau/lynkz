"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { CATEGORIES, cn } from "@/lib/utils";
import { DropCard, DropEmpty, type DropDTO } from "@/components/cards";

export default function DropsPage() {
  const [tab, setTab] = useState("trending");
  const [category, setCategory] = useState("All");
  const [items, setItems] = useState<DropDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    const q = new URLSearchParams({ tab });
    if (category !== "All") q.set("category", category);
    try {
      const res = await api<{ items: DropDTO[] }>(`/api/drops?${q}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load DROPs.");
    }
  }, [tab, category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Zap size={20} className="text-amber-400" /> LYNK DROPs
        </h1>
        <Link href="/create?tab=drop"><Button size="sm"><Icon.Zap size={14} /> Drop one</Button></Link>
      </div>
      <p className="text-[13px] text-[color:var(--muted)] -mt-2">Challenges and prompts. Drop yours — see who answers.</p>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {["trending", "latest", "mine"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-bold capitalize border transition",
              tab === t ? "grad text-white border-transparent" : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)]/50"
            )}
          >
            {t}
          </button>
        ))}
        <span className="mx-1 w-px bg-[color:var(--line)]" aria-hidden />
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition",
              category === c ? "border-[color:var(--a2)] text-[color:var(--a2)]" : "border-[color:var(--line)] text-[color:var(--muted)]"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card"><ErrorState msg={error} onRetry={load} /></div>
      ) : items === null ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card"><DropEmpty /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((d) => <DropCard key={d.id} drop={d} />)}
        </div>
      )}
    </div>
  );
}
