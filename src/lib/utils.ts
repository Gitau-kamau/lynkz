export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function timeAgo(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts).getTime();
  const s = Math.max(0, (Date.now() - d) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clockTime(ts: string | Date) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function parseTags(content: string): string[] {
  const out = new Set<string>();
  const re = /\B#([a-zA-Z0-9_]{1,40})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) out.add(m[1].toLowerCase());
  return [...out];
}

export function parseMentions(content: string): string[] {
  const out = new Set<string>();
  const re = /\B@([a-zA-Z0-9_]{1,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) out.add(m[1].toLowerCase());
  return [...out];
}

export const CATEGORIES = [
  "Gaming",
  "Music",
  "School",
  "Sports",
  "Technology",
  "Fashion",
  "Movies",
  "Local",
];

export const INTERESTS = [
  "Gaming",
  "Music",
  "Sports",
  "Technology",
  "Fashion",
  "Movies",
  "Art",
  "Food",
  "Travel",
  "Fitness",
  "Photography",
  "Science",
  "Anime",
  "Coding",
  "Fashion",
  "Books",
  "Cars",
  "Nature",
];

export const EMOJIS = [
  "🔥", "❤️", "😂", "😍", "🥳", "😎", "🤩", "👍", "🙌", "💯",
  "👀", "🎉", "⚡", "💜", "💙", "⭐", "😭", "🤔", "😮", "🫡",
  "🎮", "🎵", "🎬", "📸", "⚽", "🏀", "🏆", "🚀", "🌈", "🍕",
  "🌍", "✨", "🧠", "💎", "☕", "🎧", "🛹", "🐶", "🌙", "🤖",
  "👾", "🎨", "📚", "💰", "🧩", "🔮", "💬", "😇", "🥶", "🤯",
];

export const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Violence",
  "Sexual content",
  "Scams",
  "Other",
];

export const ACCENTS: { id: string; name: string; c1: string; c2: string }[] = [
  { id: "purple", name: "Electric Purple", c1: "#8b5cf6", c2: "#22d3ee" },
  { id: "cyan", name: "Cyber Cyan", c1: "#06b6d4", c2: "#3b82f6" },
  { id: "blue", name: "Nova Blue", c1: "#3b82f6", c2: "#8b5cf6" },
  { id: "pink", name: "Neon Pink", c1: "#ec4899", c2: "#8b5cf6" },
  { id: "amber", name: "Solar Amber", c1: "#f59e0b", c2: "#ef4444" },
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Sever-side + client: validate a data-URL media string. Returns error text or null. */
export function validateMediaDataUrl(url: string, kind: "image" | "video"): string | null {
  const m = /^data:(image|video)\/([a-zA-Z0-9.+-]+);base64,(.+)$/.exec(url);
  if (!m) return "Unsupported file type.";
  const isImage = m[1] === "image";
  const ext = m[2].toLowerCase();
  const allowedImages = ["jpeg", "jpg", "png", "gif", "webp", "avif"];
  const allowedVideos = ["mp4", "webm"];
  if (kind === "image" && !allowedImages.includes(ext)) return "Unsupported image format.";
  if (kind === "video" && !allowedVideos.includes(ext)) return "Unsupported video format.";
  const bytes = (m[3].length * 3) / 4 - (m[3].includes("=") ? 2 : 0);
  const max = kind === "image" ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
  if (bytes > max) return kind === "image" ? "Image too large (max 5 MB)." : "Video too large (max 16 MB).";
  return null;
}

export const MAX_IMAGE_MB = 5;
export const MAX_VIDEO_MB = 16;

export function fileToSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}
