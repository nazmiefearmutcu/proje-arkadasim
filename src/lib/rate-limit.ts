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
  // Oturum açıkken mevcut şifrenin denetimi (şifre değiştirme, hesap silme): kullanıcı başına.
  passwordCheck: [10, 15 * 60_000],
} as const;

/**
 * Giriş sınırının anahtarı: IP + e-posta (spec §8). Anahtar e-postayı da içerdiği için, IP
 * bilinmediğinde ("local") bile farklı hesaplar birbirinin girişini engellemez; bir saldırgan
 * yalnız tek bir hesabın girişini geçici olarak kilitleyebilir.
 */
export function loginKey(ip: string, email: string): string {
  return `login:${ip}:${email.trim().toLowerCase()}`;
}

/**
 * İstemci IP'si. Vekil başlıkları yalnız `TRUST_PROXY=true` iken okunur (istemci önündeki
 * güvenilir bir ters vekil varken). Bu durumda `x-forwarded-for` içinde İLK değer değil SON değer
 * kullanılır: vekil, gerçek istemci adresini listenin sonuna ekler; baştaki değerleri istemci
 * uydurabilir. Vekil yoksa ya da ayar kapalıysa "local" döner; böylece başlık uydurarak sınır
 * aşılamaz (bu durumda tüm istekler tek kovada sayılır).
 */
export async function clientIp(): Promise<string> {
  if (process.env.TRUST_PROXY !== "true") return "local";

  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const real = h.get("x-real-ip")?.trim();
  return real || "local";
}
