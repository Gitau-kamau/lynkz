"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LynkLogo } from "@/components/Logo";
import { Button, Field, Input, toast } from "@/components/ui";
import { api } from "@/lib/client";

function ForgotInner() {
  const router = useRouter();
  const params = useSearchParams();
  const hasToken = !!params.get("token");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await api<{ demoToken?: string }>("/api/auth", {
        body: { action: "forgot", email: email.trim() },
      });
      setSent(true);
      if (res.demoToken) {
        // Demo limitation: no email service configured, so we show the code inline.
        setToken(res.demoToken);
        toast("Reset code generated.");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not request reset.");
    } finally {
      setBusy(false);
    }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      await api("/api/auth", { body: { action: "reset", token: token.trim(), password: pw } });
      toast("Password updated. You can log in now.");
      router.push("/login");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="LYNKZ home"><LynkLogo size={40} withWord /></Link>
        </div>
        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-xl font-bold">{hasToken || token ? "Reset password" : "Forgot password"}</h1>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">
            {hasToken || token ? "Choose a new password for your account." : "We'll send you a reset code."}
          </p>

          {!sent && !(hasToken || token) && (
            <form onSubmit={requestReset} className="mt-5 space-y-4">
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              </Field>
              {err && <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-400/25 px-3.5 py-2.5 text-[13px] text-rose-300">{err}</p>}
              <Button type="submit" className="w-full" size="lg" loading={busy}>Send reset code</Button>
            </form>
          )}

          {sent && !hasToken && (
            <form onSubmit={doReset} className="mt-5 space-y-4">
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] text-amber-200">
                <b>Demo mode:</b> no email service is configured, so your reset code is shown here directly.
                <div className="mt-2 font-mono text-lg tracking-widest text-center bg-black/30 rounded-lg py-2">{token}</div>
              </div>
              <Field label="Reset code">
                <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter code" />
              </Field>
              <Field label="New password">
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 8 chars" />
              </Field>
              <Field label="Confirm password">
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat" />
              </Field>
              {err && <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-400/25 px-3.5 py-2.5 text-[13px] text-rose-300">{err}</p>}
              <Button type="submit" className="w-full" size="lg" loading={busy}>Set new password</Button>
            </form>
          )}

          {hasToken && (
            <form onSubmit={doReset} className="mt-5 space-y-4">
              <Field label="New password">
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 8 chars" autoFocus />
              </Field>
              <Field label="Confirm password">
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat" />
              </Field>
              {err && <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-400/25 px-3.5 py-2.5 text-[13px] text-rose-300">{err}</p>}
              <Button type="submit" className="w-full" size="lg" loading={busy}>Set new password</Button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-[13px] text-[color:var(--muted)]">
          Remembered it? <Link href="/login" className="font-bold text-[color:var(--a1)] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}
