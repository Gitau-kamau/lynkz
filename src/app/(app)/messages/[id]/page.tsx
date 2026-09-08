"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, ErrorState, PageLoader, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { clockTime, cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/interact";
import { readFileDataUrl, type MediaItem } from "@/components/Composer";
import { Confirm as ConfirmDialog } from "@/components/ui";
import { EmptyState } from "@/components/ui";

type Msg = {
  id: string;
  content: string;
  mediaUrl: string | null;
  replyTo: { id: string; content: string; senderName: string } | null;
  senderId: string;
  createdAt: string;
  deleted: boolean;
  mine: boolean;
};
type ChatData = {
  other: { id: string; username: string; displayName: string; avatarUrl: string | null; online: boolean };
  messages: Msg[];
  typing: boolean;
};

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [data, setData] = useState<ChatData | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [deleting, setDeleting] = useState<Msg | null>(null);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api<ChatData>(`/api/messages/${id}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load chat.");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length, data?.typing]);

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    api(`/api/messages/${id}`, { body: { type: "typing" } }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => api(`/api/messages/${id}`, { body: { type: "typing", stop: true } }).catch(() => {}), 2500);
  };

  const send = async (): Promise<void> => {
    if ((!text.trim() && !media) || sending) return;
    setSending(true);
    try {
      const res = await api<{ id: string }>(`/api/messages/${id}`, {
        body: { type: "send", content: text.trim(), mediaUrl: media?.url ?? null, replyToId: replyingTo?.id ?? null },
      });
      setText("");
      setMedia(null);
      setReplyingTo(null);
      await load();
      void res.id;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send message.", "err");
    } finally {
      setSending(false);
    }
  };

  const pickMedia = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const item = await readFileDataUrl(f, f.type.startsWith("image/") ? "image" : "video");
      setMedia(item);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load file.", "err");
    } finally {
      setUploading(false);
    }
  };

  const deleteMsg = async () => {
    if (!deleting) return;
    try {
      await api(`/api/messages/${id}`, { body: { type: "delete", messageId: deleting.id } });
      setData((d) => (d ? { ...d, messages: d.messages.filter((m) => m.id !== deleting.id) } : d));
      toast("Message deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "err");
    }
    setDeleting(null);
  };

  if (error) {
    return (
      <div className="card">
        <ErrorState msg={error} onRetry={load} />
        <div className="flex justify-center pb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/messages")}>← Back to messages</Button>
        </div>
      </div>
    );
  }
  if (!data) return <PageLoader label="Loading chat…" />;

  return (
    <div className="card flex flex-col" style={{ height: "calc(100dvh - 190px)", minHeight: 420 }}>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-3">
        <button onClick={() => router.push("/messages")} className="md:hidden grid h-9 w-9 place-items-center rounded-full hover:bg-white/8" aria-label="Back to messages">
          <Icon.ChevronL size={18} />
        </button>
        <Link href={`/profile/${data.other.username}`}>
          <Avatar src={data.other.avatarUrl} name={data.other.displayName} size={38} online={data.other.online} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${data.other.username}`} className="font-semibold text-[14px] hover:underline block truncate">
            {data.other.displayName}
          </Link>
          <p className={cn("text-[11.5px]", data.other.online ? "text-emerald-400" : "text-[color:var(--muted)]")}>
            {data.other.online ? "● Online" : "Offline"}
          </p>
        </div>
        <button onClick={() => router.push(`/profile/${data.other.username}`)} className="btn h-9 items-center rounded-xl border border-[color:var(--line)] px-3 text-[12.5px] font-semibold hover:bg-white/6 inline-flex">
          <Icon.User size={14} /> Profile
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" aria-live="polite">
        {data.messages.length === 0 && (
          <p className="text-center text-sm text-[color:var(--muted)] py-10">
            Say hi to {data.other.displayName} 👋 <br />
            <span className="text-xs">Messages are private and end-to-end… well, database-to-database. 😄</span>
          </p>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[78%] group relative", m.mine ? "items-end" : "items-start")}>
              {m.replyTo && (
                <div className={cn("mb-1 rounded-lg border-l-2 border-[color:var(--a2)] bg-white/5 px-2.5 py-1.5 text-[11px] text-[color:var(--muted)] max-w-[240px] truncate")}>
                  <b className="text-[color:var(--text)]">@{m.replyTo.senderName}</b> · {m.replyTo.content}
                </div>
              )}
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                  m.mine ? "grad text-white rounded-br-md" : "bg-white/7 rounded-bl-md"
                )}
              >
                {m.mediaUrl && (
                  m.mediaUrl.startsWith("data:video") ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={m.mediaUrl} controls className="max-h-56 rounded-xl mb-1.5" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.mediaUrl} alt="Message attachment" className="max-h-56 rounded-xl mb-1.5 max-w-full" />
                  )
                )}
                {m.content}
                <span className={cn("ml-2 text-[10px] opacity-60 float-right mt-2", m.mine && "text-white/80")}>
                  {clockTime(m.createdAt)}
                </span>
              </div>
              {m.mine && (
                <button
                  onClick={() => setDeleting(m)}
                  className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 grid h-6 w-6 place-items-center rounded-full text-[color:var(--muted)] hover:text-rose-400 transition"
                  aria-label="Delete message"
                >
                  <Icon.Trash size={13} />
                </button>
              )}
              {!m.mine && (
                <button
                  onClick={() => setReplyingTo(m)}
                  className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 grid h-6 w-6 place-items-center rounded-full text-[color:var(--muted)] hover:text-[color:var(--a2)] transition"
                  aria-label="Reply to message"
                  title="Reply"
                >
                  <Icon.Reply size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {data.typing && (
          <p className="flex items-center gap-1.5 text-[12px] text-[color:var(--a2)] pl-1">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--a2)] animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--a2)] animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--a2)] animate-bounce [animation-delay:240ms]" />
            </span>
            typing…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="border-t border-[color:var(--line)] p-3">
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-[color:var(--muted)]">
            <span className="truncate">↩ Replying to <b className="text-[color:var(--text)]">{replyingTo.mine ? "yourself" : "@" + data.other.username}</b></span>
            <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><Icon.X size={14} /></button>
          </div>
        )}
        {media && (
          <div className="relative mb-2 inline-block max-w-40">
            {media.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="Attachment preview" className="max-h-40 rounded-xl" />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={media.url} className="max-h-40 rounded-xl" muted />
            )}
            <button onClick={() => setMedia(null)} className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white" aria-label="Remove attachment">
              <Icon.X size={12} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              onClick={() => setEmojiOpen((o) => !o)}
              className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/8 text-[color:var(--muted)] hover:text-[color:var(--text)]"
              aria-label="Emoji picker"
              aria-expanded={emojiOpen}
            >
              <Icon.Smile size={19} />
            </button>
            {emojiOpen && <EmojiPicker onPick={(e) => setText((t) => t + e)} onClose={() => setEmojiOpen(false)} />}
          </div>
          <label className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl hover:bg-white/8 text-[color:var(--muted)] hover:text-[color:var(--text)]" aria-label="Send image">
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" className="hidden" onChange={(e) => pickMedia(e.target.files)} />
            {uploading ? <Icon.Clock size={18} className="animate-pulse" /> : <Icon.Image size={19} />}
          </label>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message ${data.other.displayName}…`}
            className="flex-1 resize-none rounded-xl border border-[color:var(--line)] bg-white/5 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[color:var(--a2)]/60 max-h-28"
            aria-label="Message"
          />
          <Button onClick={send} loading={sending} disabled={!text.trim() && !media} aria-label="Send message" className="h-10 w-10 !px-0">
            <Icon.Send size={16} />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleteMsg}
        title="Delete message?"
        desc="This removes the message for everyone in this chat."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}


