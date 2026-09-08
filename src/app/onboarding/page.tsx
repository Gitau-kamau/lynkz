"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LynkLogo } from "@/components/Logo";
import { Avatar, Button, Textarea, toast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { readFileDataUrl } from "@/components/Composer";
import { INTERESTS, cn } from "@/lib/utils";

const STEPS = ["Profile", "Bio", "Interests", "Follow"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean }[] | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);

  const loadSuggested = async () => {
    if (suggested) return;
    try {
      const res = await api<{ users: typeof suggested }>("/api/users?type=suggested&limit=6");
      setSuggested(res.users ?? []);
    } catch {
      setSuggested([]);
    }
  };

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

  const finish = async () => {
    setBusy(true);
    try {
      await api("/api/onboarding", {
        body: {
          avatar,
          bio: bio.trim(),
          interests,
          followIds: [...following],
          skip: step < 3,
        },
      });
      toast("Welcome to LYNKZ! ⚡");
      router.push("/home");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not complete onboarding.", "err");
      setBusy(false);
    }
  };

  const toggleInterest = (i: string) =>
    setInterests((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const toggleFollow = (id: string) =>
    setFollowing((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, var(--a1), transparent 65%)" }} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6">
          <LynkLogo size={38} withWord />
        </div>
        {/* step indicator */}
        <div className="flex items-center justify-center gap-2 mb-5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 grad" : i < step ? "w-4 bg-[color:var(--a2)]/50" : "w-4 bg-white/15")} />
          ))}
        </div>

        <div className="card p-6 sm:p-7">
          {step === 0 && (
            <div className="text-center">
              <h1 className="font-display text-xl font-bold">Make it yours</h1>
              <p className="mt-1 text-[13px] text-[color:var(--muted)]">Add a profile picture — or skip and use your initials.</p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <button onClick={() => fileRef.current?.click()} className="group relative" aria-label="Choose profile picture">
                  <Avatar src={avatar} name="You" size={110} />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition">
                    <Icon.Camera size={26} />
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files)} aria-hidden="true" />
                {avatarErr && <p className="text-xs text-rose-400">{avatarErr}</p>}
                <div className="flex gap-2">
                  <Button variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
                    <Icon.Camera size={14} /> Upload photo
                  </Button>
                  {avatar && (
                    <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>Remove</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="font-display text-xl font-bold">Tell the world who you are</h1>
              <p className="mt-1 text-[13px] text-[color:var(--muted)]">A short bio helps people know what you're about.</p>
              <div className="mt-5">
                <Textarea
                  rows={4}
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  placeholder="Creator · gamer · coffee enthusiast ☕"
                />
                <p className="mt-1 text-right text-[11px] text-[color:var(--muted)]">{bio.length}/160</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-display text-xl font-bold">Pick your interests</h1>
              <p className="mt-1 text-[13px] text-[color:var(--muted)]">We'll use these to recommend people and rooms.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {INTERESTS.filter((v, i, a) => a.indexOf(v) === i).map((i) => (
                  <button
                    key={i}
                    onClick={() => toggleInterest(i)}
                    aria-pressed={interests.includes(i)}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-[13px] font-semibold border transition",
                      interests.includes(i)
                        ? "grad text-white border-transparent shadow"
                        : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)]/50"
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-display text-xl font-bold">Follow some creators</h1>
              <p className="mt-1 text-[13px] text-[color:var(--muted)]">Your feed starts here. You can always follow more.</p>
              <div className="mt-4 space-y-1 max-h-72 overflow-y-auto no-scrollbar" onMouseEnter={loadSuggested}>
                {!suggested && <p className="text-center text-sm text-[color:var(--muted)] py-8">Loading suggestions…</p>}
                {suggested?.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                    <Avatar src={u.avatarUrl} name={u.displayName} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold truncate flex items-center gap-1">
                        {u.displayName}
                        {u.isVerified && <Icon.Check size={13} className="text-[color:var(--a2)]" />}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">@{u.username}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={following.has(u.id) ? "outline" : "soft"}
                      onClick={() => toggleFollow(u.id)}
                      aria-pressed={following.has(u.id)}
                    >
                      {following.has(u.id) ? (<><Icon.Check size={13} /> Following</>) : "Follow"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              size="lg"
              loading={busy}
              onClick={() => {
                if (step < 3) {
                  if (step === 2) setStep(3);
                  else setStep((s) => s + 1);
                } else finish();
              }}
            >
              {step === 3 ? "Enter LYNKZ" : "Continue"}
            </Button>
          </div>
          <button
            onClick={finish}
            disabled={busy}
            className="mt-3 w-full text-center text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)] transition"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
