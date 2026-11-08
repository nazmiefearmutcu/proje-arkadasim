"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Counters } from "@/lib/counters";

const POLL_INTERVAL_MS = 20_000;

// Rozet sayıları tek bir modül durumunda tutulur: üst bar ve alt menü aynı sayıları okur.
let fetched: Counters | null = null;
const listeners = new Set<() => void>();

function emit(next: Counters | null): void {
  fetched = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Rozet sayıları. `initial` sunucudan gelen değerdir (misafirde null). Oturum açıksa 20 sn'de bir
 * ve sekme yeniden görünür olduğunda `/api/me/counters` çağrılır. Hata olursa son değer kalır.
 */
export function useCounters(initial: Counters | null): Counters | null {
  const signedIn = initial !== null;

  // Sunucudan yeni bir başlangıç değeri gelince (gezinme) önceki çekilmiş değer silinir.
  useEffect(() => {
    emit(null);
  }, [initial]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/me/counters", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as Partial<Counters> & { authenticated?: boolean };
        if (body.authenticated && !cancelled) {
          emit({
            notifications: body.notifications ?? 0,
            messages: body.messages ?? 0,
            requests: body.requests ?? 0,
            invites: body.invites ?? 0,
          });
        }
      } catch {
        // Ağ hatasında son bilinen sayılar gösterilir.
      }
    }

    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signedIn]);

  return useSyncExternalStore(
    subscribe,
    () => (signedIn ? (fetched ?? initial) : null),
    () => initial,
  );
}
