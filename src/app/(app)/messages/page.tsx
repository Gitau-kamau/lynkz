"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Avatar, Button, EmptyState, Input, Skeleton, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { clockTime, timeAgo } from "@/lib/utils";

export type ConvoDTO = {
  id: string;
  lastMessage: { content: string; mediaUrl: string | null; senderId: string; createdAt: string } | null;
  unread: number;
  other: { id: string; username: string; displayName: string; avatarUrl: string | null; online: boolean };
  typing: boolean;
};

function MessagesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useSession();
  const [convos, setConvos] = useState<ConvoDTO[] | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: ConvoDTO[] }>("/api/messages");
      setConvos(res.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load conversations.", "err");
      setConvos([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 7000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const q = params.get("to");
    if (!q) return;
    // from a "Message" button — open or create conversation
    (async () => {
      try {
        await api("/api/messages", { body: { to: q } });
        router.replace("/messages");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not start chat.", "err");
        router.replace("/messages");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api<{ users: { id: string; username: string; displayName: string; avatarUrl: string | null }[] }>(
        `/api/users?q=${encodeURIComponent(q)}&limit=6`
      );
      setResults(res.users.filter((u) => u.id !== me?.id));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [me?.id]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  const startChat = async (username: string) => {
    try {
      const res = await api<{ id: string }>("/api/messages", { body: { to: username } });
      router.push(`/messages/${res.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not start chat.", "err");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Icon.Chat size={20} className="text-[color:var(--a2)]" /> Messages
      </h1>

      <div className="relative">
        <Icon.Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people to message…"
          className="pl-10"
          aria-label="Search people"
        />
        {(searching || results.length > 0) && search.trim() && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1.5 card bg-[color:var(--bg2)] p-1.5 shadow-2xl max-h-72 overflow-y-auto">
            {searching && <p className="p-3 text-xs text-[color:var(--muted)]">Searching…</p>}
            {results.map((u) => (
              <button key={u.id} onClick={() => startChat(u.username)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/6">
                <Avatar src={u.avatarUrl} name={u.displayName} size={34} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold truncate">{u.displayName}</span>
                  <span className="block text-xs text-[color:var(--muted)]">@{u.username}</span>
                </span>
                <Icon.ChevronR size={15} className="ml-auto text-[color:var(--muted)]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {convos === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px]" />)}
        </div>
      ) : convos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Icon.Chat size={24} />}
            title="No messages yet"
            desc="Search for people above or visit a profile and hit Message to start a conversation."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {convos.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="card flex items-center gap-3.5 p-4 hover:border-[color:var(--a2)]/40 transition"
            >
              <Avatar src={c.other.avatarUrl} name={c.other.displayName} size={48} online={c.other.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[14px] truncate">{c.other.displayName}</p>
                  {c.lastMessage && (
                    <span className="text-[11px] text-[color:var(--muted)] shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-[13px] text-[color:var(--muted)] truncate mt-0.5">
                  {c.typing ? (
                    <span className="text-[color:var(--a2)] font-semibold">typing…</span>
                  ) : c.lastMessage ? (
                    <>
                      {c.lastMessage.senderId === me?.id && <span className="text-[color:var(--muted)]">You: </span>}
                      {c.lastMessage.mediaUrl ? (
                        <span className="flex items-center gap-1"><Icon.Image size={12} /> Photo</span>
                      ) : (
                        c.lastMessage.content
                      )}
                    </>
                  ) : (
                    <span>Say hi 👋</span>
                  )}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="grid h-6 min-w-6 px-1.5 place-items-center rounded-full grad text-white text-[11px] font-bold shrink-0">
                  {c.unread}
                </span>
              )}
              <Icon.ChevronR size={16} className="text-[color:var(--muted)] shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesInner />
    </Suspense>
  );
}

// re-export for the chat page
export { clockTime };
