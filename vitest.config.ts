import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mutlak yol: node_modules bağlantısı (junction) üretilmiş Prisma istemcisini ana depoya çözer; göreli
// "file:./test.db" o zaman ana deponun prisma/ klasörüne gider. Bu worktree'nin kendi test.db'si kullanılır.
const testDatabaseUrl = `file:${fileURLToPath(new URL("./prisma/test.db", import.meta.url)).replace(/\\/g, "/")}`;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Testler ayrı bir SQLite dosyası kullanır; geliştirme veritabanına dokunmaz.
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
    globalSetup: "./tests/global-setup.ts",
    // Tek SQLite dosyası paylaşıldığı için test dosyaları sırayla çalışır.
    fileParallelism: false,
    // Parola özeti ve PDF üretimi yük altında yavaşlar; varsayılan 5 sn makine yüküyle zaman aşımı verir.
    testTimeout: 20_000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
