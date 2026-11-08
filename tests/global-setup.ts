import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Test çalıştırması başına bir kez: test şemasını prisma/test.db dosyasına uygular.
// Göreli DATABASE_URL yolu kullanılmaz: Prisma onu şema dosyasının (prisma/) konumuna göre çözer ama
// üretilmiş istemci ana çalışma kopyasına bağlı olabilir. Bu yüzden mutlak yol verilir.
// "--force-reset" kullanılmaz: Prisma bunu yapay zeka ajanları için engeller ve açık
// kullanıcı onayı ister. Düz "db push" dosyayı silmez; yalnız şema farkını uygular ve
// veri kaybı gerektiren bir değişiklikte kendisi durur. Testler her testten önce
// resetDb() ile kendi satırlarını temizler.
export default function setup(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));
  // Mutlak yol: testlerle aynı dosya (bkz. vitest.config.ts). Göreli yol ana depoya çözülebilir.
  const dbPath = fileURLToPath(new URL("../prisma/test.db", import.meta.url)).replace(/\\/g, "/");

  execSync("npx prisma db push --skip-generate", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  });
}
