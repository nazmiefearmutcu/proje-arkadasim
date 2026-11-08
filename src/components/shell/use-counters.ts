"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Counters } from "@/lib/counters";

export const POLL_INTERVAL_MS = 20_000;

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

// Tek yoklayıcı: kaç bileşen `useCounters` çağırırsa çağırsın sekme başına bir zamanlayıcı ve bir
// görünürlük dinleyicisi kurulur. İlk oturumlu abone gelince başlar, son abone gidince durur.
let pollers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let queued = false;
/** Yoklayıcı her durduğunda artar; durduktan sonra dönen yanıt yok sayılır. */
let generation = 0;

function isVisible(): boolean {
  return document.visibilityState === "visible";
}

async function load(): Promise<void> {
  const started = generation;
  try {
    const response = await fetch("/api/me/counters", { cache: "no-store" });
    if (!response.ok || started !== generation) return;
    const body = (await response.json()) as Partial<Counters> & { authenticated?: boolean };
    if (body.authenticated && started === generation) {
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

/**
 * Sayıları bir kez çeker. Sekme gizliyse hiçbir şey yapmaz. İstek sürerken gelen çağrı kaybolmaz:
 * süren istek bitince bir kez daha çekilir (ör. okundu işaretinden hemen sonra istenen yenileme).
 */
function refresh(): void {
  if (pollers === 0 || !isVisible()) return;
  if (inFlight) {
    queued = true;
    return;
  }
  inFlight = true;
  void load().finally(() => {
    inFlight = false;
    if (queued) {
      queued = false;
      refresh();
    }
  });
}

function onVisibilityChange(): void {
  if (isVisible()) refresh();
}

/** Yoklayıcıya abone olur; dönen fonksiyon aboneliği bırakır (bir kez). `useCounters` bunu kullanır. */
export function acquireCountersPoller(): () => void {
  pollers += 1;
  if (pollers === 1) {
    timer = setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    pollers -= 1;
    if (pollers === 0) {
      generation += 1;
      queued = false;
      if (timer !== null) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/**
 * Rozet sayılarını hemen yeniler (ör. sohbet okundu işaretlendikten sonra). Oturumlu bir abone
 * yoksa ya da sekme gizliyse hiçbir şey yapmaz.
 */
export function refreshCounters(): void {
  refresh();
}

/**
 * Rozet sayıları. `initial` sunucudan gelen değerdir (misafirde null). Oturum açıksa 20 sn'de bir
 * (sekme görünürken) ve sekme yeniden görünür olduğunda `/api/me/counters` çağrılır. Hata olursa son
 * değer kalır. Birden çok bileşen çağırabilir; yoklama sekme başına tektir.
 */
export function useCounters(initial: Counters | null): Counters | null {
  const signedIn = initial !== null;

  // Sunucudan yeni bir başlangıç değeri gelince (gezinme) önceki çekilmiş değer silinir.
  useEffect(() => {
    emit(null);
  }, [initial]);

  useEffect(() => {
    if (!signedIn) return;
    return acquireCountersPoller();
  }, [signedIn]);

  return useSyncExternalStore(
    subscribe,
    () => (signedIn ? (fetched ?? initial) : null),
    () => initial,
  );
}
