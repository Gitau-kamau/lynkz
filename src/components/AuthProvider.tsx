"use client";

import { useEffect, useState } from "react";
import { SessionProvider, type SessionUser } from "@/components/ui";
import { api } from "@/lib/client";
import { ACCENTS } from "@/lib/utils";

export default function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<SessionUser | null>(initialUser);

  // theme: dark / light / system + accent color
  useEffect(() => {
    const applyTheme = () => {
      const mode = localStorage.getItem("lynkz-theme") ?? "dark";
      const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    const applyAccent = () => {
      const a = localStorage.getItem("lynkz-accent") ?? "purple";
      document.documentElement.dataset.accent = a;
      const acc = ACCENTS.find((x) => x.id === a) ?? ACCENTS[0]!;
      document.documentElement.style.setProperty("--a1", acc.c1);
      document.documentElement.style.setProperty("--a2", acc.c2);
    };
    applyTheme();
    applyAccent();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);
    window.addEventListener("lynkz-theme", applyTheme);
    window.addEventListener("lynkz-accent", applyAccent);
    return () => {
      mq.removeEventListener("change", applyTheme);
      window.removeEventListener("lynkz-theme", applyTheme);
      window.removeEventListener("lynkz-accent", applyAccent);
    };
  }, []);

  // heartbeat so online status works
  useEffect(() => {
    if (!me) return;
    const beat = () => api("/api/auth", { method: "POST", body: { action: "heartbeat" } }).catch(() => {});
    beat();
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
  }, [me]);

  return <SessionProvider value={{ me, setMe }}>{children}</SessionProvider>;
}
