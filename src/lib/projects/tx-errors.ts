// Transaction hatalarının sınıflandırılması. actions.ts ('use server') yalnız async dışa aktarabildiği için
// bu saf yardımcı ayrı dosyadadır.

const BUSY_PATTERN = /database is locked|database table is locked|SQLITE_BUSY|SQLITE_LOCKED|DatabaseBusy/i;

/**
 * Geçici bir eşzamanlılık hatası mı? Prisma yazma çakışması ya da kilitlenmede P2034, transaction zaman
 * aşımında P2028 döner; SQLite kilitli dosyayı "database is locked" (SQLITE_BUSY) iletisiyle bildirir. Bu
 * hatalar kullanıcıya "birazdan tekrar dene" olarak döner; diğer hatalar fırlatılmaya devam eder.
 */
export function isTransientTxError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "P2034" || code === "P2028") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && BUSY_PATTERN.test(message);
}
