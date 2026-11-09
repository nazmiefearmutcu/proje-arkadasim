import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb } from "../../tests/helpers/db";
import { hasActiveConsent, recordConsent } from "./consent";

// Aynı milisaniyede yazılan satırların sıralamasını önlemek için kısa bekleme.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("rıza kayıtları", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("hiç kayıt yoksa aktif rıza yoktur", async () => {
    const user = await createUser();
    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(false);
  });

  it("en son kayıt kazanır: verildi, sonra geri alındı", async () => {
    const user = await createUser();

    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(true);

    await tick();
    await recordConsent(user.id, "CROSS_BORDER_AI", false);
    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(false);
  });

  it("en son kayıt kazanır: geri alındı, sonra yeniden verildi", async () => {
    const user = await createUser();

    await recordConsent(user.id, "CROSS_BORDER_AI", false);
    await tick();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);

    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(true);
  });

  it("rıza türleri birbirinden bağımsızdır", async () => {
    const user = await createUser();
    await recordConsent(user.id, "TERMS", true);

    expect(await hasActiveConsent(user.id, "TERMS")).toBe(true);
    expect(await hasActiveConsent(user.id, "PRIVACY_NOTICE")).toBe(false);
  });
  it("yapay zeka rızası alıcı değişmeden önceki metne verildiyse geçersizdir (yeniden sorulur)", async () => {
    const user = await createUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true, "2026-11-08");
    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(false);
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(true);
  });

  it("eski sürüm sınırı yalnız yapay zeka rızasına uygulanır", async () => {
    const user = await createUser();
    await recordConsent(user.id, "TERMS", true, "2026-01-01");
    expect(await hasActiveConsent(user.id, "TERMS")).toBe(true);
  });
});
