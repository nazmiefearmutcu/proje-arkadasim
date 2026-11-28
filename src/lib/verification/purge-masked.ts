import { db } from "@/lib/db";
import { enableSecureDelete } from "./wipe";

/**
 * Saklama süresi dolan maskeli belge metnini temizler (spec §6.2); satır kalır, metin silinir.
 * Ayrı modülde durur: sayaç ucu gibi hafif yollar PDF/OCR yığınını (unpdf, tesseract) yüklemesin.
 */
export async function purgeExpiredMaskedText(now: Date = new Date()): Promise<number> {
  return db.$transaction(async (tx) => {
    await enableSecureDelete(tx);
    const result = await tx.verificationAttempt.updateMany({
      where: { maskedText: { not: null }, maskedTextExpiresAt: { lte: now } },
      data: { maskedText: null, maskedTextExpiresAt: null },
    });
    return result.count;
  });
}
