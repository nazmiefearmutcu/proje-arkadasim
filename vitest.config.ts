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
    env: {
      DATABASE_URL: "file:./test.db",
    },
    globalSetup: "./tests/global-setup.ts",
    // Tek SQLite dosyası paylaşıldığı için test dosyaları sırayla çalışır.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
