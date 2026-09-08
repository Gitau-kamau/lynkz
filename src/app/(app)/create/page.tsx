"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PostComposer, { MediaPicker, type MediaItem } from "@/components/Composer";
import { Button, Field, Input, Select, Textarea, Tabs, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { CATEGORIES } from "@/lib/utils";

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = params.get("tab") === "lynk" ? "lynk" : params.get("tab") === "room" ? "room" : params.get("tab") === "drop" ? "drop" : "post";
  const [tab, setTab] = useState(initialTab);
  const { me } = useSession();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Icon.Plus size={20} className="text-[color:var(--a2)]" /> Create
      </h1>
      <p className="text-[13px] text-[color:var(--muted)] -mt-2">
        Hey {me?.displayName?.split(" ")[0]} — what are you sharing today?
      </p>
      <Tabs
        tabs={[
          { id: "post", label: "📝 Post" },
          { id: "lynk", label: "⚡ LYNK" },
          { id: "room", label: "🏠 Room" },
          { id: "drop", label: "🎯 DROP" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "post" && <PostComposer onCreated={() => setTimeout(() => router.push("/home"), 900)} autoFocus />}
      {tab === "lynk" && <LynkComposer />}
      {tab === "room" && <RoomComposer />}
      {tab === "drop" && <DropComposer />}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateInner />
    </Suspense>
  );
}

/* ---------------- LYNK composer ---------------- */
const LYNK_TYPES = [
  { id: "photo", label: "Photo", icon: <Icon.Camera size={16} /> },
  { id: "video", label: "Video", icon: <Icon.Video size={16} /> },
  { id: "text", label: "Text", icon: <Icon.At size={16} /> },
  { id: "poll", label: "Poll", icon: <Icon.Poll size={16} /> },
  { id: "question", label: "Question", icon: <Icon.Question size={16} /> },
  { id: "music", label: "Music", icon: <Icon.Music size={16} /> },
] as const;

function LynkComposer() {
  const [type, setType] = useState<(typeof LYNK_TYPES)[number]["id"]>("photo");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit =
    type === "photo" || type === "video"
      ? media.length > 0
      : type === "poll"
        ? pollQ.trim() && pollOpts.filter((o) => o.trim()).length >= 2
        : type === "music"
          ? musicTitle.trim()
          : content.trim().length > 0 || media.length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/lynks", {
        body: {
          type,
          content: content.trim() || (type === "music" ? musicTitle.trim() : ""),
          mediaUrl: media[0]?.url ?? null,
          poll:
            type === "poll"
              ? { question: pollQ.trim(), options: pollOpts.map((o) => o.trim()).filter(Boolean) }
              : null,
          music: type === "music" ? { title: musicTitle.trim(), artist: musicArtist.trim() } : null,
        },
      });
      toast("LYNK posted! It'll vanish in 24 hours ⚡");
      routerPage();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post LYNK.", "err");
    } finally {
      setBusy(false);
    }
  };

  const routerPage = () => window.setTimeout(() => (window.location.href = "/lynks"), 700);

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="text-[13px] font-semibold mb-2 flex items-center gap-2">
          <Icon.Link size={15} className="text-[color:var(--a2)]" /> LYNK type
          <span className="text-[11px] font-normal text-[color:var(--muted)]">· disappears in 24h</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LYNK_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[13px] font-semibold transition ${
                type === t.id ? "grad text-white border-transparent shadow" : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)]/50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {(type === "photo" || type === "video") && (
        <MediaPicker media={media} setMedia={setMedia} multiple={false} compact />
      )}
      {type === "text" && (
        <Textarea rows={4} maxLength={280} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Say it before it's gone…" />
      )}
      {type === "question" && (
        <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ask the room something…" />
      )}
      {type === "poll" && (
        <div className="space-y-2.5">
          <Input value={pollQ} onChange={(e) => setPollQ(e.target.value)} placeholder="Poll question" />
          {pollOpts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input value={o} onChange={(e) => setPollOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
              {pollOpts.length > 2 && (
                <button onClick={() => setPollOpts((p) => p.filter((_, j) => j !== i))} className="grid h-10 w-10 place-items-center rounded-xl text-rose-400 hover:bg-rose-500/10" aria-label={`Remove option ${i + 1}`}>
                  <Icon.X size={15} />
                </button>
              )}
            </div>
          ))}
          {pollOpts.length < 4 && <Button variant="soft" size="sm" onClick={() => setPollOpts((p) => [...p, ""])}><Icon.Plus size={13} /> Add option</Button>}
        </div>
      )}
      {type === "music" && (
        <div className="space-y-2.5">
          <Field label="Song title"><Input value={musicTitle} onChange={(e) => setMusicTitle(e.target.value)} placeholder="Midnight City" /></Field>
          <Field label="Artist"><Input value={musicArtist} onChange={(e) => setMusicArtist(e.target.value)} placeholder="M83" /></Field>
        </div>
      )}

      <div className="border-t border-[color:var(--line)] pt-4 flex justify-end">
        <Button onClick={submit} loading={busy} disabled={!canSubmit}>
          <Icon.Link size={15} /> Post LYNK
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Room composer ---------------- */
function RoomComposer() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Gaming");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (name.trim().length < 3) return toast("Room name must be at least 3 characters.", "err");
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/rooms", {
        body: { name: name.trim(), description: description.trim(), category },
      });
      toast("LYNK ROOM created! 🏠");
      router.push(`/rooms/${res.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create room.", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl grad text-white"><Icon.Users size={19} /></span>
        <p className="text-[13px] text-[color:var(--muted)]">
          Rooms are temporary communities around a topic. You'll be the room creator — you can pin posts, mute people and close the room.
        </p>
      </div>
      <Field label="Room name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late Night Gaming" autoFocus />
      </Field>
      <Field label="Description">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this room about?" />
      </Field>
      <Field label="Category">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button onClick={submit} loading={busy} disabled={name.trim().length < 3}>
          <Icon.Users size={15} /> Create room
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Drop composer ---------------- */
function DropComposer() {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("challenge");
  const [category, setCategory] = useState("Other");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (prompt.trim().length < 5) return toast("Give your DROP a longer prompt.", "err");
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/drops", {
        body: { prompt: prompt.trim(), kind, category },
      });
      toast("DROP dropped! 🎯");
      router.push(`/drops/${res.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create DROP.", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-400"><Icon.Zap size={19} /></span>
        <p className="text-[13px] text-[color:var(--muted)]">
          A LYNK DROP is a challenge or prompt the community responds to. Examples: “Show your setup”, “What song are you listening to?”
        </p>
      </div>
      <Field label="Prompt">
        <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Show your setup 🖥️" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="challenge">Challenge</option>
            <option value="question">Question</option>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Other</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} loading={busy} disabled={prompt.trim().length < 5}>
          <Icon.Zap size={15} /> Drop it
        </Button>
      </div>
    </div>
  );
}
