"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Modal, RichText, Textarea, toast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { cn, EMOJIS, formatCount, timeAgo } from "@/lib/utils";

export type LynkDTO = {
  id: string;
  type: string;
  content: string;
  mediaUrl: string | null;
  poll: { question: string; options: string[]; votes: number[]; voted: number | null } | null;
  music: { title: string; artist: string } | null;
  viewCount: number;
  reactionCount: number;
  replyCount: number;
  expiresAt: string;
  createdAt: string;
  mine: boolean;
  myReaction: string | null;
  viewers: { username: string; displayName: string; avatarUrl: string | null }[] | null;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
};

const LYNK_ICONS: Record<string, { icon: keyof typeof Icon; label: string }> = {
  photo: { icon: "Camera", label: "Photo" },
  video: { icon: "Video", label: "Video" },
  text: { icon: "At", label: "Text" },
  poll: { icon: "Poll", label: "Poll" },
  question: { icon: "Question", label: "Question" },
  music: { icon: "Music", label: "Music" },
};

export function LynkAvatar({ lynk, size = 56, onClick }: { lynk: LynkDTO; size?: number; onClick?: () => void }) {
  const meta = LYNK_ICONS[lynk.type] ?? LYNK_ICONS.text!;
  const remaining = lynk.expiresAt ? Math.max(0, (new Date(lynk.expiresAt).getTime() - Date.now()) / 86400000) : 1;
  const pct = Math.min(100, Math.round((remaining / 1) * 100));
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-1.5 shrink-0 w-[68px]" aria-label={`${meta.label} LYNK by ${lynk.author.displayName}`}>
      <span className="rounded-full p-[2.5px] grad">
        <span className="block rounded-full p-[2.5px] bg-[color:var(--bg)]">
          <Avatar src={lynk.author.avatarUrl} name={lynk.author.displayName} size={size} />
        </span>
      </span>
      <span className="text-[11px] text-[color:var(--muted)] truncate w-full text-center group-hover:text-[color:var(--text)]">
        {lynk.author.username}
      </span>
    </button>
  );
}

export function LynkStrip({ lynks, onOpen }: { lynks: LynkDTO[]; onOpen: (index: number) => void }) {
  if (lynks.length === 0) return null;
  return (
    <div className="card px-4 py-3.5 flex items-center gap-3 overflow-x-auto no-scrollbar">
      <Link
        href="/create?tab=lynk"
        className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
        aria-label="Create a LYNK"
      >
        <span className="grid place-items-center rounded-full border-2 border-dashed border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)] hover:text-[color:var(--a2)] transition" style={{ width: 56, height: 56 }}>
          <Icon.Plus size={22} />
        </span>
        <span className="text-[11px] text-[color:var(--muted)]">Your LYNK</span>
      </Link>
      {lynks.map((l, i) => (
        <LynkAvatar key={l.id} lynk={l} onClick={() => onOpen(i)} />
      ))}
      <Link href="/lynks" className="ml-auto shrink-0 text-xs font-semibold text-[color:var(--a2)] hover:underline">
        View all →
      </Link>
    </div>
  );
}

export function LynkViewer({
  lynks,
  startIndex,
  onClose,
  onChanged,
}: {
  lynks: LynkDTO[];
  startIndex: number;
  onClose: () => void;
  onChanged?: (updated: LynkDTO) => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [reacting, setReacting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [replies, setReplies] = useState<{ id: string; content: string; createdAt: string; user: { username: string; displayName: string; avatarUrl: string | null } }[] | null>(null);
  const lynk = lynks[idx];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setProgress(0);
    if (idx < lynks.length - 1) setIdx(idx + 1);
    else onClose();
  }, [idx, lynks.length, onClose]);

  useEffect(() => {
    if (!lynk) return;
    if (timer.current) clearInterval(timer.current);
    setProgress(0);
    const duration = lynk.type === "photo" || lynk.type === "video" ? 7000 : 5500;
    const start = Date.now();
    timer.current = setInterval(() => {
      const pct = ((Date.now() - start) / duration) * 100;
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer.current!);
        advance();
      }
    }, 50);
    api(`/api/lynks/${lynk.id}`, { body: { type: "view" } }).catch(() => {});
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, lynk?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") (timer.current = null, advance());
      if (e.key === "ArrowLeft" && idx > 0) { setProgress(0); setIdx(idx - 1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [idx, advance, onClose]);

  if (!lynk) return null;
  const meta = LYNK_ICONS[lynk.type] ?? LYNK_ICONS.text!;
  const remaining = lynk.expiresAt ? Math.max(0, (new Date(lynk.expiresAt).getTime() - Date.now()) / 3600000) : 0;

  const react = async (emoji: string) => {
    setReacting(true);
    try {
      const res = await api<{ reaction: string | null; count: number }>(`/api/lynks/${lynk.id}`, {
        body: { type: "react", emoji },
      });
      const updated = { ...lynk, myReaction: res.reaction, reactionCount: res.count };
      onChanged?.(updated);
      setReacting(false);
    } catch (e) {
      setReacting(false);
      toast(e instanceof Error ? e.message : "Could not react.", "err");
    }
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    try {
      const res = await api<{ count: number }>(`/api/lynks/${lynk.id}`, { body: { type: "reply", content: text } });
      onChanged?.({ ...lynk, replyCount: res.count });
      setReplyText("");
      setReplyOpen(false);
      toast("Reply sent.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send reply.", "err");
    }
  };

  const loadReplies = async () => {
    setViewersOpen(true);
    if (replies) return;
    try {
      const res = await api<{ replies: typeof replies }>(`/api/lynks/${lynk.id}?replies=1`);
      setReplies(res.replies);
    } catch {
      setReplies([]);
    }
  };

  const lv = lynk as LynkDTO;

  return (
    <Modal open onClose={onClose} bare wide>
      <div className="relative" style={{ minHeight: "min(78vh, 640px)" }}>
        {/* progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {lynks.map((l, i) => (
            <span key={l.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              <span
                className="block h-full rounded-full bg-white transition-all duration-100"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        <button className="absolute top-4 right-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60" onClick={onClose} aria-label="Close LYNK">
          <Icon.X size={16} />
        </button>

        <div className="absolute top-8 left-40 z-20 hidden md:flex items-center gap-2 text-white/90">
          <Icon.Clock size={12} />
          <span className="text-[11px] font-medium">{Math.max(0, Math.round(remaining))}h left</span>
        </div>

        {/* content */}
        <div className="absolute inset-0 grid place-items-center overflow-y-auto no-scrollbar">
          <div className="w-full max-w-lg px-4 pb-24 pt-16 md:pt-12">
            {lynk.type === "photo" && lynk.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lynk.mediaUrl} alt="LYNK photo" className="w-full max-h-[52vh] rounded-3xl object-contain" />
            )}
            {lynk.type === "video" && lynk.mediaUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={lynk.mediaUrl} className="w-full max-h-[52vh] rounded-3xl bg-black" controls autoPlay muted playsInline />
            )}
            {lynk.type !== "photo" && lynk.type !== "video" && lynk.type !== "music" && (
              <div className="text-center space-y-3">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl grad text-white shadow-xl">
                  <IconComponent name={meta.icon} size={24} />
                </span>
                <p className="text-xl font-semibold leading-relaxed whitespace-pre-wrap"><RichText text={lynk.content} /></p>
              </div>
            )}
            {lynk.type === "music" && (
              <div className="rounded-3xl p-6 grad text-white shadow-2xl space-y-3">
                <Icon.Music size={30} />
                <div>
                  <p className="text-xl font-bold">{lynk.music?.title ?? lynk.content}</p>
                  <p className="text-white/80">{lynk.music?.artist ?? "Unknown artist"}</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-white animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
            {lynk.type === "poll" && lynk.poll && (
              <div className="rounded-3xl card p-6 space-y-2.5">
                <p className="font-semibold text-center">{lynk.poll.question}</p>
                {lynk.poll.options.map((opt, i) => {
                  const votes = lynk.poll!.votes[i] ?? 0;
                  const total = lynk.poll!.votes.reduce((a, b) => a + b, 0);
                  const pct = total ? Math.round((votes / total) * 100) : 0;
                  const voted = lynk.poll!.voted === i;
                  return (
                    <button
                      key={i}
                      onClick={() => api(`/api/lynks/${lynk.id}`, { body: { type: "vote", option: i } }).then(() => onChanged?.({
                        ...lynk,
                        poll: {
                          ...lynk.poll!,
                          votes: lynk.poll!.votes.map((v, j) => (j === i ? v + 1 : v)),
                          voted: i,
                        },
                      })).catch((e) => toast(e instanceof Error ? e.message : "Could not vote", "err"))}
                      disabled={lynk.poll!.voted !== null}
                      className="relative overflow-hidden rounded-xl border border-[color:var(--line)] px-4 py-3 text-left text-[14px] font-medium"
                    >
                      <span className={cn("absolute inset-y-0 left-0", voted ? "grad opacity-25" : "bg-white/8")} style={{ width: lynk.poll!.voted !== null ? `${pct}%` : "0%" }} />
                      <span className="relative flex justify-between gap-2">
                        <span>{opt}</span>
                        {lynk.poll!.voted !== null && <span className="text-xs text-[color:var(--muted)]">{pct}%</span>}
                      </span>
                    </button>
                  );
                })}
                <p className="text-center text-xs text-[color:var(--muted)]">{lynk.poll.votes.reduce((a, b) => a + b, 0)} votes</p>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${lynk.author.username}`} className="flex items-center gap-2 shrink-0">
              <span className="rounded-full p-[2px] grad"><Avatar src={lynk.author.avatarUrl} name={lynk.author.displayName} size={34} /></span>
              <span className="hidden sm:block text-[13px] font-semibold text-white">{lynk.author.displayName}</span>
            </Link>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={loadReplies} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/25" aria-label={`${lv.viewCount} views, ${lv.replyCount} replies`}>
                <Icon.Eye size={13} /> {formatCount(lv.viewCount)}
              </button>
              <button onClick={() => setReplyOpen((o) => !o)} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/25">
                <Icon.Comment size={13} /> {formatCount(lv.replyCount)}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              {replyOpen && (
                <div className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    placeholder={`Reply to ${lynk.author.username}…`}
                    autoFocus
                    className="flex-1 rounded-full bg-white/15 px-4 py-2.5 text-[13.5px] text-white outline-none placeholder:text-white/50 backdrop-blur"
                    aria-label="Reply to LYNK"
                  />
                  <button onClick={sendReply} className="grid h-10 w-10 place-items-center rounded-full grad text-white" aria-label="Send reply">
                    <Icon.Send size={15} />
                  </button>
                </div>
              )}
              {!replyOpen && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {["🔥", "❤️", "😂", "😍", "🥳", "👏", "💯"].map((e) => (
                    <button
                      key={e}
                      onClick={() => react(e)}
                      disabled={reacting}
                      className={cn(
                        "shrink-0 rounded-full p-2 text-lg transition hover:scale-125 bg-white/10",
                        lynk.myReaction === e && "grad scale-110"
                      )}
                      aria-label={`React with ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.origin + "/lynks").then(() => toast("LYNK link copied."))}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Share LYNK"
            >
              <Icon.Share size={15} />
            </button>
          </div>
        </div>

        {viewersOpen && (
          <Modal open onClose={() => setViewersOpen(false)} title={lynk.mine ? `Views · ${lynk.viewCount}` : `Replies · ${lynk.replyCount}`}>
            <div className="p-4 space-y-1">
              {lynk.mine ? (
                (lynk.viewers ?? []).length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)] py-4 text-center">No views yet.</p>
                ) : (
                  lynk.viewers!.map((v) => (
                    <Link key={v.username} href={`/profile/${v.username}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/6">
                      <Avatar src={v.avatarUrl} name={v.displayName} size={30} />
                      <span className="text-[13px] font-medium">{v.displayName}</span>
                      <span className="text-xs text-[color:var(--muted)]">@{v.username}</span>
                    </Link>
                  ))
                )
              ) : replies === null ? (
                <p className="text-sm text-[color:var(--muted)] py-4 text-center">Loading replies…</p>
              ) : replies.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)] py-4 text-center">No replies yet.</p>
              ) : (
                replies.map((r) => (
                  <div key={r.id} className="flex gap-2.5 rounded-xl px-2.5 py-2">
                    <Avatar src={r.user.avatarUrl} name={r.user.displayName} size={30} />
                    <div>
                      <p className="text-[12.5px]"><b>{r.user.displayName}</b> <span className="text-[color:var(--muted)]">· {timeAgo(r.createdAt)}</span></p>
                      <p className="text-[13px]">{r.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
}

function IconComponent({ name, size }: { name: keyof typeof Icon; size: number }) {
  const C = Icon[name];
  return <C size={size} />;
}

export function LynkEmpty() {
  return (
    <EmptyState
      icon={<Icon.Link size={24} />}
      title="No active LYNKs"
      desc="LYNKs disappear after 24 hours. Create one to start the chain."
      action={
        <Link href="/create?tab=lynk">
          <Button><Icon.Plus size={15} /> Create a LYNK</Button>
        </Link>
      }
    />
  );
}
