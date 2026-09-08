"use client";

import { useRef, useState } from "react";
import { Avatar, Button, Field, Input, Select, Textarea, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { cn, fileToSizeLabel, MAX_IMAGE_MB, MAX_VIDEO_MB, validateMediaDataUrl } from "@/lib/utils";

export type MediaItem = { url: string; type: "image" | "video"; name: string; size: number };

/** Reads a file into a data URL with progress + validation. */
export function readFileDataUrl(file: File, kind: "image" | "video", onProgress?: (pct: number) => void): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const max = kind === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
    if (file.size > max * 1024 * 1024) {
      reject(new Error(`${kind === "image" ? "Image" : "Video"} too large (max ${max} MB).`));
      return;
    }
    const ok = kind === "image" ? file.type.startsWith("image/") : file.type === "video/mp4" || file.type === "video/webm";
    if (!ok) reject(new Error(`Unsupported ${kind} format. Use ${kind === "image" ? "JPG, PNG, GIF, WEBP" : "MP4 or WEBM"}.`));
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = () => {
      const url = String(reader.result);
      const err = validateMediaDataUrl(url, kind);
      if (err) reject(new Error(err));
      else resolve({ url, type: kind, name: file.name, size: file.size });
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function MediaPicker({
  media,
  setMedia,
  multiple = true,
  compact,
}: {
  media: MediaItem[];
  setMedia: (m: MediaItem[]) => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    const next: MediaItem[] = [];
    for (const f of Array.from(files).slice(0, multiple ? 4 : 1)) {
      const kind = f.type.startsWith("image/") ? ("image" as const) : ("video" as const);
      try {
        const item = await readFileDataUrl(f, kind, setProgress);
        next.push(item);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    setProgress(null);
    if (next.length) {
      setMedia(multiple ? [...media, ...next].slice(0, 4) : next.slice(0, 1));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm"
        multiple={multiple}
        className="hidden"
        aria-hidden="true"
        onChange={(e) => pick(e.target.files)}
      />
      {media.length > 0 && (
        <div className={cn("grid gap-2 mb-3", media.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {media.map((m, i) => (
            <div key={i} className="relative group rounded-2xl overflow-hidden border border-[color:var(--line)]">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="w-full max-h-72 object-cover" />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={m.url} className="w-full max-h-72 object-cover" muted playsInline />
              )}
              <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur">
                {m.type === "video" ? "Video" : "Image"} · {fileToSizeLabel(m.size)}
              </span>
              <button
                onClick={() => setMedia(media.filter((_, j) => j !== i))}
                className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-rose-500/80 transition"
                aria-label={`Remove ${m.name}`}
              >
                <Icon.X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="soft" size="sm" onClick={() => fileRef.current?.click()} disabled={media.length >= 4}>
          <Icon.Image size={15} /> {media.length ? "Add more" : "Add media"}
        </Button>
        {!compact && (
          <span className="text-[11px] text-[color:var(--muted)]">
            JPG/PNG/GIF/WEBP up to {MAX_IMAGE_MB} MB · MP4/WEBM up to {MAX_VIDEO_MB} MB
          </span>
        )}
      </div>
      {progress !== null && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <span className="h-1.5 w-32 rounded-full bg-white/10 overflow-hidden">
            <span className="block h-full grad transition-all" style={{ width: `${progress}%` }} />
          </span>
          Uploading… {progress}%
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-400" role="alert">{err}</p>}
    </div>
  );
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 4,
  onTagged,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  onTagged?: (username: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<{ username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handle = (v: string) => {
    onChange(v);
    const m = /\B@([a-zA-Z0-9_]{1,30})$/.exec(v);
    if (m && timer.current) clearTimeout(timer.current);
    if (m) {
      timer.current = setTimeout(async () => {
        setBusy(true);
        try {
          const res = await api<{ users: { username: string; displayName: string; avatarUrl: string | null }[] }>(
            `/api/users?q=${encodeURIComponent(m[1]!)}&limit=4`
          );
          setSuggestions(res.users);
        } catch {
          setSuggestions([]);
        } finally {
          setBusy(false);
        }
      }, 250);
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div className="relative">
      <Textarea rows={rows} value={value} onChange={(e) => handle(e.target.value)} placeholder={placeholder} className="text-[15px]" />
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-30 w-72 card bg-[color:var(--bg2)] p-1.5 shadow-2xl mt-1 modal-in">
          {suggestions.map((s) => (
            <button
              key={s.username}
              onClick={() => {
                const base = value.replace(/\B@([a-zA-Z0-9_]{1,30})$/, "");
                onChange(base + "@" + s.username + " ");
                setSuggestions([]);
                onTagged?.(s.username);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-white/6"
            >
              <Avatar src={s.avatarUrl} name={s.displayName} size={26} />
              <span className="text-[13px]"><b>{s.displayName}</b> <span className="text-[color:var(--muted)]">@{s.username}</span></span>
            </button>
          ))}
        </div>
      )}
      {busy && <span className="sr-only" role="status">Searching users…</span>}
    </div>
  );
}

export type PostDraft = {
  content: string;
  media: MediaItem[];
  location: string;
  visibility: "everyone" | "followers" | "only_me";
  question: string;
  poll: { question: string; options: string[] } | null;
};

export default function PostComposer({
  onCreated,
  autoFocus,
}: {
  onCreated?: (postId: string) => void;
  autoFocus?: boolean;
}) {
  const { me } = useSession();
  const [draft, setDraft] = useState<PostDraft>({
    content: "",
    media: [],
    location: "",
    visibility: "everyone",
    question: "",
    poll: null,
  });
  const [busy, setBusy] = useState(false);

  const canPost =
    draft.content.trim().length > 0 ||
    draft.media.length > 0 ||
    draft.question.trim().length > 0 ||
    (draft.poll && draft.poll.question.trim() && draft.poll.options.filter((o) => o.trim()).length >= 2);

  const submit = async () => {
    if (!canPost || busy) return;
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/posts", {
        body: {
          content: draft.content.trim(),
          media: draft.media.map((m) => ({ url: m.url, type: m.type })),
          location: draft.location.trim(),
          visibility: draft.visibility,
          question: draft.question.trim(),
          poll: draft.poll
            ? {
                question: draft.poll.question.trim(),
                options: draft.poll.options.map((o) => o.trim()).filter(Boolean),
              }
            : null,
        },
      });
      toast("Post published.");
      setDraft({ content: "", media: [], location: "", visibility: "everyone", question: "", poll: null });
      onCreated?.(res.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not publish post.", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar src={me?.avatarUrl} name={me?.displayName ?? "You"} size={42} />
        <div className="flex-1 min-w-0">
          <MentionInput
            value={draft.content}
            onChange={(v) => setDraft((d) => ({ ...d, content: v }))}
            placeholder="What's happening?"
            rows={3}
          />
        </div>
      </div>

      {draft.poll ? (
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-white/3 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] font-semibold"><Icon.Poll size={15} className="text-[color:var(--a2)]" /> Poll</p>
            <button onClick={() => setDraft((d) => ({ ...d, poll: null }))} className="text-xs text-rose-400 hover:underline">Remove</button>
          </div>
          <Input
            placeholder="Poll question"
            value={draft.poll.question}
            onChange={(e) => setDraft((d) => ({ ...d, poll: { ...d.poll!, question: e.target.value } }))}
          />
          {draft.poll.options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) =>
                  setDraft((d) => {
                    const opts = [...d.poll!.options];
                    opts[i] = e.target.value;
                    return { ...d, poll: { ...d.poll!, options: opts } };
                  })
                }
              />
              {draft.poll && draft.poll.options.length > 2 && (
                <button
                  onClick={() => {
                    setDraft((d) => {
                      if (!d.poll) return d;
                      const opts = d.poll.options.filter((_, j) => j !== i);
                      return { ...d, poll: { ...d.poll, options: opts } };
                    });
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl text-rose-400 hover:bg-rose-500/10"
                  aria-label={`Remove option ${i + 1}`}
                >
                  <Icon.X size={15} />
                </button>
              )}
            </div>
          ))}
          {draft.poll.options.length < 4 && (
            <Button
              variant="soft"
              size="sm"
              onClick={() =>
                setDraft((d) => (d.poll ? { ...d, poll: { ...d.poll, options: [...d.poll.options, ""] } } : d))
              }
            >
              <Icon.Plus size={14} /> Add option
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3">
            <MediaPicker media={draft.media} setMedia={(media) => setDraft((d) => ({ ...d, media }))} />
          </div>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, poll: { question: "", options: ["", ""] } }))}>
              <Icon.Poll size={15} /> Poll
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, question: d.question ? "" : "…" }))}>
              <Icon.Question size={15} /> Question
            </Button>
            <Button variant="ghost" size="sm">
              <Icon.At size={15} /> Mention
            </Button>
          </div>
        </>
      )}

      {draft.question && (
        <div className="mt-3 flex gap-2">
          <Icon.Question size={16} className="text-[color:var(--a2)] mt-2.5 shrink-0" />
          <Input
            autoFocus={draft.question === "…"}
            placeholder="Ask a question…"
            value={draft.question === "…" ? "" : draft.question}
            onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Icon.MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
            <Input
              placeholder="Add location"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              className="pl-9 h-9 w-44 text-[13px]"
              aria-label="Add location"
            />
          </div>
          <Select
            value={draft.visibility}
            onChange={(e) => setDraft((d) => ({ ...d, visibility: e.target.value as PostDraft["visibility"] }))}
            className="h-9 w-36 text-[13px]"
            aria-label="Visibility"
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="only_me">Only me</option>
          </Select>
        </div>
        <Button onClick={submit} loading={busy} disabled={!canPost}>
          <Icon.Send size={15} /> Post
        </Button>
      </div>
    </div>
  );
}
