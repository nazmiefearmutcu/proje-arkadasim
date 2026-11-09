import { AI_CONSENT_MIN_VERSION, LEGAL_VERSION } from "@/config/legal";
import { db } from "@/lib/db";

export type ConsentType = "PRIVACY_NOTICE" | "TERMS" | "CROSS_BORDER_AI";

/** Rıza kaydı ekler. Kayıtlar silinmez; her değişiklik yeni satır olarak tutulur (ispat). */
export async function recordConsent(
  userId: string,
  type: ConsentType,
  granted: boolean,
  version: string = LEGAL_VERSION,
): Promise<void> {
  await db.consent.create({
    data: { userId, type, granted, version },
  });
}

/**
 * Bu türdeki en son kayıt "verildi" ise true. Hiç kayıt yoksa false. Yurt dışı yapay zeka aktarımında
 * rıza, AI_CONSENT_MIN_VERSION'dan eski bir metne verilmişse geçersizdir (alıcı değişti; yeniden sorulur).
 */
export async function hasActiveConsent(userId: string, type: ConsentType): Promise<boolean> {
  const latest = await db.consent.findFirst({
    where: { userId, type },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { granted: true, version: true },
  });
  if (latest?.granted !== true) return false;
  if (type === "CROSS_BORDER_AI" && latest.version < AI_CONSENT_MIN_VERSION) return false;
  return true;
}
