"use client";

import { useEffect, useState } from "react";

export type ApiResp<T = unknown> = { ok: boolean } & T;

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const res = await fetch(path, {
    method,
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: { ok?: boolean; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth")) {
      try {
        window.location.href = "/login";
      } catch {
        /* noop */
      }
      throw new Error(data.error || "Session expired.");
    }
    throw new Error(data.error || "Something went wrong.");
  }
  return data as T;
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
