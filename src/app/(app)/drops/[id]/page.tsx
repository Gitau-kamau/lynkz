"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Confirm, ErrorState, PageLoader, Textarea, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { formatCount, timeAgo } from "@/lib/utils";
import { CategoryChip } from "@/components/cards";
import { MediaPicker, type MediaItem } from "@/components/Composer";

type DropDetail = {
  id: string;
  prompt: string;
  kind: string;
  category: string;
  responseCount: number;
  mine: boolean;
  responded: boolean;
  myResponseId: string | null;
  creator: { id: string; username: string; displayName: string; avatarUrl: string | null };
  responses: { id: string; content: string; mediaUrl: string | null; createdAt: string; mine: boolean; user: { id: string; username: string; displayName: string; avatarUrl: string | null } }[];
};

export default function DropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [data, setData] = useState<DropDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<DropDetail>(`/api/drops/${id}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load DROP.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async () => {
    if ((!content.trim() && media.length === 0) || busy) return;
    setBusy(true);
    try {
      await api(`/api/drops/${id}`, {
        body: { type: "respond", content: content.trim(), mediaUrl: media[0]?.url ?? null },
      });
      toast("Response dropped! 🎯");
      setContent("");
      setMedia([]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not respond.", "err");
    } finally {
      setBusy(false);
    }
  };

  const removeResponse = async () => {
    setBusy(true);
    try {
      await api(`/api/drops/${id}`, { body: { type: "remove_response" } });
      toast("Response removed.");
      setConfirmDelete(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove.", "err");
    } finally {
      setBusy(false);
    }
  };

  const deleteDrop = async () => {
    setBusy(true);
    try {
      await api(`/api/drops/${id}`, { method: "DELETE" });
      toast("DROP deleted.");
      router.push("/drops");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "err");
      setBusy(false);
    }
  };

  if (error) return <div className="card"><ErrorState msg={error} onRetry={load} /></div>;
  if (!data || !me) return <PageLoader label="Loading DROP…" />;

  return (
    <div className="space-y-4">
      <Link href="/drops" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)]">
        <Icon.ChevronL size={15} /> All DROPs
      </Link>

      {/* prompt card */}
      <div className="card p-5 sm:p-6 border-amber-400/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${data.creator.username}`}>
              <Avatar src={data.creator.avatarUrl} name={data.creator.displayName} size={44} />
            </Link>
            <div>
              <p className="text-[13px]">
                <Link href={`/profile/${data.creator.username}`} className="font-bold hover:underline">{data.creator.displayName}</Link>{" "}
                <span className="text-[color:var(--muted)]">dropped this</span>
              </p>
              <p className="text-[11.5px] text-[color:var(--muted)]">{data.kind === "question" ? "Question" : "Challenge"}</p>
            </div>
          </div>
          <CategoryChip category={data.category} />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-500/12 to-transparent border border-amber-400/15 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/20 text-amber-400"><Icon.Zap size={18} /></span>
          <p className="font-display text-[16px] sm:text-lg font-semibold leading-snug">“{data.prompt}”</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12.5px] text-[color:var(--muted)] flex items-center gap-1.5">
            <Icon.Users size={13} /> {formatCount(data.responseCount)} participant{data.responseCount === 1 ? "" : "s"}
          </p>
          {data.mine && (
            <div className="flex gap-2">
              <Button variant="soft" size="sm" onClick={() => setConfirmDelete(true)}>Delete DROP</Button>
            </div>
          )}
        </div>
      </div>

      {/* respond */}
      {!data.responded ? (
        <div className="card p-4 sm:p-5">
          <p className="text-[13.5px] font-semibold mb-3">Your response 👇</p>
          <MediaPicker media={media} setMedia={setMedia} multiple={false} compact />
          <div className="mt-3 flex items-end gap-2">
            <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Answer the drop…" />
            <Button onClick={respond} loading={busy} disabled={!content.trim() && media.length === 0} className="h-11 shrink-0">Drop it</Button>
          </div>
        </div>
      ) : (
        <div className="card p-4 border-emerald-400/20 flex items-center gap-3">
          <Icon.Check size={18} className="text-emerald-400 shrink-0" />
          <p className="text-[13px] text-[color:var(--muted)] flex-1">You've responded to this DROP.</p>
          <Button variant="soft" size="sm" onClick={() => setConfirmDelete(true)}>Remove response</Button>
        </div>
      )}

      {/* responses */}
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Icon.Zap size={16} className="text-amber-400" /> Responses
        <span className="text-[12px] text-[color:var(--muted)] font-normal">{data.responseCount}</span>
      </h2>
      {data.responses.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[color:var(--muted)]">No responses yet — be the first! ⚡</div>
      ) : (
        <div className="space-y-3">
          {data.responses.map((r) => (
            <div key={r.id} className="card p-4 flex gap-3">
              <Link href={`/profile/${r.user.username}`} className="shrink-0">
                <Avatar src={r.user.avatarUrl} name={r.user.displayName} size={40} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <Link href={`/profile/${r.user.username}`} className="font-bold hover:underline">{r.user.displayName}</Link>{" "}
                  <span className="text-[color:var(--muted)]">@{r.user.username} · {timeAgo(r.createdAt)}</span>
                </p>
                {r.mediaUrl && (
                  r.mediaUrl.startsWith("data:video") ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={r.mediaUrl} controls className="mt-2 max-h-64 rounded-2xl" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.mediaUrl} alt="Response" className="mt-2 max-h-64 rounded-2xl" />
                  )
                )}
                {r.content && <p className="mt-1.5 text-[14px] leading-relaxed">{r.content}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={data.responded && !data.mine ? removeResponse : data.mine ? deleteDrop : removeResponse}
        title="Remove your response?"
        desc={data.mine && data.responded ? "This deletes your response and, if you confirm twice, your drop." : "Your response will be removed from this DROP."}
        confirmLabel={data.mine && data.responded ? "Delete" : "Remove"}
        danger
        loading={busy}
      />
    </div>
  );
}
