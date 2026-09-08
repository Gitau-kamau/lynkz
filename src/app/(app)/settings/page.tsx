"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Field, Input, Modal, Select, Textarea, toast, useSession } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { ACCENTS, cn, timeAgo } from "@/lib/utils";
import { readFileDataUrl } from "@/components/Composer";

type Section = "account" | "privacy" | "notifications" | "appearance" | "security" | "danger";

const SECTIONS: { id: Section; label: string; icon: keyof typeof Icon }[] = [
  { id: "account", label: "Account", icon: "User" },
  { id: "privacy", label: "Privacy", icon: "Lock" },
  { id: "notifications", label: "Notifications", icon: "Bell" },
  { id: "appearance", label: "Appearance", icon: "Moon" },
  { id: "security", label: "Security", icon: "Shield" },
  { id: "danger", label: "Danger zone", icon: "Trash" },
];

export default function SettingsPage() {
  const { me, setMe } = useSession();
  const router = useRouter();
  const [section, setSection] = useState<Section>("account");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<{ token: string; userAgent: string; ip: string; createdAt: string; current: boolean }[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // account
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // privacy
  const [isPrivate, setIsPrivate] = useState(me?.isPrivate ?? false);
  const [msgPerm, setMsgPerm] = useState("everyone");
  const [mentionPerm, setMentionPerm] = useState("everyone");
  const [tagPerm, setTagPerm] = useState("everyone");

  // notifications
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    likes: true, comments: true, followers: true, messages: true, rooms: true, lynks: true, mentions: true, drops: true,
  });

  // passwords
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName);
    setUsername(me.username);
    setEmail(me.email);
    setBio(me.bio ?? "");
    setWebsite((me as { website?: string }).website ?? "");
    setLocation((me as { location?: string }).location ?? "");
    setIsPrivate(me.isPrivate);
  }, [me]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const res = await api<{ prefs: Record<string, unknown>; sessions: typeof sessions }>("/api/settings?view=full");
        const notif = (res.prefs as { notif?: Record<string, boolean> }).notif ?? {};
        setNotifPrefs((p) => ({ ...p, ...notif }));
        setMsgPerm((res.prefs as { messaging?: string }).messaging ?? "everyone");
        setMentionPerm((res.prefs as { mentions?: string }).mentions ?? "everyone");
        setTagPerm((res.prefs as { tags?: string }).tags ?? "everyone");
        setSessions(res.sessions);
      } catch {
        /* prefs optional */
      }
    };
    loadPrefs();
  }, []);

  const saveAccount = async () => {
    setBusy(true);
    try {
      const res = await api<{ user: typeof me }>("/api/settings", { body: { action: "update_profile", displayName: displayName.trim(), username: username.trim().toLowerCase(), bio: bio.trim(), website: website.trim(), location: location.trim(), avatarUrl: avatar } });
      if (res.user) setMe({ ...me!, ...res.user });
      toast("Profile updated.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "err");
    } finally {
      setBusy(false);
    }
  };

  const savePrivacy = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { body: { action: "privacy", isPrivate, messaging: msgPerm, mentions: mentionPerm, tags: tagPerm } });
      setMe({ ...me!, isPrivate });
      toast("Privacy settings saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "err");
    } finally {
      setBusy(false);
    }
  };

  const saveNotifs = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { body: { action: "notifications", notif: notifPrefs } });
      toast("Notification preferences saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "err");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (newPw.length < 8) return toast("New password must be at least 8 characters.", "err");
    if (newPw !== confirmPw) return toast("Passwords do not match.", "err");
    setBusy(true);
    try {
      await api("/api/settings", { body: { action: "password", current: curPw, password: newPw } });
      setCurPw(""); setNewPw(""); setConfirmPw("");
      toast("Password changed.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change password.", "err");
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (token: string) => {
    try {
      await api("/api/settings", { body: { action: "revoke_session", token } });
      setSessions((s) => s.filter((x) => x.token !== token));
      toast("Session revoked.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not revoke.", "err");
    }
  };

  const deactivate = async () => {
    try {
      await api("/api/settings", { body: { action: "deactivate" } });
      toast("Account deactivated. See you soon 👋");
      router.push("/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not deactivate.", "err");
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { body: { action: "delete_account" } });
      toast("Account deleted. Goodbye.");
      router.push("/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete account.", "err");
      setBusy(false);
    }
  };

  const pickAvatar = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const item = await readFileDataUrl(f, "image");
      setAvatar(item.url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load image.", "err");
    }
  };

  const nToggle = (k: string) => setNotifPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Icon.Settings size={20} className="text-[color:var(--a2)]" /> Settings
      </h1>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-current={section === s.id}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
              section === s.id ? "grad text-white shadow" : "text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--text)]"
            )}
          >
            <IconComponent name={s.icon} size={15} /> {s.label}
          </button>
        ))}
      </div>

      <div className="card p-5 sm:p-6 space-y-5">
        {section === "account" && (
          <>
            <h2 className="font-display font-semibold">Account information</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => avatarRef.current?.click()} className="group relative" aria-label="Change profile picture">
                <Avatar src={avatar ?? me?.avatarUrl} name={displayName || "You"} size={72} />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition">
                  <Icon.Camera size={20} />
                </span>
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files)} aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Profile picture</p>
                <p className="text-xs text-[color:var(--muted)]">JPG/PNG/WEBP · max 5 MB</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Display name"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
              <Field label="Username" hint="Usernames are unique. Lowercase letters, numbers, underscores.">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Website"><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yoursite.com" /></Field>
              <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" /></Field>
            </div>
            <Field label="Bio">
              <Textarea rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} />
              <span className="text-xs text-[color:var(--muted)]">{bio.length}/160</span>
            </Field>
            <div className="flex justify-end"><Button onClick={saveAccount} loading={busy}>Save changes</Button></div>
          </>
        )}

        {section === "privacy" && (
          <>
            <h2 className="font-display font-semibold">Privacy</h2>
            <PrivacyRow title="Private account" desc="Only people you approve can see your posts and follow you." checked={isPrivate} onChange={setIsPrivate} />
            <PrivacyRow title="Message permissions" desc="Who can send you direct messages.">
              <Select value={msgPerm} onChange={(e) => setMsgPerm(e.target.value)} className="w-44">
                <option value="everyone">Everyone</option>
                <option value="followers">People I follow</option>
                <option value="nobody">Nobody</option>
              </Select>
            </PrivacyRow>
            <PrivacyRow title="Mention permissions" desc="Who can @mention you.">
              <Select value={mentionPerm} onChange={(e) => setMentionPerm(e.target.value)} className="w-44">
                <option value="everyone">Everyone</option>
                <option value="followers">People I follow</option>
              </Select>
            </PrivacyRow>
            <PrivacyRow title="Tag permissions" desc="Who can tag you in content.">
              <Select value={tagPerm} onChange={(e) => setTagPerm(e.target.value)} className="w-44">
                <option value="everyone">Everyone</option>
                <option value="followers">People I follow</option>
              </Select>
            </PrivacyRow>
            <div className="flex justify-end"><Button onClick={savePrivacy} loading={busy}>Save privacy</Button></div>
          </>
        )}

        {section === "notifications" && (
          <>
            <h2 className="font-display font-semibold">Notifications</h2>
            {[
              ["likes", "Likes on your posts"],
              ["comments", "Comments and replies"],
              ["followers", "New followers"],
              ["messages", "Direct messages"],
              ["rooms", "Room activity"],
              ["lynks", "LYNK reactions and replies"],
              ["mentions", "Mentions"],
              ["drops", "DROP responses"],
            ].map(([k, label]) => (
              <PrivacyRow key={k} title={label} desc="Choose what you want to be notified about.">
                <ToggleBat checked={notifPrefs[k] ?? true} onChange={() => nToggle(k)} label={label} />
              </PrivacyRow>
            ))}
            <div className="flex justify-end"><Button onClick={saveNotifs} loading={busy}>Save preferences</Button></div>
          </>
        )}

        {section === "appearance" && <AppearancePane />}

        {section === "security" && (
          <>
            <h2 className="font-display font-semibold">Change password</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Current password"><Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
              <Field label="New password"><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
              <Field label="Confirm new"><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
            </div>
            <div className="flex justify-end"><Button onClick={changePassword} loading={busy}>Update password</Button></div>

            <h2 className="font-display font-semibold pt-4 border-t border-[color:var(--line)]">Active sessions</h2>
            <div className="space-y-2">
              {sessions.length === 0 && <p className="text-sm text-[color:var(--muted)]">Loading sessions…</p>}
              {sessions.map((s) => (
                <div key={s.token} className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-3">
                  <Icon.Settings size={18} className="text-[color:var(--muted)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{s.userAgent || "Unknown device"}</p>
                    <p className="text-[11.5px] text-[color:var(--muted)]">{s.ip || "—"} · {timeAgo(s.createdAt)}</p>
                  </div>
                  {s.current ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400">This device</span>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => revokeSession(s.token)}>Revoke</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api("/api/auth", { body: { action: "logout" } });
                  } finally {
                    window.location.href = "/login";
                  }
                }}
              >
                <Icon.Logout size={15} /> Log out everywhere
              </Button>
            </div>
          </>
        )}

        {section === "danger" && (
          <>
            <h2 className="font-display font-semibold text-rose-400">Danger zone</h2>
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/6 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold">Deactivate account</p>
                  <p className="text-[12.5px] text-[color:var(--muted)]">Your profile disappears but everything is saved. Log back in to reactivate.</p>
                </div>
                <Button variant="outline" size="sm" onClick={deactivate}>Deactivate</Button>
              </div>
              <div className="border-t border-[color:var(--line)]" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold">Delete account</p>
                  <p className="text-[12.5px] text-[color:var(--muted)]">Permanently delete your account, posts, messages and everything else. This cannot be undone.</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete…</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?">
        <div className="p-5 space-y-4">
          <p className="text-sm text-[color:var(--muted)]">
            This permanently deletes your account. Type <b className="text-rose-400">DELETE</b> to confirm.
          </p>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={deleteAccount} loading={busy} disabled={deleteText !== "DELETE"}>Delete forever</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PrivacyRow({ title, desc, checked, onChange, children }: { title: string; desc: string; checked?: boolean; onChange?: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12.5px] text-[color:var(--muted)]">{desc}</p>
      </div>
      {checked !== undefined && onChange ? <ToggleBat checked={checked} onChange={onChange} label={title} /> : children}
    </div>
  );
}

function ToggleBat({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "grad" : "bg-white/12")}>
      <span className={cn("absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

function AppearancePane() {
  const [mode, setMode] = useState("dark");
  const [accent, setAccent] = useState("purple");
  useEffect(() => {
    setMode(localStorage.getItem("lynkz-theme") ?? "dark");
    setAccent(localStorage.getItem("lynkz-accent") ?? "purple");
  }, []);
  const applyMode = (m: string) => {
    setMode(m);
    localStorage.setItem("lynkz-theme", m);
    window.dispatchEvent(new Event("lynkz-theme"));
  };
  const applyAccent = (a: string) => {
    setAccent(a);
    localStorage.setItem("lynkz-accent", a);
    window.dispatchEvent(new Event("lynkz-accent"));
  };
  return (
    <>
      <h2 className="font-display font-semibold">Appearance</h2>
      <div>
        <p className="text-[14px] font-semibold mb-2">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {[["dark", "Dark", <Icon.Moon key="m" size={18} />], ["light", "Light", <Icon.Sun key="s" size={18} />], ["system", "System", <Icon.Settings key="g" size={18} />]].map(([id, label, ic]) => (
            <button key={id as string} onClick={() => applyMode(id as string)} aria-pressed={mode === id}
              className={cn("flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-[13px] font-semibold transition",
                mode === id ? "grad text-white border-transparent shadow" : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--a2)]/50")}>
              {ic}
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[14px] font-semibold mb-2">Accent color</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => applyAccent(a.id)} aria-pressed={accent === a.id} aria-label={a.name}
              className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-semibold transition",
                accent === a.id ? "border-[color:var(--a2)] bg-white/6" : "border-[color:var(--line)] text-[color:var(--muted)]")}>
              <span className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg, ${a.c1}, ${a.c2})` }} />
              {a.name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-[color:var(--muted)]">Appearance is saved on this device.</p>
    </>
  );
}

function IconComponent({ name, size }: { name: keyof typeof Icon; size: number }) {
  const C = Icon[name];
  return <C size={size} />;
}
