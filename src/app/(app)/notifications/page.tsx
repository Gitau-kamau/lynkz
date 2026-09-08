"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, EmptyState, ErrorState, Tabs, toast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  text: string;
  isRead: boolean;
  createdAt: string;
  postId: string | null;
  roomId: string | null;
  lynkId: string | null;
  dropId: string | null;
  actor: { username: string; displayName: string; avatarUrl: string | null } | null;
};

const TYPE_ICON: Record<string, { icon: keyof typeof Icon; cls: string }> = {
  like: { icon: "HeartFill", cls: "text-rose-400" },
  comment: { icon: "Comment", cls: "text-cyan-400" },
  reply: { icon: "Reply", cls: "text-cyan-400" },
  repost: { icon: "Repeat", cls: "text-emerald-400" },
  mention: { icon: "At", cls: "text-purple-400" },
  follow: { icon: "User", cls: "text-emerald-400" },
  follow_request: { icon: "User", cls: "text-amber-400" },
  follow_accepted: { icon: "Check", cls: "text-emerald-400" },
  message: { icon: "Chat", cls: "text-[color:var(--a2)]" },
  lynk_reaction: { icon: "Link", cls: "text-[color:var(--a2)]" },
  room: { icon: "Users", cls: "text-violet-400" },
  drop: { icon: "Zap", cls: "text-amber-400" },
  save: { icon: "Bookmark", cls: "text-amber-400" },
};

export default function NotificationsPage() {
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<Notif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<{ items: Notif[] }>("/api/notifications?limit=50");
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    try {
      await api("/api/notifications", { body: { type: "read_all" } });
      setItems((p) => p?.map((n) => ({ ...n, isRead: true })) ?? p);
      toast("All notifications marked as read.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update.", "err");
    }
  };

  const filtered = items?.filter((n) => tab === "all" || n.type === tab || (tab === "follows" && (n.type === "follow" || n.type === "follow_request" || n.type === "follow_accepted"))) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Icon.Bell size={20} className="text-[color:var(--a2)]" /> Notifications
        </h1>
        <Button variant="soft" size="sm" onClick={markAll}>Mark all read</Button>
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "like", label: "Likes" },
          { id: "comment", label: "Comments" },
          { id: "follows", label: "Followers" },
          { id: "message", label: "Messages" },
          { id: "lynk_reaction", label: "LYNKs" },
          { id: "room", label: "Rooms" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <div className="card"><ErrorState msg={error} onRetry={load} /></div>
      ) : filtered === null ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Icon.Bell size={24} />}
            title={tab === "all" ? "No notifications yet" : "Nothing here"}
            desc="Likes, comments, followers, room chats and DROP activity will show up here."
            action={
              <Link href="/explore"><Button variant="soft"><Icon.Compass size={15} /> Explore</Button></Link>
            }
          />
        </div>
      ) : (
        <div className="card divide-y divide-[color:var(--line)]">
          {filtered.map((n) => {
            const meta = TYPE_ICON[n.type] ?? TYPE_ICON.like!;
            const href = n.postId ? "/home" : n.roomId ? `/rooms/${n.roomId}` : n.lynkId ? "/lynks" : n.dropId ? "/drops" : n.actor ? `/profile/${n.actor.username}` : "/home";
            return (
              <Link key={n.id} href={href} className={`flex items-start gap-3.5 px-4 py-3.5 hover:bg-white/4 transition ${n.isRead ? "" : "bg-[color:var(--a1)]/6"}`}>
                <span className="relative shrink-0">
                  <Avatar src={n.actor?.avatarUrl} name={n.actor?.displayName ?? "LYNKZ"} size={42} />
                  <span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--card)] ${meta.cls}`}>
                    <IconComponent name={meta.icon} size={11} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13.5px] leading-snug ${n.isRead ? "" : "font-semibold"}`}>{n.text}</p>
                  <p className="mt-0.5 text-[11.5px] text-[color:var(--muted)]">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full grad shrink-0" aria-label="Unread" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconComponent({ name, size }: { name: keyof typeof Icon; size: number }) {
  const C = Icon[name];
  return <C size={size} />;
}
