import { describe, expect, it } from "vitest";
import { AI_CONSENT_STATEMENT, LEGAL, hasLegalPlaceholders } from "./legal";

const FILLED = {
  controllerName: "Örnek Teknoloji A.Ş.",
  address: "Örnek Mah. Deneme Sok. No: 1, Ankara",
  email: "kvkk@ornek.com.tr",
  kep: "ornek@hs01.kep.tr",
  hostingCountry: "Türkiye",
};

describe("hasLegalPlaceholders", () => {
  it("şablon değerlerle true döner (yayın öncesi uyarı görünür)", () => {
    expect(hasLegalPlaceholders()).toBe(true);
    expect(hasLegalPlaceholders(LEGAL)).toBe(true);
  });

  it("e-posta ve barındırma ülkesi de operatör alanıdır, gerçekçi görünen örnek değer içermez", () => {
    expect(LEGAL.email.startsWith("[")).toBe(true);
    expect(LEGAL.hostingCountry.startsWith("[")).toBe(true);
  });

  it("tüm zorunlu alanlar doluysa false döner", () => {
    expect(hasLegalPlaceholders(FILLED)).toBe(false);
  });

  it.each(["controllerName", "address", "email", "kep", "hostingCountry"] as const)(
    "yalnız %s şablon kaldıysa yine true döner",
    (key) => {
      expect(hasLegalPlaceholders({ ...FILLED, [key]: `[${key}]` })).toBe(true);
    },
  );
});

describe("AI_CONSENT_STATEMENT", () => {
  it("spec §4.1 metniyle birebir aynıdır; alıcıyı ve ülkeyi adlandırır", () => {
    expect(AI_CONSENT_STATEMENT).toBe(
      "Maskelenmiş belge metnimin yapay zeka incelemesi için yurt dışına (OpenAI, ABD) aktarılmasına açık rıza veriyorum.",
    );
  });
});
