"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, ErrorState, Skeleton, toast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { formatCount, timeAgo } from "@/lib/utils";
import { LynkLogo } from "@/components/Logo";
import Link from "next/link";

type Stats = {
  users: number;
  activeUsers: number;
  posts: number;
  comments: number;
  messages: number;
  pendingReports: number;
  rooms: number;
  drops: number;
  lynks: number;
};
type AdminUser = { id: string; username: string; displayName: string; avatarUrl: string | null; email: string; isActive: boolean; isBanned: boolean; isAdmin: boolean; createdAt: string; followers: number };
type AdminPost = { id: string; content: string; authorUsername: string; likeCount: number; commentCount: number; createdAt: string };
type AdminReport = { id: string; targetType: string; targetId: string; reason: string; details: string; status: string; createdAt: string; reporterUsername: string };
type AdminRoom = { id: string; name: string; category: string; isClosed: boolean; memberCount: number; creatorUsername: string };

const TABS = ["stats", "users", "posts", "reports", "rooms"] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (which: (typeof TABS)[number]) => {
    setError(null);
    setBusy(null);
    try {
      const res = await api<{ stats: Stats; users: AdminUser[]; posts: AdminPost[]; reports: AdminReport[]; rooms: AdminRoom[] }>(`/api/admin?view=${which}`);
      if (res.stats) setStats(res.stats);
      if (res.users) setUsers(res.users);
      if (res.posts) setPosts(res.posts);
      if (res.reports) setReports(res.reports);
      if (res.rooms) setRooms(res.rooms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin access denied.");
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const act = async (action: string, id?: string, extra?: Record<string, unknown>) => {
    setBusy(action + id);
    try {
      await api("/api/admin", { body: { action, id, ...extra } });
      toast("Done.");
      load(tab);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "err");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="card max-w-md w-full">
          <ErrorState msg={error} onRetry={() => load(tab)} />
          <div className="flex justify-center pb-8">
            <Link href="/home" className="text-sm font-semibold text-[color:var(--a2)] hover:underline">Back to LYNKZ →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <LynkLogo size={34} />
            <div>
              <h1 className="font-display text-xl font-bold flex items-center gap-2">
                <Icon.Shield size={18} className="text-[color:var(--a2)]" /> Admin console
              </h1>
              <p className="text-[12px] text-[color:var(--muted)]">LYNKZ moderation &amp; platform management</p>
            </div>
          </div>
          <Link href="/home" className="btn h-9 items-center rounded-xl border border-[color:var(--line)] px-3.5 text-[13px] font-semibold inline-flex hover:bg-white/6">← Back to app</Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={t === tab ? "grad shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold text-white capitalize" : "shrink-0 rounded-xl border border-[color:var(--line)] px-4 py-2 text-[13px] font-semibold capitalize text-[color:var(--muted)] hover:text-[color:var(--text)]"}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "stats" && (
          <>
            {!stats ? (
              <div className="grid sm:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <StatCard label="Total users" value={stats.users} icon={<Icon.User size={18} />} />
                  <StatCard label="Active users" value={stats.activeUsers} icon={<Icon.Sparkles size={18} />} />
                  <StatCard label="Total posts" value={stats.posts} icon={<Icon.Home size={18} />} />
                  <StatCard label="Comments" value={stats.comments} icon={<Icon.Comment size={18} />} />
                  <StatCard label="Messages" value={stats.messages} icon={<Icon.Chat size={18} />} />
                  <StatCard label="Open reports" value={stats.pendingReports} icon={<Icon.Flag size={18} />} danger={stats.pendingReports > 0} />
                  <StatCard label="Rooms" value={stats.rooms} icon={<Icon.Users size={18} />} />
                  <StatCard label="DROPs" value={stats.drops} icon={<Icon.Zap size={18} />} />
                  <StatCard label="Active LYNKs" value={stats.lynks} icon={<Icon.Link size={18} />} />
                </div>
                <div className="card p-5 text-[13px] text-[color:var(--muted)] leading-relaxed">
                  <b className="text-[color:var(--text)]">Moderation checklist:</b> review open reports, check flagged posts, manage users.
                  Reports allow suspending or banning accounts and removing content.
                </div>
              </>
            )}
          </>
        )}

        {tab === "users" && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-[color:var(--line)] text-left text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                <th className="px-4 py-3">User</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Followers</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {users === null && <tr><td colSpan={5} className="px-4 py-8 text-center text-[color:var(--muted)]">Loading…</td></tr>}
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-[color:var(--line)]/50 hover:bg-white/3">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={u.avatarUrl} name={u.displayName} size={30} />
                        <div>
                          <p className="font-semibold">{u.displayName}</p>
                          <p className="text-[11px] text-[color:var(--muted)]">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{u.email}</td>
                    <td className="px-4 py-3">{formatCount(u.followers)}</td>
                    <td className="px-4 py-3">
                      <span className={u.isBanned ? "rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-400" : u.isActive ? "rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400" : "rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400"}>
                        {u.isBanned ? "Banned" : u.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="soft" loading={busy === "suspend" + u.id} onClick={() => act(u.isActive ? "suspend" : "lift_suspend", u.id)}>{u.isActive ? "Suspend" : "Lift"}</Button>
                        <Button size="sm" variant={u.isBanned ? "soft" : "danger"} loading={busy === "ban" + u.id} onClick={() => act(u.isBanned ? "unban" : "ban", u.id)}>{u.isBanned ? "Unban" : "Ban"}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-2">
            {posts === null && <Skeleton className="h-40" />}
            {posts?.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] line-clamp-2">{p.content || "(media post)"}</p>
                  <p className="text-[11.5px] text-[color:var(--muted)]">@{p.authorUsername} · {timeAgo(p.createdAt)} · ♥ {formatCount(p.likeCount)} · 💬 {formatCount(p.commentCount)}</p>
                </div>
                <Button size="sm" variant="danger" loading={busy === "delete_post" + p.id} onClick={() => act("delete_post", p.id)}>
                  <Icon.Trash size={13} /> Remove
                </Button>
              </div>
            ))}
            {posts?.length === 0 && <p className="text-center text-sm text-[color:var(--muted)] py-8">No posts found.</p>}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-2">
            {reports === null && <Skeleton className="h-40" />}
            {reports?.map((r) => (
              <div key={r.id} className="card px-4 py-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[13px]">
                      <b className="text-rose-400">{r.reason}</b> · {r.targetType} · reported by <b>@{r.reporterUsername}</b> · {timeAgo(r.createdAt)}
                    </p>
                    {r.details && <p className="text-[12.5px] text-[color:var(--muted)] mt-0.5">“{r.details}”</p>}
                    <p className="text-[11px] text-[color:var(--muted)] mt-0.5">target: {r.targetId}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {r.targetType === "post" && <Button size="sm" variant="danger" loading={busy === "delete_post" + r.targetId} onClick={() => act("delete_post", r.targetId)}>Remove post</Button>}
                    {r.targetType === "comment" && <Button size="sm" variant="danger" loading={busy === "delete_comment" + r.targetId} onClick={() => act("delete_comment", r.targetId)}>Remove comment</Button>}
                    {r.targetType === "room" && <Button size="sm" variant="danger" loading={busy === "close_room" + r.targetId} onClick={() => act("close_room", r.targetId)}>Close room</Button>}
                    {r.targetType === "user" && <Button size="sm" variant="danger" loading={busy === "suspend" + r.targetId} onClick={() => act("suspend", r.targetId)}>Suspend user</Button>}
                    <Button size="sm" variant="soft" loading={busy === "resolve" + r.id} onClick={() => act("resolve_report", r.id)}>Resolve</Button>
                    <Button size="sm" variant="ghost" loading={busy === "dismiss" + r.id} onClick={() => act("dismiss_report", r.id)}>Dismiss</Button>
                  </div>
                </div>
              </div>
            ))}
            {reports?.length === 0 && (
              <div className="card p-8 text-center text-sm text-[color:var(--muted)]">No reports — all clear! 🎉</div>
            )}
          </div>
        )}

        {tab === "rooms" && (
          <div className="space-y-2">
            {rooms === null && <Skeleton className="h-40" />}
            {rooms?.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-[color:var(--a1)]"><Icon.Users size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold truncate">{r.name} {r.isClosed && <span className="ml-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">CLOSED</span>}</p>
                  <p className="text-[11.5px] text-[color:var(--muted)]">{r.category} · {r.memberCount} members · by @{r.creatorUsername}</p>
                </div>
                <Button size="sm" variant="soft" loading={busy === "close_room" + r.id} onClick={() => act(r.isClosed ? "reopen_room" : "close_room", r.id)}>{r.isClosed ? "Reopen" : "Close"}</Button>
                <Button size="sm" variant="danger" loading={busy === "delete_room" + r.id} onClick={() => act("delete_room", r.id)}><Icon.Trash size={13} /></Button>
              </div>
            ))}
            {rooms?.length === 0 && <p className="text-center text-sm text-[color:var(--muted)] py-8">No rooms yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, danger }: { label: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${danger ? "bg-rose-500/15 text-rose-400" : "bg-white/5 text-[color:var(--a2)]"}`}>{icon}</span>
      <div>
        <p className="font-display text-2xl font-bold">{formatCount(value)}</p>
        <p className="text-[12px] text-[color:var(--muted)]">{label}</p>
      </div>
    </div>
  );
}

