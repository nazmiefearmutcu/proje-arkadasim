import type { Prisma } from "@prisma/client";

/**
 * SQLite silinen ya da üzerine yazılan içeriği varsayılan olarak dosyada bırakır: satır "silinir" ama baytlar
 * boş sayfalarda durur ve veritabanı dosyası sızarsa okunabilir. `secure_delete` açıkken o alan sıfırlarla
 * ezilir. Ayar bağlantı başınadır ve Prisma birden çok bağlantı kullanır; bu yüzden belge metnini ya da
 * kullanıcıyı silen her işlem, kendi transaction'ı içinde (aynı bağlantıda) önce bunu açar.
 */
export async function enableSecureDelete(tx: Pick<Prisma.TransactionClient, "$queryRawUnsafe">): Promise<void> {
  // PRAGMA bir satır döndürür; SQLite'ta $executeRaw satır döndüren komutu kabul etmez.
  await tx.$queryRawUnsafe("PRAGMA secure_delete = ON");
}

/**
 * Kullanıcının bütün denemelerindeki maskeli belge metnini kalıcı olarak siler. Belge onaylanınca çağrılır:
 * doğrulanmış bir hesabın bekleyen incelemesi kalmaz, eski yüklemelerin metnini saklamak için sebep yoktur.
 */
export async function wipeDocumentText(
  tx: Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "verificationAttempt">,
  userId: string,
): Promise<void> {
  await enableSecureDelete(tx);
  await tx.verificationAttempt.updateMany({
    where: { userId, maskedText: { not: null } },
    data: { maskedText: null, maskedTextExpiresAt: null },
  });
}
