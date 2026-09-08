"use client";

import Link from "next/link";
import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn, initials } from "@/lib/utils";
import { Icon } from "@/components/icons";
import { LynkLogoMark } from "@/components/Logo";

/* ---------------- Toasts ---------------- */
type Toast = { id: string; msg: string; kind: "ok" | "err" | "info" };
export function toast(msg: string, kind: Toast["kind"] = "ok") {
  window.dispatchEvent(new CustomEvent("lynkz-toast", { detail: { msg, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { msg, kind } = (e as CustomEvent).detail as { msg: string; kind: Toast["kind"] };
      const id = Math.random().toString(36).slice(2);
      setItems((p) => [...p, { id, msg, kind }]);
      setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3600);
    };
    window.addEventListener("lynkz-toast", on);
    return () => window.removeEventListener("lynkz-toast", on);
  }, []);
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none px-4 w-full">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "toast-in pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur border",
            t.kind === "ok" && "bg-emerald-500/15 border-emerald-400/30 text-emerald-300",
            t.kind === "err" && "bg-rose-500/15 border-rose-400/30 text-rose-300",
            t.kind === "info" && "bg-cyan-500/15 border-cyan-400/30 text-cyan-200"
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  src,
  name,
  size = 40,
  className,
  ring,
  online,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  ring?: boolean;
  online?: boolean;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className={cn(
            "h-full w-full rounded-full object-cover bg-white/5",
            ring && "ring-2 ring-[color:var(--line)]"
          )}
        />
      ) : (
        <span
          className={cn(
            "h-full w-full rounded-full grid place-items-center font-semibold text-white grad",
            ring && "ring-2 ring-[color:var(--line)]"
          )}
          style={{ fontSize: size * 0.38 }}
          aria-label={name}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[color:var(--card)]" />
      )}
    </span>
  );
}

export function Verified({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" className={cn("shrink-0", className)} aria-label="Verified">
      <path
        fill="currentColor"
        d="M12 1.8 14.6 4l3.3-.4 1 3.2 3 1.4-.9 3.2.9 3.2-3 1.4-1 3.2-3.3-.4L12 21.6 9.4 19l-3.3.4-1-3.2-3-1.4.9-3.2-.9-3.2 3-1.4 1-3.2 3.3.4Z"
      />
      <path d="m8.6 12.2 2.3 2.3 4.5-4.8" stroke="#0b0b14" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Buttons & inputs ---------------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={cn(
        "btn inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--a2)] disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98]",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-[15px]",
        variant === "primary" && "grad text-white shadow-lg shadow-black/20",
        variant === "soft" && "bg-white/8 hover:bg-white/14 text-[color:var(--text)]",
        variant === "ghost" && "hover:bg-white/8 text-[color:var(--text)]",
        variant === "outline" && "border border-[color:var(--line)] hover:bg-white/6 text-[color:var(--text)]",
        variant === "danger" && "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-[color:var(--muted)]">
      <Spinner className="h-7 w-7 text-[color:var(--a2)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[color:var(--line)] bg-white/5 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[color:var(--muted)]/60 focus:border-[color:var(--a2)]/60 focus:bg-white/8";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "resize-none leading-relaxed", props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputCls, "appearance-none pr-8 bg-no-repeat bg-[right_0.75rem_center]", props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9cb0' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")",
      }}
    />
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium text-[color:var(--muted)]">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[color:var(--muted)]/70">{hint}</span>}
    </label>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6.5 w-11.5 h-7 w-12 rounded-full transition-colors shrink-0",
        checked ? "grad" : "bg-white/12"
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/7", className)} aria-hidden="true" />;
}
export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-5 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Empty / Error states ---------------- */
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-[color:var(--muted)]">
        {icon ?? <Icon.Sparkles size={24} />}
      </div>
      <div>
        <h3 className="font-semibold text-[15px]">{title}</h3>
        {desc && <p className="mt-1 text-sm text-[color:var(--muted)] max-w-sm">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
        <Icon.Shield size={22} />
      </div>
      <p className="text-sm text-[color:var(--muted)]">{msg}</p>
      {onRetry && (
        <Button variant="soft" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  bare,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 md:p-6" role="dialog" aria-modal="true" aria-label={title ?? "Dialog"}>
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          "relative w-full card overflow-hidden max-h-[90vh] flex flex-col modal-in bg-[color:var(--bg2)]",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        {!bare && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[color:var(--line)]">
            <h2 className="font-display font-semibold">{title}</h2>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 text-[color:var(--muted)]" aria-label="Close dialog">
              <Icon.X size={17} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  desc,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  desc?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="p-5 space-y-4">
        {desc && <p className="text-sm text-[color:var(--muted)]">{desc}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Rich text (hashtags/mentions) ---------------- */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  const re = /(\B#[a-zA-Z0-9_]{1,40}|\B@[a-zA-Z0-9_]{1,30})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("#")) {
      parts.push(
        <Link key={k++} href={`/hashtag/${tok.slice(1)}`} className="text-cyan-400 hover:underline font-medium">
          {tok}
        </Link>
      );
    } else {
      parts.push(
        <Link key={k++} href={`/profile/${tok.slice(1)}`} className="text-purple-400 hover:underline font-medium">
          {tok}
        </Link>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={cn("whitespace-pre-wrap break-words", className)}>{parts}</span>;
}

/* ---------------- Tabs ---------------- */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-2xl bg-white/5 p-1 overflow-x-auto no-scrollbar", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition whitespace-nowrap",
            value === t.id ? "grad text-white shadow" : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Infinite scroll ---------------- */
export function useInfinite<T>(fetchPage: (cursor: string | null) => Promise<{ items: T[]; next: string | null }>) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busyRef = useRef(false);

  const loadMore = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);
      try {
        const res = await fetchPage(cursor);
        setItems((p) => (append ? [...p, ...res.items] : res.items));
        setNext(res.next);
        if (!res.next) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        busyRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    loadMore(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !busyRef.current && !done) loadMore(next, true);
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [next, done, loadMore]);

  const retry = useCallback(() => loadMore(null, false), [loadMore]);
  const prepend = useCallback((item: T) => setItems((p) => [item, ...p]), []);
  const refresh = useCallback(() => loadMore(null, false), [loadMore]);

  return { items, loading, loadingMore, error, done, sentinelRef, retry, prepend, refresh, setItems };
}

/* ---------------- Misc ---------------- */
export function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="inline-flex rounded-xl bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
            value === o ? "grad text-white" : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Count() {
  return null;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-white/10 overflow-hidden", className)}>
      <div className="h-full rounded-full grad transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------------- Session/user context ---------------- */
export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  bio: string;
  location: string;
  website: string;
  isVerified: boolean;
  isAdmin: boolean;
  isPrivate: boolean;
  onboardingDone: boolean;
  interests: string[];
  prefs: Record<string, unknown>;
};

const SessionCtx = createContext<{ me: SessionUser | null; setMe: (u: SessionUser | null) => void }>({
  me: null,
  setMe: () => {},
});
export const useSession = () => useContext(SessionCtx);
export const SessionProvider = SessionCtx.Provider;

export function Splash() {
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[color:var(--bg)] splash-fade">
      <div className="flex flex-col items-center gap-4">
        <LynkLogoMark size={64} />
        <span className="font-display font-bold tracking-[0.35em] text-sm text-[color:var(--muted)]">LYNKZ</span>
        <span className="text-xs text-[color:var(--muted)]">Connect. Share. Discover.</span>
      </div>
    </div>
  );
}
