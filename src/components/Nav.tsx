"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LynkLogo } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { Avatar, type SessionUser, useSession } from "@/components/ui";
import { api } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "Home" as const },
  { href: "/explore", label: "Explore", icon: "Compass" as const },
  { href: "/create", label: "Create", icon: "Plus" as const, accent: true },
  { href: "/lynks", label: "LYNKs", icon: "Link" as const },
  { href: "/rooms", label: "ROOMS", icon: "Users" as const },
  { href: "/drops", label: "DROPs", icon: "Zap" as const },
  { href: "/messages", label: "Messages", icon: "Chat" as const, badge: "msg" },
  { href: "/notifications", label: "Notifications", icon: "Bell" as const, badge: "notif" },
  { href: "/profile", label: "Profile", icon: "User" as const },
  { href: "/settings", label: "Settings", icon: "Settings" as const },
];



export function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setMe } = useSession();
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellItems, setBellItems] = useState<{ id: string; text: string; type: string; createdAt: string; avatarUrl: string; displayName: string; username: string }[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/profile") return pathname.startsWith("/profile/");
    if (href === "/home") return pathname === "/home";
    return pathname.startsWith(href);
  };

  // profile link points to own profile
  const profileHref = `/profile/${user.username}`;
  const items = NAV_ITEMS.map((i) => (i.href === "/profile" ? { ...i, href: profileHref } : i));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api<{ counts: { notifications: number; messages: number } }>("/api/notifications?counts=1");
        setNotifCount(res.counts.notifications);
        setMsgCount(res.counts.messages);
        const b = await api<{ items: { id: string; text: string; type: string; createdAt: string; avatarUrl: string; displayName: string; username: string }[] }>("/api/notifications?limit=6&onlyUnread=1");
        setBellItems(b.items);
      } catch {
        /* silent */
      }
    };
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    try {
      await api("/api/auth", { body: { action: "logout" } });
    } catch {}
    setMe(null);
    router.push("/login");
  };

  const name = user.username;
  const avatarSrc = user.avatarUrl;

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col border-r border-[color:var(--line)] bg-[color:var(--bg2)]/60 backdrop-blur-xl z-40">
        <div className="px-5 pt-6 pb-4">
          <Link href="/home" aria-label="LYNKZ home">
            <LynkLogo size={34} withWord />
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar" aria-label="Main">
          {items.map((item) => {
            const active = isActive(item.href);
            const badge = item.badge === "notif" ? notifCount : item.badge === "msg" ? msgCount : 0;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-tooltip={item.label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition relative",
                  active ? "grad text-white shadow-lg shadow-black/20" : "text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--text)]"
                )}
              >
                <IconComponent name={item.icon} size={20} className={cn(item.accent && "text-[color:var(--a2)]")} />
                <span className="tracking-wide">{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold grid place-items-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[color:var(--line)]">
          <div className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-white/6 transition">
            <Link href={profileHref} className="shrink-0">
              <Avatar src={avatarSrc} name={name} size={38} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold leading-tight">{user.displayName}</p>
              <p className="truncate text-xs text-[color:var(--muted)]">@{user.username}</p>
            </div>
            <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8 text-[color:var(--muted)] hover:text-rose-400 transition" aria-label="Log out" title="Log out">
              <Icon.Logout size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Tablet rail ---------- */}
      <aside className="hidden md:flex lg:hidden fixed inset-y-0 left-0 w-[76px] flex-col items-center border-r border-[color:var(--line)] bg-[color:var(--bg2)]/60 backdrop-blur-xl z-40 py-5">
        <Link href="/home" aria-label="LYNKZ home" className="mb-4">
          <LynkLogo size={30} />
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {items.slice(0, 7).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                aria-label={item.label}
                data-tooltip={item.label}
                className={cn(
                  "relative grid h-11 w-11 place-items-center rounded-xl transition",
                  active ? "grad text-white shadow" : "text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-white/6"
                )}
              >
                <IconComponent name={item.icon} size={20} />
                {(item.badge === "notif" ? notifCount : item.badge === "msg" ? msgCount : 0) > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-[color:var(--bg)]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            onClick={() => setMoreOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-xl text-[color:var(--muted)] hover:bg-white/8"
            aria-label="More"
            data-tooltip="More"
          >
            <Icon.Dots size={20} />
          </button>
          <Link href={profileHref} aria-label={name}>
            <Avatar src={avatarSrc} name={name} size={36} />
          </Link>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur-xl">
        <Link href="/home" aria-label="LYNKZ home">
          <LynkLogo size={28} withWord />
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className={cn("relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/8 transition", bellOpen && "bg-white/8")}
            aria-label={`Notifications${notifCount ? ` (${notifCount} unread)` : ""}`}
          >
            <Icon.Bell size={21} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
          <Link href={profileHref} aria-label={name}>
            <Avatar src={avatarSrc} name={name} size={34} />
          </Link>
        </div>
      </header>

      {/* ---------- Shared bell popover ---------- */}
      {bellOpen && (
        <div ref={bellRef} className={cn("fixed z-50 card w-[340px] max-w-[calc(100vw-2rem)] shadow-2xl modal-in bg-[color:var(--bg2)]", "top-16 right-4 lg:top-20 lg:right-6")}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--line)]">
            <p className="font-semibold text-sm">Notifications</p>
            <Link href="/notifications" onClick={() => setBellOpen(false)} className="text-xs font-semibold text-[color:var(--a2)] hover:underline">
              See all
            </Link>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {bellItems.length === 0 ? (
              <p className="p-6 text-center text-sm text-[color:var(--muted)]">No new notifications.</p>
            ) : (
              bellItems.slice(0, 5).map((n) => (
                <Link key={n.id} href="/notifications" onClick={() => setBellOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition">
                  <Avatar src={n.avatarUrl} name={n.displayName} size={34} />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug line-clamp-2">{n.text}</p>
                    <p className="text-[11px] text-[color:var(--muted)] mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------- More sheet (tablet) ---------- */}
      {moreOpen && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="More links">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-label="Close" />
          <div className="absolute right-4 top-20 card w-64 bg-[color:var(--bg2)] p-2 shadow-2xl modal-in">
            {items.slice(7).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium",
                  isActive(item.href) ? "grad text-white" : "text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--text)]"
                )}
              >
                <IconComponent name={item.icon} size={18} />
                {item.label}
              </Link>
            ))}
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10">
              <Icon.Logout size={18} /> Log out
            </button>
          </div>
        </div>
      )}

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[color:var(--line)] bg-[color:var(--bg)]/90 backdrop-blur-xl flex items-center justify-around h-16 px-1" aria-label="Mobile">
        <Link href="/home" aria-label="Home" aria-current={isActive("/home") ? "page" : undefined}
          className={cn("relative flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium", isActive("/home") ? "text-[color:var(--a2)]" : "text-[color:var(--muted)]")}>
          <Icon.Home size={21} /> Home
        </Link>
        <Link href="/explore" aria-label="Explore" aria-current={isActive("/explore") ? "page" : undefined}
          className={cn("relative flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium", isActive("/explore") ? "text-[color:var(--a2)]" : "text-[color:var(--muted)]")}>
          <Icon.Compass size={21} /> Explore
        </Link>
        <Link href="/create" aria-label="Create" className="relative -top-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl grad text-white shadow-lg shadow-black/30">
            <Icon.Plus size={24} />
          </span>
        </Link>
        <Link href="/messages" aria-label="Messages" aria-current={isActive("/messages") ? "page" : undefined}
          className={cn("relative flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium", isActive("/messages") ? "text-[color:var(--a2)]" : "text-[color:var(--muted)]")}>
          <Icon.Chat size={21} />
          Messages
          {msgCount > 0 && <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-rose-500" />}
        </Link>
        <Link href={profileHref} aria-label="Profile" aria-current={isActive(profileHref) ? "page" : undefined}
          className={cn("relative flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium", isActive(profileHref) ? "text-[color:var(--a2)]" : "text-[color:var(--muted)]")}>
          <Icon.User size={21} /> Profile
        </Link>
      </nav>
    </>
  );
}

function IconComponent({ name, size, className }: { name: keyof typeof Icon; size: number; className?: string }) {
  const C = Icon[name];
  return <C size={size} className={cn("shrink-0", className)} />;
}
