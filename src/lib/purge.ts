import { db } from "@/lib/db";
import { purgeExpiredMaskedText } from "@/lib/verification/service";

// Saklama süresi temizliği (spec §6.2). Üç yol var: istek tetiklemeli (maybeRunPurge, saatte
// en fazla bir kez), `npm run purge` betiği ve testler. Hiçbir adım belge ya da kişisel içerik
// loglamaz; yalnızca sayılar döner.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_LOGIN_RETENTION_DAYS = 365;

export interface PurgeCounts {
  /** Süresi geçmiş maskeli belge metni (alan temizlenir, satır kalır). */
  maskedTexts: number;
  /** Süresi dolmuş oturumlar. */
  sessions: number;
  /** Kullanılmış ya da süresi dolmuş şifre sıfırlama jetonları. */
  resetTokens: number;
  /** LOGIN_LOG_RETENTION_DAYS gününden eski giriş kayıtları. */
  loginEvents: number;
}

/**
 * LOGIN_LOG_RETENTION_DAYS ortam değişkeni; yalnız pozitif bir tam sayı (yalnız rakam) kabul
 * edilir, aksi halde 365 gün. "30d" ya da "1e3" gibi değerler yasal kayıtları erken silmesin
 * diye kısmen okunmaz, varsayılana düşer.
 */
export function loginRetentionDays(): number {
  const raw = process.env.LOGIN_LOG_RETENTION_DAYS?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return DEFAULT_LOGIN_RETENTION_DAYS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_LOGIN_RETENTION_DAYS;
}

/** Tüm saklama temizliğini çalıştırır ve silinen/temizlenen satır sayılarını döner. */
export async function runPurge(now: Date = new Date()): Promise<PurgeCounts> {
  const loginCutoff = new Date(now.getTime() - loginRetentionDays() * DAY_MS);

  const maskedTexts = await purgeExpiredMaskedText(now);
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  const resetTokens = await db.passwordResetToken.deleteMany({
    where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }] },
  });
  const loginEvents = await db.loginEvent.deleteMany({ where: { createdAt: { lt: loginCutoff } } });

  return {
    maskedTexts,
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    loginEvents: loginEvents.count,
  };
}

const globalPurge = globalThis as unknown as { __paPurgeLastRun?: number };

function logFailure(error: unknown): void {
  // Yalnızca hata adı; mesaj ve veri içeriği loglanmaz.
  const name = error instanceof Error ? error.name : "bilinmeyen";
  console.error(`[purge] temizlik başarısız oldu (${name}).`);
}

/**
 * İstek sonrasında çağrılır: süreç başına saatte en fazla bir temizlik başlatır. Asla fırlatmaz
 * ve sonucunu beklemez; yanıt bu işi beklemez.
 */
export function maybeRunPurge(nowMs: number = Date.now()): void {
  try {
    const last = globalPurge.__paPurgeLastRun;
    if (last !== undefined && nowMs - last < HOUR_MS) return;
    globalPurge.__paPurgeLastRun = nowMs;
    runPurge(new Date(nowMs)).catch(logFailure);
  } catch (error) {
    logFailure(error);
  }
}
