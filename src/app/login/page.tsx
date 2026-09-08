"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LynkLogo } from "@/components/Logo";
import { Button, Field, Input, toast } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErr("Please enter your email or username and password.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ onboardingDone: boolean }>("/api/auth", {
        body: { action: "login", identifier: identifier.trim(), password, remember },
      });
      toast(`Welcome back!`);
      router.push(res.onboardingDone ? "/home" : "/onboarding");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, var(--a1), transparent 65%)" }} />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="LYNKZ home"><LynkLogo size={40} withWord /></Link>
        </div>
        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-xl font-bold">Log in to LYNKZ</h1>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">Welcome back. Your world missed you.</p>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Field label="Email or username">
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or @username"
                autoComplete="username"
                autoFocus
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            <div className="flex items-center justify-between text-[13px]">
              <label className="flex items-center gap-2 text-[color:var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded accent-[color:var(--a1)]"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="font-semibold text-[color:var(--a2)] hover:underline">
                Forgot password?
              </Link>
            </div>
            {err && (
              <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-400/25 px-3.5 py-2.5 text-[13px] text-rose-300">
                {err}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              Log in
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-[13px] text-[color:var(--muted)]">
          New to LYNKZ?{" "}
          <Link href="/signup" className="font-bold text-[color:var(--a1)] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
