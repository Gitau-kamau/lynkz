"use client";

import Link from "next/link";
import { Avatar, EmptyState, Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, formatCount } from "@/lib/utils";

export const CATEGORY_COLORS: Record<string, string> = {
  Gaming: "from-violet-500/25 to-fuchsia-500/10 text-violet-300 border-violet-400/20",
  Music: "from-cyan-500/25 to-blue-500/10 text-cyan-300 border-cyan-400/20",
  School: "from-amber-500/25 to-orange-500/10 text-amber-300 border-amber-400/20",
  Sports: "from-emerald-500/25 to-teal-500/10 text-emerald-300 border-emerald-400/20",
  Technology: "from-blue-500/25 to-indigo-500/10 text-blue-300 border-blue-400/20",
  Fashion: "from-pink-500/25 to-rose-500/10 text-pink-300 border-pink-400/20",
  Movies: "from-red-500/25 to-orange-500/10 text-red-300 border-red-400/20",
  Local: "from-lime-500/25 to-emerald-500/10 text-lime-300 border-lime-400/20",
};

export function CategoryChip({ category, small }: { category: string; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-gradient-to-br font-semibold",
        small ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]",
        CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Local
      )}
    >
      <Icon.Hash size={small ? 9 : 11} />
      {category}
    </span>
  );
}

export type RoomDTO = {
  id: string;
  name: string;
  description: string;
  category: string;
  isClosed: boolean;
  memberCount: number;
  messageCount: number;
  createdAt: string;
  mine: boolean;
  joined: boolean;
  creator: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

export function RoomCard({ room }: { room: RoomDTO }) {
  return (
    <Link href={`/rooms/${room.id}`} className="card p-5 hover:border-[color:var(--a2)]/40 transition group block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-[15.5px] group-hover:text-[color:var(--a2)] transition truncate">
              {room.name}
            </h3>
            <CategoryChip category={room.category} small />
            {room.isClosed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-rose-300 border border-rose-400/20">
                <Icon.Lock size={9} /> Closed
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--muted)] line-clamp-2">{room.description || "No description."}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-[color:var(--a2)]">
          <Icon.Users size={20} />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <span className="flex -space-x-2">
            <Avatar src={room.creator.avatarUrl} name={room.creator.displayName} size={22} className="ring-2 ring-[color:var(--card)]" />
          </span>
          <span>
            {formatCount(room.memberCount)} members · {formatCount(room.messageCount)} posts
          </span>
        </div>
        <span className={cn("text-xs font-bold", room.joined ? "text-emerald-400" : "text-[color:var(--a2)]")}>
          {room.joined ? "Joined ✓" : "Join →"}
        </span>
      </div>
    </Link>
  );
}

export type DropDTO = {
  id: string;
  prompt: string;
  kind: string;
  category: string;
  responseCount: number;
  createdAt: string;
  mine: boolean;
  responded: boolean;
  creator: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

export function DropCard({ drop, compact }: { drop: DropDTO; compact?: boolean }) {
  return (
    <Link href={`/drops/${drop.id}`} className={cn("card block hover:border-[color:var(--a2)]/40 transition group", compact ? "p-4" : "p-5")}>
      <div className="flex items-center gap-2.5">
        <Avatar src={drop.creator.avatarUrl} name={drop.creator.displayName} size={compact ? 30 : 36} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-[color:var(--muted)] truncate">
            <b className="text-[color:var(--text)]">{drop.creator.displayName}</b> dropped
          </p>
        </div>
        <CategoryChip category={drop.category} small />
      </div>
      <p className={cn("mt-3 font-semibold leading-snug group-hover:text-[color:var(--a2)] transition line-clamp-2", compact ? "text-[14px]" : "text-[15.5px]")}>
        “{drop.prompt}”
      </p>
      <div className="mt-3 flex items-center gap-4 text-xs text-[color:var(--muted)]">
        <span className="flex items-center gap-1"><Icon.Zap size={12} className="text-amber-400" /> {formatCount(drop.responseCount)} responses</span>
        {drop.responded && <span className="font-semibold text-emerald-400">✓ You joined</span>}
        {drop.mine && <span className="font-semibold text-[color:var(--a2)]">Your drop</span>}
      </div>
    </Link>
  );
}

export function DropEmpty() {
  return (
    <EmptyState
      icon={<Icon.Zap size={24} />}
      title="No DROPs yet"
      desc="Drop a challenge or question and see who responds."
      action={
        <Link href="/create?tab=drop">
          <Button><Icon.Zap size={15} /> Start a DROP</Button>
        </Link>
      }
    />
  );
}

export function RoomsEmpty() {
  return (
    <EmptyState
      icon={<Icon.Users size={24} />}
      title="No rooms found"
      desc="Room up with people who share your interests."
      action={
        <Link href="/create?tab=room">
          <Button><Icon.Plus size={15} /> Create a room</Button>
        </Link>
      }
    />
  );
}
