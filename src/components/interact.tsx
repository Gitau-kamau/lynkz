"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Avatar, Button, Modal, RichText, Select, Textarea, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { EMOJIS, REPORT_REASONS, cn } from "@/lib/utils";

/* ---------------- Follow button ---------------- */
export function FollowButton({
  userId,
  initial,
  initialPending,
  size = "md",
  onChange,
  className,
  block,
}: {
  userId: string;
  initial: boolean;
  initialPending?: boolean;
  size?: "sm" | "md";
  onChange?: (following: boolean, pending: boolean) => void;
  className?: string;
  block?: boolean;
}) {
  const [following, setFollowing] = useState(initial);
  const [pending, setPending] = useState(!!initialPending);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { me } = useSession();

  if (block || !me || me.id === userId) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await api<{ pending: boolean }>(`/api/users/${userId}`, {
        body: { type: following ? "unfollow" : "follow" },
      });
      setFollowing(!following);
      setPending(res.pending);
      onChange?.(!following, res.pending);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update follow.", "err");
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <Button variant="soft" size={size} onClick={() => (window.location.href = "/notifications")} className={className}>
        <Icon.Clock size={15} /> Requested
      </Button>
    );
  }
  return (
    <Button
      size={size}
      variant={following ? "outline" : "primary"}
      onClick={toggle}
      loading={busy}
      className={className}
      aria-pressed={following}
    >
      {following ? (
        <>
          <Icon.Check size={15} /> Following
        </>
      ) : (
        "Follow"
      )}
    </Button>
  );
}

/* ---------------- Report modal ---------------- */
export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/reports", { body: { targetType, targetId, reason, details } });
      toast("Report submitted. Our team will review it.");
      onClose();
      setDetails("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not submit report.", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report">
      <div className="p-5 space-y-4">
        <p className="text-sm text-[color:var(--muted)]">Why are you reporting this {targetType}? Your report is anonymous.</p>
        <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Report reason">
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Textarea rows={3} placeholder="Add details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy} variant="danger">Submit report</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Share modal ---------------- */
export function ShareModal({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard.");
    } catch {
      toast("Could not copy link.", "err");
    }
    onClose();
  };
  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "LYNKZ", url });
        onClose();
        return;
      }
      await copy();
    } catch {
      /* cancelled */
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Share">
      <div className="p-5 space-y-3">
        <div className="flex rounded-xl border border-[color:var(--line)] bg-white/5 px-3 py-2.5 text-[13px] text-[color:var(--muted)] truncate">{url}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={copy}>
            <Icon.Link size={16} /> Copy link
          </Button>
          <Button variant="soft" onClick={shareNative}>
            <Icon.Share size={16} /> Share…
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Emoji picker ---------------- */
export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-14 left-0 z-30 grid w-72 grid-cols-8 gap-1 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg2)] p-2.5 shadow-2xl modal-in" role="listbox" aria-label="Emoji picker">
      {EMOJIS.map((e) => (
        <button
          key={e}
          role="option"
          aria-label={e}
          onClick={() => {
            onPick(e);
            onClose();
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-white/10 transition"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Block / mute / menu item helpers ---------------- */
export function useBlockMute() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | { type: string; id: string }>(null);
  const router = useRouter();
  const run = async (type: string, id: string) => {
    try {
      await api(`/api/users/${id}`, { body: { type } });
      toast(type === "block" ? "User blocked." : type === "unblock" ? "User unblocked." : type === "mute" ? "User muted." : "User unmuted.");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "err");
    }
    setConfirmOpen(false);
  };
  return { confirmOpen, setConfirmOpen, pendingAction, setPendingAction, run };
}

/* ---------------- Media lightbox ---------------- */
export function Lightbox({ urls, index, onClose, setIndex }: { urls: string[]; index: number | null; onClose: () => void; setIndex: (i: number) => void }) {
  if (index === null) return null;
  const url = urls[index];
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Media viewer" onClick={onClose}>
      {urls.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index - 1 + urls.length) % urls.length);
            }}
            aria-label="Previous media"
          >
            <Icon.ChevronL size={20} />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index + 1) % urls.length);
            }}
            aria-label="Next media"
          >
            <Icon.ChevronR size={20} />
          </button>
        </>
      )}
      <button className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" onClick={onClose} aria-label="Close viewer">
        <Icon.X size={18} />
      </button>
      <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Post media" className="max-h-[88vh] max-w-full rounded-2xl object-contain" />
      </div>
    </div>
  );
}

/* ---------------- Suggested user row ---------------- */
export function UserRow({
  user,
  right,
  subtitle,
  dense,
}: {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null; bio?: string; isVerified?: boolean; isPrivate?: boolean };
  right?: React.ReactNode;
  subtitle?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", dense ? "py-2" : "py-2.5")}>
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <Avatar src={user.avatarUrl} name={user.displayName} size={dense ? 36 : 42} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${user.username}`} className="flex items-center gap-1">
          <span className="truncate text-[14px] font-semibold hover:underline">{user.displayName}</span>
          {user.isVerified && <Icon.Check size={14} className="text-[color:var(--a2)] shrink-0" />}
        </Link>
        <p className="truncate text-xs text-[color:var(--muted)]">@{user.username}{user.isPrivate && " · Private"}</p>
        {(subtitle || user.bio) && <p className="truncate text-xs text-[color:var(--muted)] mt-0.5">{subtitle ?? user.bio}</p>}
      </div>
      {right}
    </div>
  );
}
