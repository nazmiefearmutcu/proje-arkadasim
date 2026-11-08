import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test veritabanı bu worktree'nin kendi prisma/test.db dosyasıdır. Göreli yol kullanılmaz:
// node_modules bir bağlantı (junction) olduğundan üretilmiş Prisma istemcisi ana çalışma
// kopyasındaki şemayı gösterir ve göreli yol oraya çözülürdü (diğer worktree'lerle paylaşılan dosya).
const testDbPath = fileURLToPath(new URL("./prisma/test.db", import.meta.url)).replace(/\\/g, "/");

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
      DATABASE_URL: `file:${testDbPath}`,
    },
    globalSetup: "./tests/global-setup.ts",
    // Tek SQLite dosyası paylaşıldığı için test dosyaları sırayla çalışır.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
