// `npm run make-admin -- <e-posta>`: var olan bir hesaba yönetici rolü verir. Üretimde yönetici
// atamanın yolu budur (tohum tüm verileri sildiği için üretimde kullanılmaz). Hiçbir veri silinmez;
// parola, jeton ya da e-posta yazdırılmaz. Kayıtlı olmayan e-postada hiçbir şey değiştirmez.
import { db } from "../src/lib/db";
import { makeAdmin } from "../src/lib/admin/make-admin";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (args.length !== 1) {
    console.error("Kullanım: npm run make-admin -- <e-posta>");
    process.exitCode = 1;
    return;
  }

  const result = await makeAdmin(args[0]);
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.info(
    result.alreadyAdmin
      ? `@${result.username} zaten yönetici; değişiklik yapılmadı.`
      : `@${result.username} artık yönetici. Yönetim paneli: /admin`,
  );
  if (!result.verified) {
    console.info(
      "Not: Bu hesap henüz belge doğrulamasından geçmedi. Yönetim paneli çalışır; proje paylaşmak ve mesajlaşmak için doğrulama gerekir.",
    );
  }
}

main()
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "bilinmeyen";
    console.error(`Yönetici atanamadı (${name}). DATABASE_URL değerini kontrol edin.`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
