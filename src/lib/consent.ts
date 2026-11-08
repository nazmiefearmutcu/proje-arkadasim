import { LEGAL_VERSION } from "@/config/legal";
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

/** Bu türdeki en son kayıt "verildi" ise true. Hiç kayıt yoksa false. */
export async function hasActiveConsent(userId: string, type: ConsentType): Promise<boolean> {
  const latest = await db.consent.findFirst({
    where: { userId, type },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { granted: true },
  });
  return latest?.granted === true;
}
