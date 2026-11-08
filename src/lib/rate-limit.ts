import { headers } from "next/headers";

// Sabit pencereli, bellek içi hız sınırı. Tek süreçli dağıtım içindir; birden çok sunucu
// gerekirse veritabanına ya da Redis'e taşınmalıdır.

interface Entry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

const PRUNE_INTERVAL_MS = 60_000;

const globalForRateLimit = globalThis as unknown as {
  __rateLimitEntries?: Map<string, Entry>;
  __rateLimitPrunedAt?: number;
};

function entries(): Map<string, Entry> {
  if (!globalForRateLimit.__rateLimitEntries) {
    globalForRateLimit.__rateLimitEntries = new Map();
  }
  return globalForRateLimit.__rateLimitEntries;
}

function pruneExpired(now: number): void {
  const last = globalForRateLimit.__rateLimitPrunedAt ?? 0;
  if (now - last < PRUNE_INTERVAL_MS) return;
  globalForRateLimit.__rateLimitPrunedAt = now;
  for (const [key, entry] of entries()) {
    if (entry.resetAt <= now) entries().delete(key);
  }
}

/**
 * Anahtar başına `windowMs` içinde en fazla `limit` istek izin verir.
 * Pencere dolunca sayaç sıfırlanır.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const store = entries();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { ok: true, retryAfterSec: 0 };
  }

  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

/** Uygulama genelinde kullanılan hız sınırları: [istek sayısı, pencere (ms)]. */
export const LIMITS = {
  login: [10, 15 * 60_000],
  register: [5, 60 * 60_000],
  message: [30, 60_000],
  passwordReset: [3, 60 * 60_000],
  report: [10, 60 * 60_000],
} as const;

/** İstemci IP'si: önce `x-forwarded-for` (ilk değer), yoksa `x-real-ip`, o da yoksa "local". */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  return real || "local";
}
