import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test çalıştırması başına bir kez: test veritabanını sıfırdan şemaya göre kurar.
// DATABASE_URL="file:./test.db" yolu Prisma'da şema dosyasına (prisma/) göre çözülür,
// bu yüzden dosya prisma/test.db olur. Dosya yalnız bu betik tarafından, her çalıştırmada
// silinir; geliştirme veritabanına dokunulmaz. "--force-reset" kullanılmaz: Prisma bunu
// yapay zeka ajanları için engeller ve kullanıcı onayı ister.
export default function setup(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const testDbPath = fileURLToPath(new URL("../prisma/test.db", import.meta.url));

  for (const suffix of ["", "-journal", "-wal"]) {
    rmSync(`${testDbPath}${suffix}`, { force: true });
  }

  execSync("npx prisma db push --skip-generate", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
