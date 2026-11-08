// `npm run purge`: saklama süresi temizliğini bir kez çalıştırır ve sayıları yazdırır.
// Belge ya da kişisel içerik yazdırılmaz.
import { db } from "../src/lib/db";
import { runPurge } from "../src/lib/purge";

runPurge()
  .then((counts) => {
    console.info("Saklama temizliği tamamlandı.");
    console.info(`- Süresi geçmiş maskeli metin: ${counts.maskedTexts}`);
    console.info(`- Süresi dolmuş oturum: ${counts.sessions}`);
    console.info(`- Kullanılmış veya süresi dolmuş sıfırlama jetonu: ${counts.resetTokens}`);
    console.info(`- Eski giriş kaydı: ${counts.loginEvents}`);
  })
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "bilinmeyen";
    console.error(`Saklama temizliği başarısız oldu (${name}).`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
