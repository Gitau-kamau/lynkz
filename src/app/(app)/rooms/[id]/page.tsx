"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Confirm, ErrorState, Modal, PageLoader, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { CategoryChip } from "@/components/cards";
import { ReportModal } from "@/components/interact";

type RoomDetail = {
  id: string;
  name: string;
  description: string;
  category: string;
  isClosed: boolean;
  memberCount: number;
  createdAt: string;
  mine: boolean;
  canModerate: boolean;
  joined: boolean;
  muted: boolean;
  creator: { username: string; displayName: string; avatarUrl: string | null };
  members: { id: string; username: string; displayName: string; avatarUrl: string | null; role: string }[];
  messages: { id: string; content: string; createdAt: string; isPinned: boolean; mine: boolean; author: { id: string; username: string; displayName: string; avatarUrl: string | null } }[];
};

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [data, setData] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; desc: string; label: string; fn: () => Promise<void> } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<RoomDetail>(`/api/rooms/${id}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load room.");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [data?.messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending || !data?.joined) return;
    setSending(true);
    try {
      await api(`/api/rooms/${id}`, { body: { type: "message", content } });
      setText("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post.", "err");
    } finally {
      setSending(false);
    }
  };

  const joinLeave = async () => {
    setBusy(true);
    try {
      await api(`/api/rooms/${id}`, { body: { type: data!.joined ? "leave" : "join" } });
      await load();
      toast(data!.joined ? "Left the room." : "Joined the room! 🎉");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "err");
    } finally {
      setBusy(false);
    }
  };

  const act = async (type: string, messageId?: string) => {
    setBusy(true);
    try {
      await api(`/api/rooms/${id}`, { body: { type, messageId } });
      await load();
      toast(
        type === "pin" ? "Message pinned." :
        type === "unpin" ? "Message unpinned." :
        type === "remove" ? "Message removed." :
        type === "close" ? "Room closed." :
        type === "reopen" ? "Room reopened." : "Done."
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "err");
    } finally {
      setBusy(false);
      setMenuFor(null);
      setConfirm(null);
    }
  };

  if (error) {
    return <div className="card"><ErrorState msg={error} onRetry={load} /></div>;
  }
  if (!data || !me) return <PageLoader label="Loading room…" />;

  const modMenu = (msg: { id: string; isPinned: boolean; mine: boolean; author: { id: string } }) => (
    <>
      {data.canModerate && (
        <button role="menuitem" onClick={() => act(msg.isPinned ? "unpin" : "pin", msg.id)} className="menu-item">
          <Icon.Pin size={14} /> {msg.isPinned ? "Unpin" : "Pin"}
        </button>
      )}
      {(data.canModerate || msg.mine) && (
        <button role="menuitem" onClick={() => act("remove", msg.id)} className="menu-item text-rose-400">
          <Icon.Trash size={14} /> Remove message
        </button>
      )}
      {!data.canModerate && !msg.mine && (
        <button role="menuitem" onClick={() => act("report_msg", msg.id)} className="menu-item text-rose-400">
          <Icon.Flag size={14} /> Report
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-bold">{data.name}</h1>
              <CategoryChip category={data.category} />
              {data.isClosed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 border border-rose-400/25">
                  <Icon.Lock size={10} /> Closed
                </span>
              )}
            </div>
            <p className="mt-1 text-[13.5px] text-[color:var(--muted)]">{data.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-[color:var(--muted)]">
              <Link href={`/profile/${data.creator.username}`} className="flex items-center gap-1.5 hover:underline">
                <Avatar src={data.creator.avatarUrl} name={data.creator.displayName} size={20} />
                <b className="text-[color:var(--text)]">{data.creator.displayName}</b> created this
              </Link>
              <button onClick={() => setMembersOpen(true)} className="hover:underline">
                {formatCount(data.memberCount)} members
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={() => setReportOpen(true)} aria-label="Report room"><Icon.Flag size={14} /></Button>
            <Button variant="soft" size="sm" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast("Room link copied."))} aria-label="Share room"><Icon.Share size={14} /></Button>
            {data.mine ? (
              <Button variant={data.isClosed ? "outline" : "danger"} size="sm" onClick={() => setConfirm(data.isClosed ? {
                title: "Reopen room?", desc: "Members can post again.", label: "Reopen", fn: async () => act("reopen"),
              } : {
                title: "Close room?", desc: "No one can post anymore, but the room stays visible.", label: "Close room", fn: async () => act("close"),
              })}>
                {data.isClosed ? <><Icon.Play size={14} /> Reopen</> : <><Icon.Lock size={14} /> Close</>}
              </Button>
            ) : data.joined ? (
              <Button variant="outline" size="sm" onClick={joinLeave} loading={busy}>Leave room</Button>
            ) : (
              <Button size="sm" onClick={joinLeave} loading={busy} disabled={data.isClosed}>Join room</Button>
            )}
          </div>
        </div>
        {data.canModerate && (
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-violet-300">
            <Icon.Shield size={12} /> You're a moderator — pin messages, remove posts and mute members from the member list.
          </p>
        )}
      </div>

      {/* messages */}
      <div className="card p-4 sm:p-5 space-y-3 min-h-[300px] max-h-[55vh] overflow-y-auto">
        {data.messages.length === 0 && (
          <p className="text-center text-sm text-[color:var(--muted)] py-10">
            {data.isClosed ? "This room is closed." : "No posts yet. Be the first to speak!"}
          </p>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={cn("group relative flex gap-2.5", m.mine && "flex-row-reverse")}>
            <Avatar src={m.author.avatarUrl} name={m.author.displayName} size={32} />
            <div className={cn("max-w-[82%] rounded-2xl bg-white/5 px-3.5 py-2.5", m.mine && "bg-[color:var(--a1)]/12")}>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/profile/${m.author.username}`} className="text-[12.5px] font-bold hover:underline">{m.author.displayName}</Link>
                {m.isPinned && <span className="flex items-center gap-1 text-[10px] font-bold text-[color:var(--a2)]"><Icon.Pin size={9} /> PINNED</span>}
                <span className="text-[10.5px] text-[color:var(--muted)]">{timeAgo(m.createdAt)}</span>
              </div>
              <p className="text-[13.5px] leading-relaxed mt-0.5">{m.content}</p>
            </div>
            <div className="relative">
              <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="opacity-0 group-hover:opacity-100 grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] hover:bg-white/8 transition" aria-label="Message options">
                <Icon.Dots size={14} />
              </button>
              {menuFor === m.id && (
                <div className="absolute z-30 w-48 card bg-[color:var(--bg2)] p-1.5 shadow-2xl modal-in" role="menu" style={{ top: 0, right: m.mine ? "auto" : 0, left: m.mine ? 0 : "auto" }}>
                  {modMenu(m)}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      {data.joined && !data.isClosed && (
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={`Post in ${data.name}…`}
            className="flex-1 resize-none rounded-2xl border border-[color:var(--line)] bg-white/5 px-4 py-3 text-[14px] outline-none focus:border-[color:var(--a2)]/60 max-h-32"
            aria-label="Room message"
          />
          <Button onClick={send} loading={sending} disabled={!text.trim()} aria-label="Send room message" className="h-11 w-11 !px-0 rounded-2xl">
            <Icon.Send size={16} />
          </Button>
        </div>
      )}

      {/* members modal */}
      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`Members · ${data.memberCount}`}>
        <div className="p-3">
          {data.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
              <Link href={`/profile/${m.username}`} className="flex flex-1 items-center gap-3 min-w-0">
                <Avatar src={m.avatarUrl} name={m.displayName} size={36} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{m.displayName}</span>
                  <span className="block text-[11px] text-[color:var(--muted)]">@{m.username}</span>
                </span>
              </Link>
              {m.role === "creator" && <span className="text-[10.5px] font-bold text-[color:var(--a2)]">CREATOR</span>}
              {m.role === "moderator" && <span className="text-[10.5px] font-bold text-violet-300">MOD</span>}
              {data.canModerate && m.role === "member" && (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => setConfirm({
                    title: `Mute @${m.username}?`,
                    desc: "Muted members can stay in the room but their messages are hidden. Unmute from the same menu.",
                    label: "Mute",
                    fn: async () => { await api(`/api/rooms/${id}`, { body: { type: "mute", userId: m.id } }); await load(); toast("Member muted."); },
                  })}
                >
                  Mute
                </Button>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        desc={confirm?.desc}
        confirmLabel={confirm?.label ?? "Confirm"}
        danger={confirm?.label === "Close room" || confirm?.label === "Mute"}
        loading={busy}
        onConfirm={() => confirm?.fn()}
      />

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="room" targetId={data.id} />
    </div>
  );
}
