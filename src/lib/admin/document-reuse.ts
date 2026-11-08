import { db } from "@/lib/db";

/** Aynı belgenin başka bir hesaptaki durumu: doğrulanmış bir hesapta onaylı ya da incelemede. */
export type ReuseStatus = "onaylı" | "incelemede";

export interface QueueAttempt {
  id: string;
  userId: string;
  docHash: string;
}

/**
 * Kuyruktaki her belge için aynı belgenin (aynı docHash) başka bir hesaptaki durumunu tek sorguda bulur.
 * "onaylı", onay eylemindeki engelle aynı koşuldur: doğrulanmış bir hesapta APPROVED belge. Aynı
 * kullanıcının kendi kayıtları sayılmaz. Özet değeri çağırana dönmez; yalnız durum döner.
 */
export async function documentReuseByAttempt(
  items: readonly QueueAttempt[],
): Promise<Map<string, ReuseStatus>> {
  const result = new Map<string, ReuseStatus>();
  const hashes = [...new Set(items.map((item) => item.docHash).filter((hash) => hash.length > 0))];
  if (hashes.length === 0) return result;

  const sameDocuments = await db.verificationAttempt.findMany({
    where: {
      docHash: { in: hashes },
      OR: [
        { status: "MANUAL_REVIEW" },
        { status: "APPROVED", user: { verificationStatus: "VERIFIED" } },
      ],
    },
    select: { userId: true, docHash: true, status: true },
  });

  for (const item of items) {
    if (item.docHash.length === 0) continue;
    let status: ReuseStatus | null = null;
    for (const other of sameDocuments) {
      if (other.docHash !== item.docHash || other.userId === item.userId) continue;
      if (other.status === "APPROVED") {
        status = "onaylı";
        break;
      }
      status = "incelemede";
    }
    if (status) result.set(item.id, status);
  }
  return result;
}
