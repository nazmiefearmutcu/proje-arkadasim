// `npm run editor -- <e-posta> [--replace]`: tek editör hesabını açar (spec 2026-11-27 §1).
// Parola yazdırılmaz. Yalnız 30 dakika geçerli, tek kullanımlık parola belirleme bağlantısı yazdırılır;
// bağlantıyı açan kişi editör parolasını kendisi belirler. Bağlantıyı yalnız editör olacak kişiye verin.
import { db } from "../src/lib/db";
import { createEditor } from "../src/lib/admin/create-editor";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const replace = args.includes("--replace");
  const rest = args.filter((arg) => arg !== "--replace");
  if (rest.length !== 1) {
    console.error("Kullanım: npm run editor -- <e-posta> [--replace]");
    process.exitCode = 1;
    return;
  }

  const result = await createEditor(rest[0], { replace });
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  console.info(result.replaced ? "Eski editör hesabı silindi, yeni editör hesabı açıldı." : "Editör hesabı hazır.");
  console.info(`Parola belirleme bağlantısı (${result.minutes} dakika geçerli, tek kullanımlık):`);
  console.info(`${base}${result.setupPath}`);
  console.info("Parolayı belirledikten sonra /giris sayfasından e-posta ve parolayla giriş yapın; editör paneli açılır.");
}

main()
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "bilinmeyen";
    console.error(`Editör hesabı açılamadı (${name}). DATABASE_URL değerini kontrol edin.`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
