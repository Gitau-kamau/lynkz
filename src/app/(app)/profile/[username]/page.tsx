"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Confirm, EmptyState, ErrorState, Modal, PageLoader, Tabs, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { formatCount, timeAgo } from "@/lib/utils";
import { FollowButton, ReportModal, ShareModal } from "@/components/interact";
import PostCard, { type PostDTO } from "@/components/PostCard";
import { type LynkDTO } from "@/components/Lynks";
import { LynkViewer } from "@/components/Lynks";

type ProfileData = {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string;
    website: string;
    location: string;
    isVerified: boolean;
    isPrivate: boolean;
    createdAt: string;
    online: boolean;
    followers: number;
    following: number;
    postsCount: number;
  };
  me: { following: boolean; pending: boolean; blocked: boolean; muted: boolean; requests: { id: string; username: string; displayName: string; avatarUrl: string | null }[] };
  canView: boolean;
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me } = useSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState<PostDTO[] | null>(null);
  const [lynks, setLynks] = useState<LynkDTO[] | null>(null);
  const [lynkIdx, setLynkIdx] = useState<number | null>(null);
  const [listModal, setListModal] = useState<null | "followers" | "following" | "requests">(null);
  const [listData, setListData] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null; verified?: boolean }[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<ProfileData>(`/api/users/${username}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile.");
    }
  }, [username]);

  useEffect(() => {
    load();
    setTab("posts");
    setPosts(null);
    setLynks(null);
  }, [load, username]);

  const loadTab = useCallback(async () => {
    if (!data) return;
    setPosts(null);
    setLynks(null);
    try {
      if (tab === "posts" || tab === "media") {
        const res = await api<{ items: PostDTO[] }>(`/api/posts?type=${tab}&user=${encodeURIComponent(username)}&limit=20`);
        setPosts(res.items);
      } else if (tab === "saved") {
        const res = await api<{ items: PostDTO[] }>(`/api/posts?type=saved&limit=20`);
        setPosts(res.items);
      } else if (tab === "lynks") {
        const res = await api<{ items: LynkDTO[] }>(`/api/lynks?scope=user&user=${encodeURIComponent(username)}`);
        setLynks(res.items);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load tab.", "err");
      setPosts([]);
    }
  }, [data, tab, username]);

  useEffect(() => {
    if (data) loadTab();
  }, [data, loadTab]);

  const openList = async (kind: "followers" | "following" | "requests") => {
    setListModal(kind);
    setListLoading(true);
    try {
      const res = await api<{ items: { id: string; username: string; displayName: string; avatarUrl: string | null }[] }>(
        `/api/users/${username}?list=${kind}`
      );
      setListData(res.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load list.", "err");
      setListData([]);
    } finally {
      setListLoading(false);
    }
  };

  const block = async () => {
    setChecking(true);
    try {
      await api(`/api/users/${data!.user.id}`, { body: { type: "block" } });
      toast("User blocked.");
      setBlockConfirm(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not block.", "err");
    } finally {
      setChecking(false);
    }
  };

  const unblock = async () => {
    setChecking(true);
    try {
      await api(`/api/users/${data!.user.id}`, { body: { type: "unblock" } });
      toast("User unblocked.");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not unblock.", "err");
    } finally {
      setChecking(false);
    }
  };

  const toggleMute = async () => {
    setChecking(true);
    const type = data!.me.muted ? "unmute" : "mute";
    try {
      await api(`/api/users/${data!.user.id}`, { body: { type } });
      toast(data!.me.muted ? "User unmuted." : "User muted — their content won't appear in your feed.");
      setData((d) => (d ? { ...d, me: { ...d.me, muted: !d.me.muted } } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "err");
    } finally {
      setChecking(false);
    }
  };

  const handleRequest = async (type: string, requester: string, usernameReq: string) => {
    try {
      await api(`/api/users/${requester}`, { body: { type } });
      toast(type === "accept" ? "Follow request accepted." : "Request declined.");
      setData((d) => (d ? { ...d, me: { ...d.me, requests: d.me.requests.filter((r) => r.username !== usernameReq) } } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not process request.", "err");
    }
  };

  if (error) {
    return <div className="card"><ErrorState msg={error} onRetry={load} /></div>;
  }
  if (!data || !me) return <PageLoader label="Loading profile…" />;

  const isOwn = me.id === data.user.id;
  const p = data.user;

  return (
    <div className="space-y-4">
      {/* header card */}
      <div className="card overflow-hidden">
        <div className="relative h-28 sm:h-36 bg-gradient-to-br from-[color:var(--a1)]/40 via-transparent to-[color:var(--a2)]/40">
          {p.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 sm:-mt-12">
            <span className="rounded-full p-1 bg-[color:var(--bg)]">
              <Avatar src={p.avatarUrl} name={p.displayName} size={88} />
            </span>
            <div className="flex items-center gap-2 pb-1">
              {!isOwn && (
                <>
                  <Button variant="soft" size="sm" onClick={() => setShareOpen(true)} aria-label="Share profile">
                    <Icon.Share size={15} />
                  </Button>
                  <Button variant="soft" size="sm" onClick={() => routerMessage(p.username)} aria-label="Message">
                    <Icon.Chat size={15} />
                  </Button>
                  {data.me.blocked ? (
                    <Button variant="danger" size="sm" onClick={unblock} loading={checking}>Unblock</Button>
                  ) : (
                    <FollowButton userId={p.id} initial={data.me.following} initialPending={data.me.pending} onChange={() => load()} />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-display text-xl font-bold">{p.displayName}</h1>
              {p.isVerified && <Icon.Check size={16} className="text-[color:var(--a2)]" />}
              {isOwn && <Link href="/settings" className="text-xs font-semibold text-[color:var(--a2)] hover:underline">Edit profile</Link>}
            </div>
            <p className="text-[13px] text-[color:var(--muted)]">@{p.username} {p.isPrivate && <Icon.Lock size={11} className="inline" />}</p>
            {p.bio && <p className="mt-2 text-[14px] leading-relaxed">{p.bio}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[color:var(--muted)]">
              {p.location && <span className="flex items-center gap-1"><Icon.MapPin size={12} /> {p.location}</span>}
              {p.website && (
                <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[color:var(--a2)] hover:underline">
                  <Icon.Link size={12} /> {p.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span>Joined {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
            </div>
            <div className="mt-3 flex gap-5 text-[13px]">
              <button onClick={() => openList("following")} className="hover:underline"><b>{formatCount(p.following)}</b> <span className="text-[color:var(--muted)]">Following</span></button>
              <button onClick={() => openList("followers")} className="hover:underline"><b>{formatCount(p.followers)}</b> <span className="text-[color:var(--muted)]">Followers</span></button>
              <span><b>{formatCount(p.postsCount)}</b> <span className="text-[color:var(--muted)]">Posts</span></span>
            </div>
            {!isOwn && data.me.requests.length > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-amber-300">
                <Icon.Clock size={13} /> {data.me.requests.length} pending follow request{data.me.requests.length > 1 ? "s" : ""} —{" "}
                <button onClick={() => openList("requests")} className="font-bold underline">Review</button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* tabs */}
      <Tabs
        tabs={[
          { id: "posts", label: "Posts" },
          { id: "media", label: "Media" },
          ...(isOwn ? [{ id: "saved", label: "Saved" }] : []),
          { id: "lynks", label: "⚡ LYNKs" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "lynks" && lynks && lynks.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {lynks.map((l, i) => (
            <button key={l.id} onClick={() => setLynkIdx(i)} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]" aria-label={`LYNK ${i + 1}`}>
              <span className="rounded-full p-[2.5px] grad">
                <span className="block rounded-full p-[2.5px] bg-[color:var(--bg)]">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/8">
                    {l.type === "photo" || l.type === "video" ? <Icon.Camera size={20} /> : l.type === "poll" ? <Icon.Poll size={20} /> : l.type === "music" ? <Icon.Music size={20} /> : l.type === "question" ? <Icon.Question size={20} /> : <Icon.At size={20} />}
                  </span>
                </span>
              </span>
              <span className="text-[10.5px] text-[color:var(--muted)]">{timeAgo(l.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
      {lynkIdx !== null && lynks && (
        <LynkViewer lynks={lynks} startIndex={lynkIdx} onClose={() => setLynkIdx(null)} onChanged={(u) => setLynks((ls) => ls?.map((l) => (l.id === u.id ? u : l)) ?? ls)} />
      )}

      {posts === null && lynks === null && <PageLoader label="Loading…" />}

      {tab !== "lynks" && posts !== null && posts.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Icon.Sparkles size={24} />}
            title={tab === "saved" ? "No saved posts" : "No posts yet"}
            desc={tab === "saved" ? "Posts you save will appear here." : "When this user posts, it'll show up here."}
            action={isOwn && tab === "posts" ? <Link href="/create"><Button><Icon.Plus size={15} /> Create your first post</Button></Link> : undefined}
          />
        </div>
      )}
      {posts?.map((p) => <PostCard key={p.id} post={p} onUpdate={(np) => setPosts((ps) => ps?.map((x) => (x.id === np.id ? np : x)) ?? ps)} />)}

      {tab === "lynks" && lynks !== null && lynks.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Icon.Link size={24} />}
            title="No active LYNKs"
            desc="LYNKs disappear after 24 hours. When there's one, it'll glow here."
            action={isOwn ? <Link href="/create?tab=lynk"><Button><Icon.Plus size={15} /> Create a LYNK</Button></Link> : undefined}
          />
        </div>
      )}

      {/* lists modal */}
      <Modal open={listModal !== null} onClose={() => setListModal(null)} title={listModal === "followers" ? "Followers" : listModal === "following" ? "Following" : "Follow requests"}>
        <div className="p-3">
          {listLoading && <p className="text-center text-sm text-[color:var(--muted)] py-6">Loading…</p>}
          {!listLoading && listData.length === 0 && (
            <p className="text-center text-sm text-[color:var(--muted)] py-6">
              {listModal === "followers" ? "No followers yet." : listModal === "requests" ? "No pending requests." : "Not following anyone yet."}
            </p>
          )}
          {listData.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2">
              <Link href={`/profile/${u.username}`} className="flex flex-1 items-center gap-3 min-w-0" onClick={() => setListModal(null)}>
                <Avatar src={u.avatarUrl} name={u.displayName} size={38} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold truncate">{u.displayName}</span>
                  <span className="block text-xs text-[color:var(--muted)]">@{u.username}</span>
                </span>
              </Link>
              {listModal === "requests" && (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => handleRequest("accept", u.id, u.username)}><Icon.Check size={13} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRequest("reject", u.id, u.username)}><Icon.X size={13} /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={data.user.id} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} url={`${window.location.origin}/profile/${data.user.username}`} />

      {!isOwn && (
        <div className="flex justify-center gap-2 text-[12.5px]">
          <button onClick={toggleMute} disabled={checking} className="text-[color:var(--muted)] hover:text-[color:var(--text)] font-medium">
            {data.me.muted ? "Unmute" : "Mute"} {data.user.username}
          </button>
          <span className="text-[color:var(--muted)]">·</span>
          {data.me.blocked ? (
            <span className="text-[color:var(--muted)]">Blocked</span>
          ) : (
            <button onClick={() => setBlockConfirm(true)} className="text-[color:var(--muted)] hover:text-rose-400 font-medium">Block user</button>
          )}
          <span className="text-[color:var(--muted)]">·</span>
          <button onClick={() => setReportOpen(true)} className="text-[color:var(--muted)] hover:text-rose-400 font-medium">Report</button>
        </div>
      )}

      <Confirm
        open={blockConfirm}
        onClose={() => setBlockConfirm(false)}
        onConfirm={block}
        title={`Block @${data.user.username}?`}
        desc="They won't be able to follow you, message you, or interact with your content. You won't see their posts either."
        confirmLabel="Block"
        danger
        loading={checking}
      />
    </div>
  );
}

function routerMessage(username: string) {
  window.location.href = `/messages?to=${username}`;
}
