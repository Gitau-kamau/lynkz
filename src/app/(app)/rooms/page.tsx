"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { CATEGORIES, cn } from "@/lib/utils";
import { RoomsEmpty, RoomCard, type RoomDTO } from "@/components/cards";

function RoomsInner() {
  const params = useSearchParams();
  const initialCat = params.get("category") ?? "All";
  const [category, setCategory] = useState(initialCat);
  const [items, setItems] = useState<RoomDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const q = category === "All" ? "" : `?category=${encodeURIComponent(category)}`;
      const res = await api<{ items: RoomDTO[] }>(`/api/rooms${q}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rooms.");
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Users size={20} className="text-[color:var(--a1)]" /> LYNK ROOMS
        </h1>
        <Link href="/create?tab=room"><Button size="sm"><Icon.Plus size={14} /> Create room</Button></Link>
      </div>
      <p className="text-[13px] text-[color:var(--muted)] -mt-2">Temporary communities around topics you care about. Jump in, talk, connect.</p>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold border transition",
              category === c ? "grad text-white border-transparent" : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)]/50"
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
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card"><RoomsEmpty /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((r) => <RoomCard key={r.id} room={r} />)}
        </div>
      )}
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense>
      <RoomsInner />
    </Suspense>
  );
}
