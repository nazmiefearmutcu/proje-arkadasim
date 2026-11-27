import { describe, expect, it } from "vitest";
import { normalizeBarcode, normalizeTckn } from "./identifiers";

// Kontrol haneleri algoritmayla üretilmiş, gerçek kişiye ait olmayan test numarası.
const VALID_TCKN = "10000000146";

describe("normalizeBarcode", () => {
  it("boşlukları atar ve büyütür", () => {
    expect(normalizeBarcode(" yok-1234 abcd-5678 ")).toBe("YOK-1234ABCD-5678");
  });

  it("küçük i harfini Türkçe İ'ye çevirmez", () => {
    expect(normalizeBarcode("test-ogrenci-0001")).toBe("TEST-OGRENCI-0001");
  });

  it("yalnız harften oluşan YÖK barkodunu kabul eder", () => {
    expect(normalizeBarcode("yokogabcdefghijkl")).toBe("YOKOGABCDEFGHIJKL");
  });

  it("çok kısa, çok uzun ya da yabancı karakterli girdiyi reddeder", () => {
    expect(normalizeBarcode("AB12")).toBeNull();
    expect(normalizeBarcode("A1".repeat(26))).toBeNull();
    expect(normalizeBarcode("ABCD1234<script>")).toBeNull();
  });
});

describe("normalizeTckn", () => {
  it("geçerli numarayı kabul eder", () => {
    expect(normalizeTckn(VALID_TCKN)).toBe(VALID_TCKN);
    expect(normalizeTckn(" 100 000 001 46 ")).toBe(VALID_TCKN);
  });

  it("kontrol hanesi tutmayan, 0 ile başlayan ya da eksik numarayı reddeder", () => {
    expect(normalizeTckn("10000000147")).toBeNull();
    expect(normalizeTckn("00000000146")).toBeNull();
    expect(normalizeTckn("1000000014")).toBeNull();
    expect(normalizeTckn("1000000014a")).toBeNull();
  });
});
