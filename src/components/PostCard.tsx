"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, Button, Confirm, Modal, RichText, Textarea, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { Lightbox, ReportModal, ShareModal } from "@/components/interact";

export type PostDTO = {
  id: string;
  content: string;
  location: string;
  question: string;
  poll: { question: string; options: { text: string; votes: number; id: number }[]; voted: number | null } | null;
  tags: string[];
  createdAt: string;
  visibility: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  media: { url: string; type: string }[];
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean; isPrivate: boolean };
  repostedBy: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean } | null;
};

export function CommentItem({
  c,
  onDelete,
  onReply,
}: {
  c: { id: string; content: string; createdAt: string; likeCount: number; liked: boolean; me: boolean; author: { username: string; displayName: string; avatarUrl: string | null }; parentName?: string | null };
  onDelete: (id: string) => void;
  onReply: (c: { id: string; content: string; createdAt: string; likeCount: number; liked: boolean; me: boolean; author: { username: string; displayName: string; avatarUrl: string | null } }) => void;
}) {
  const [toggle, setToggle] = useState(false);
  const like = async () => {
    setToggle(true);
    try {
      await api(`/api/comments/${c.id}`, { body: { type: c.liked ? "unlike" : "like" } });
      window.dispatchEvent(new CustomEvent("lynkz-comment-change", { detail: { id: c.id, liked: !c.liked, delta: c.liked ? -1 : 1 } }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "err");
    } finally {
      setToggle(false);
    }
  };
  return (
    <div className="flex gap-2.5 py-2.5 group">
      <Link href={`/profile/${c.author.username}`} className="shrink-0">
        <Avatar src={c.author.avatarUrl} name={c.author.displayName} size={30} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-white/5 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${c.author.username}`} className="text-[13px] font-semibold hover:underline">
              {c.author.displayName}
            </Link>
            <span className="text-[11px] text-[color:var(--muted)]">{timeAgo(c.createdAt)}</span>
          </div>
          <p className="text-[13.5px] leading-relaxed mt-0.5">
            <RichText text={c.content} />
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-1">
          <button onClick={like} disabled={toggle} className={cn("flex items-center gap-1 text-[11.5px] font-medium", c.liked ? "text-rose-400" : "text-[color:var(--muted)] hover:text-rose-400")} aria-pressed={c.liked} aria-label="Like comment">
            <Icon.HeartFill size={12} className={c.liked ? "" : "hidden"} />
            <Icon.Heart size={12} className={c.liked ? "hidden" : ""} />
            {c.likeCount > 0 && formatCount(c.likeCount)}
          </button>
          <button onClick={() => onReply(c)} className="text-[11.5px] font-medium text-[color:var(--muted)] hover:text-[color:var(--text)]">
            Reply
          </button>
          {c.me && (
            <button onClick={() => onDelete(c.id)} className="text-[11.5px] font-medium text-[color:var(--muted)] hover:text-rose-400">
              Delete
            </button>
          )}
        </div>
        {c.parentName && <p className="mt-0.5 px-1 text-[11px] text-[color:var(--muted)]">↩ Replying to @{c.parentName}</p>}
      </div>
    </div>
  );
}

export default function PostCard({
  post,
  onDelete,
  onUpdate,
  onViewDetail,
  showAllComments,
}: {
  post: PostDTO;
  onDelete?: (id: string) => void;
  onUpdate?: (p: PostDTO) => void;
  onViewDetail?: () => void;
  showAllComments?: boolean;
}) {
  const { me } = useSession();
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(!!showAllComments);
  const [comments, setComments] = useState<CommentItemProps[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItemProps | null>(null);
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const media = post.media;
  const gridCls = useMemo(() => {
    const n = media.length;
    if (n === 1) return "grid-cols-1";
    if (n === 2) return "grid-cols-2";
    return "grid-cols-2";
  }, [media.length]);

  const act = async (type: string) => {
    const map: Record<string, string> = {
      like: "like", unlike: "like", save: "save", unsave: "save",
      repost: "repost", unrepost: "repost", view: "view",
    };
    setBusy(type);
    try {
      await api(`/api/posts/${post.id}`, { body: { type } });
      if (type === "like") onUpdate?.({ ...post, liked: true, likeCount: post.likeCount + 1 });
      if (type === "unlike") onUpdate?.({ ...post, liked: false, likeCount: Math.max(0, post.likeCount - 1) });
      if (type === "save" || type === "unsave") onUpdate?.({ ...post, saved: type === "save" });
      if (type === "repost") {
        onUpdate?.({ ...post, reposted: true, repostCount: post.repostCount + 1 });
        toast("Reposted to your followers.");
      }
      if (type === "unrepost") onUpdate?.({ ...post, reposted: false, repostCount: Math.max(0, post.repostCount - 1) });
      if (type === "delete") {
        toast("Post deleted.");
        onDelete?.(post.id);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "err");
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const toggleComments = async () => {
    setCommentsOpen((o) => !o);
    if (!comments && !commentsLoading) {
      setCommentsLoading(true);
      try {
        const res = await api<{ items: CommentItemProps[] }>(`/api/posts/${post.id}?comments=1`);
        setComments(res.items);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load comments", "err");
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await api<{ item: CommentItemProps }>("/api/comments", {
        body: { postId: post.id, content: text, parentId: replyTo?.id ?? null },
      });
      setComments((p) => [
        ...(p ?? []),
        { ...res.item, parentName: replyTo ? replyTo.author.username : null },
      ]);
      setCommentText("");
      setReplyTo(null);
      onUpdate?.({ ...post, commentCount: post.commentCount + 1 });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post comment", "err");
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: string) => {
    try {
      await api(`/api/comments/${id}`, { method: "DELETE" });
      setComments((p) => (p ?? []).filter((c) => c.id !== id));
      onUpdate?.({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
      toast("Comment deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete comment", "err");
    }
  };

  const vote = async (optionId: number) => {
    if (!post.poll || post.poll.voted !== null) return;
    try {
      await api(`/api/posts/${post.id}`, { body: { type: "vote", option: optionId } });
      const options = post.poll.options.map((o) =>
        o.id === optionId ? { ...o, votes: o.votes + 1 } : o
      );
      onUpdate?.({ ...post, poll: { ...post.poll, options, voted: optionId } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not vote", "err");
    }
  };

  const isOwn = me?.id === post.author.id;
  const totalVotes = post.poll ? post.poll.options.reduce((a, o) => a + o.votes, 0) : 0;

  return (
    <article className="card p-4 sm:p-5" aria-label={`Post by ${post.author.displayName}`}>
      {post.repostedBy && (
        <p className="flex items-center gap-1.5 text-xs text-[color:var(--muted)] mb-2.5">
          <Icon.Repeat size={13} />
          <Link href={`/profile/${post.repostedBy.username}`} className="font-semibold hover:underline">
            {post.repostedBy.displayName}
          </Link>
          reposted
        </p>
      )}

      {/* header */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${post.author.username}`} className="shrink-0">
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${post.author.username}`} className="font-semibold text-[14.5px] hover:underline truncate">
              {post.author.displayName}
            </Link>
            {post.author.isVerified && <Icon.Check size={14} className="text-[color:var(--a2)] shrink-0" aria-label="Verified" />}
            <span className="text-[color:var(--muted)] text-[13px]">@{post.author.username}</span>
            <span className="text-[color:var(--muted)] text-[13px]">·</span>
            <time className="text-[color:var(--muted)] text-[13px]" dateTime={post.createdAt}>
              {timeAgo(post.createdAt)}
            </time>
            {post.visibility === "followers" && <Icon.Users size={13} className="text-[color:var(--muted)] ml-1" aria-label="Followers only" />}
            {post.visibility === "only_me" && <Icon.Lock size={13} className="text-[color:var(--muted)] ml-1" aria-label="Only me" />}
          </div>
          <div className="relative">
            {post.location && (
              <p className="flex items-center gap-1 text-xs text-[color:var(--muted)] mt-0.5">
                <Icon.MapPin size={12} /> {post.location}
              </p>
            )}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] hover:bg-white/8"
            aria-label="Post options" aria-expanded={menuOpen}
          >
            <Icon.Dots size={17} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-30 w-56 card bg-[color:var(--bg2)] p-1.5 shadow-2xl modal-in" role="menu">
              <button role="menuitem" onClick={() => setShareOpen(true)} className="menu-item">
                <Icon.Share size={15} /> Copy link
              </button>
              {!isOwn && (
                <button role="menuitem" onClick={() => { router.push(`/messages?to=${post.author.username}`); }} className="menu-item">
                  <Icon.Chat size={15} /> Message author
                </button>
              )}
              {!isOwn && (
                <button role="menuitem" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="menu-item text-rose-400">
                  <Icon.Flag size={15} /> Report post
                </button>
              )}
              {isOwn && (
                <button role="menuitem" onClick={() => { setMenuOpen(false); setConfirmDel(true); }} className="menu-item text-rose-400">
                  <Icon.Trash size={15} /> Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* content */}
      {post.content && (
        <div className="mt-3 text-[14.5px] leading-relaxed">
          <RichText text={post.content} />
        </div>
      )}
      {post.question && (
        <div className="mt-3 flex gap-2.5 rounded-2xl border border-[color:var(--line)] bg-white/3 p-3.5">
          <Icon.Question size={18} className="text-[color:var(--a2)] shrink-0 mt-0.5" />
          <p className="text-[14px] font-medium">{post.question}</p>
        </div>
      )}

      {/* media */}
      {media.length > 0 && (
        <div className={cn("mt-3 grid gap-1.5", gridCls)}>
          {media.map((m, i) => (
            <button
              key={i}
              onClick={() => setLightbox(i)}
              className={cn(
                "relative overflow-hidden rounded-2xl bg-white/5 group",
                media.length === 1 ? "max-h-[560px]" : "aspect-square"
              )}
              aria-label={`Open media ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={`Attachment ${i + 1}`}
                loading="lazy"
                className={cn(
                  "h-full w-full object-cover transition group-hover:opacity-90",
                  media.length > 1 && "aspect-square"
                )}
              />
              {m.type === "video" && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur"><Icon.Play size={20} /></span>
                </span>
              )}
              {media.length > 1 && (
                <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white text-[11px] font-bold backdrop-blur">
                  {i + 1}/{media.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* poll */}
      {post.poll && (
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-white/3 p-4">
          <p className="flex items-center gap-2 font-semibold text-[14px] mb-3">
            <Icon.Poll size={16} className="text-[color:var(--a2)]" /> {post.poll.question}
          </p>
          <div className="space-y-2">
            {post.poll.options.map((o) => {
              const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
              const votedThis = post.poll!.voted === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => vote(o.id)}
                  disabled={post.poll!.voted !== null}
                  className="relative w-full overflow-hidden rounded-xl border border-[color:var(--line)] px-3.5 py-2.5 text-left text-[13.5px] font-medium transition disabled:cursor-default hover:border-[color:var(--a2)]/50"
                  aria-pressed={votedThis}
                >
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-xl transition-all", votedThis ? "grad opacity-25" : "bg-white/8")}
                    style={{ width: post.poll!.voted !== null ? `${pct}%` : "0%" }}
                  />
                  <span className="relative flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {votedThis && <Icon.Check size={14} className="text-[color:var(--a2)]" />}
                      {o.text}
                    </span>
                    {post.poll!.voted !== null && <span className="text-xs text-[color:var(--muted)] font-semibold">{pct}%</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-[color:var(--muted)]">{formatCount(totalVotes)} votes</p>
        </div>
      )}

      {/* actions */}
      <div className="mt-3.5 flex items-center justify-between border-t border-[color:var(--line)] pt-2.5 -mx-1 px-1">
        <ActionBtn
          label="Like"
          active={post.liked}
          activeCls="text-rose-400"
          count={post.likeCount}
          icon={post.liked ? <Icon.HeartFill size={19} /> : <Icon.Heart size={19} />}
          onClick={() => act(post.liked ? "unlike" : "like")}
          busy={busy === "like"}
        />
        <ActionBtn
          label="Comment"
          count={post.commentCount}
          icon={<Icon.Comment size={19} />}
          onClick={toggleComments}
          busy={busy === "comment"}
        />
        <ActionBtn
          label="Repost"
          active={post.reposted}
          activeCls="text-emerald-400"
          count={post.repostCount}
          icon={<Icon.Repeat size={19} />}
          onClick={() => act(post.reposted ? "unrepost" : "repost")}
          busy={busy === "repost"}
        />
        <ActionBtn
          label="Save"
          active={post.saved}
          activeCls="text-amber-400"
          icon={post.saved ? <Icon.BookmarkFill size={18} /> : <Icon.Bookmark size={18} />}
          onClick={() => act(post.saved ? "unsave" : "save")}
          busy={busy === "save"}
        />
        <ActionBtn
          label="Share"
          icon={<Icon.Share size={18} />}
          onClick={() => setShareOpen(true)}
          busy={false}
        />
      </div>

      {/* comments */}
      {commentsOpen && (
        <div className="mt-2 border-t border-[color:var(--line)] pt-3">
          {commentsLoading && <p className="text-xs text-[color:var(--muted)] py-2">Loading comments…</p>}
          {comments && comments.length === 0 && <p className="py-2 text-xs text-[color:var(--muted)]">No comments yet. Start the conversation.</p>}
          {comments?.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              onDelete={deleteComment}
              onReply={(cc) => {
                setReplyTo(cc);
                document.getElementById(`comment-input-${post.id}`)?.focus();
              }}
            />
          ))}
          {replyTo && (
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-[color:var(--muted)] mb-2">
              <span>Replying to <b className="text-[color:var(--text)]">@{replyTo.author.username}</b></span>
              <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><Icon.X size={14} /></button>
            </div>
          )}
          <div className="flex gap-2.5 pt-1">
            <Avatar src={me?.avatarUrl} name={me?.displayName ?? "You"} size={30} />
            <div className="flex-1 flex items-end gap-2">
              <Textarea
                id={`comment-input-${post.id}`}
                rows={1}
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                className="min-h-[40px] py-2 text-[13.5px]"
              />
              <Button size="sm" onClick={submitComment} loading={posting} disabled={!commentText.trim()} aria-label="Post comment">
                <Icon.Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Lightbox urls={media.map((m) => m.url)} index={lightbox} onClose={() => setLightbox(null)} setIndex={setLightbox} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} url={`${window.location.origin}/post/${post.id}`} />
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => act("delete")}
        title="Delete post?"
        desc="This permanently removes your post."
        confirmLabel="Delete"
        danger
        loading={busy === "delete"}
      />
    </article>
  );
}

type CommentItemProps = {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  me: boolean;
  author: { username: string; displayName: string; avatarUrl: string | null };
  parentName?: string | null;
};

function ActionBtn({
  icon,
  label,
  count,
  onClick,
  active,
  activeCls,
  busy,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
  active?: boolean;
  activeCls?: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label={`${label}${count ? ` (${count})` : ""}`}
      aria-pressed={active}
      className={cn(
        "group/act flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition hover:bg-white/6",
        active ? activeCls : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
      )}
    >
      <span className="transition group-hover/act:scale-110">{icon}</span>
      {!!count && count > 0 && <span className="tabular-nums">{formatCount(count)}</span>}
    </button>
  );
}
