import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Testler ayrı bir SQLite dosyası kullanır; geliştirme veritabanına dokunmaz.
    // Mutlak yol: üretilmiş Prisma istemcisi göreli yolu ana kopyanın prisma/ klasörüne çözer
    // (node_modules bağlantısı paylaşılır). Mutlak yol her çalışma ağacını kendi test.db dosyasına bağlar.
    env: {
      DATABASE_URL: `file:${fileURLToPath(new URL("./prisma/test.db", import.meta.url)).replace(/\\/g, "/")}`,
    },
    globalSetup: "./tests/global-setup.ts",
    // Tek SQLite dosyası paylaşıldığı için test dosyaları sırayla çalışır.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
