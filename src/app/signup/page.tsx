"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LynkLogo } from "@/components/Logo";
import { Avatar, Button, Field, Input, toast } from "@/components/ui";
import { api } from "@/lib/client";
import { readFileDataUrl } from "@/components/Composer";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickAvatar = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const item = await readFileDataUrl(f, "image");
      setAvatar(item.url);
      setAvatarErr(null);
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Could not load image.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const username = form.username.trim().toLowerCase().replace(/^@/, "");
    if (form.name.trim().length < 2) return setErr("Please enter your full name.");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return setErr("Username must be 3-20 characters (letters, numbers, underscores).");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setErr("Please enter a valid email address.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      await api("/api/auth", {
        body: {
          action: "register",
          displayName: form.name.trim(),
          username,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          avatar,
        },
      });
      toast("Welcome to LYNKZ! 🎉");
      router.push("/onboarding");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -bottom-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, var(--a2), transparent 65%)" }} />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="LYNKZ home"><LynkLogo size={40} withWord /></Link>
        </div>
        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">Join the network. It takes a minute.</p>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative group shrink-0"
                aria-label="Choose profile picture"
              >
                <Avatar src={avatar} name={form.name || "You"} size={64} />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition text-[10px] font-bold">
                  PHOTO
                </span>
              </button>
              <div className="text-[12px] text-[color:var(--muted)]">
                <p className="font-semibold text-[color:var(--text)]">Profile picture</p>
                <p>Optional · max 5 MB</p>
                {avatarErr && <p className="text-rose-400">{avatarErr}</p>}
                {avatar && (
                  <button type="button" onClick={() => setAvatar(null)} className="text-rose-400 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files)} aria-hidden="true" />
            </div>
            <Field label="Full name">
              <Input value={form.name} onChange={set("name")} placeholder="Alex Rivera" autoComplete="name" autoFocus />
            </Field>
            <Field label="Username">
              <Input value={form.username} onChange={set("username")} placeholder="alex_lynkz" autoComplete="username" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Password">
                <Input type="password" value={form.password} onChange={set("password")} placeholder="Min 8 chars" autoComplete="new-password" />
              </Field>
              <Field label="Confirm">
                <Input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat" autoComplete="new-password" />
              </Field>
            </div>
            {err && (
              <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-400/25 px-3.5 py-2.5 text-[13px] text-rose-300">
                {err}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              Create account
            </Button>
            <p className="text-center text-[11px] text-[color:var(--muted)]">
              By signing up you agree to the LYNKZ community guidelines.
            </p>
          </form>
        </div>
        <p className="mt-5 text-center text-[13px] text-[color:var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[color:var(--a1)] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
