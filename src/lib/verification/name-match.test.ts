import { describe, expect, it } from "vitest";
import { levenshtein, matchName } from "./name-match";

describe("matchName", () => {
  const first = "Ayşe Nur";
  const last = "Kılıç";

  it("tam eşleşmeyi kabul eder", () => {
    expect(matchName("Adı Soyadı : Ayşe Nur Kılıç", first, last, { fuzzy: false })).toBe(true);
  });

  it("büyük-küçük harf ve Türkçe harf farkını yok sayar", () => {
    expect(matchName("AYSE NUR KILIC", first, last, { fuzzy: false })).toBe(true);
    expect(matchName("ayşe nur kılıç", first, last, { fuzzy: false })).toBe(true);
    expect(matchName("AYŞE NUR KILIÇ", first, last, { fuzzy: false })).toBe(true);
  });

  it("OCR yazım hatasını yalnızca fuzzy açıkken kabul eder", () => {
    const ocrText = "Adi Soyadi: AYSE NUR KlLIC";
    expect(matchName(ocrText, first, last, { fuzzy: false })).toBe(false);
    expect(matchName(ocrText, first, last, { fuzzy: true })).toBe(true);
  });

  it("fuzzy açıkken bile Levenshtein 2 olan hatayı kabul etmez", () => {
    expect(matchName("AYSE NUR KLLLC", first, last, { fuzzy: true })).toBe(false);
  });

  it("soyad eksikse false döndürür", () => {
    expect(matchName("Ayşe Nur Öğrenci Belgesi", first, last, { fuzzy: true })).toBe(false);
  });

  it("yalnızca soyad varsa false döndürür (ad parçası şart)", () => {
    expect(matchName("KILIÇ", first, last, { fuzzy: true })).toBe(false);
  });

  it("boş ad ya da soyad için false döndürür", () => {
    expect(matchName("Ayşe Kılıç", "", last, { fuzzy: false })).toBe(false);
    expect(matchName("Ayşe Kılıç", first, "  ", { fuzzy: false })).toBe(false);
  });
});

describe("levenshtein", () => {
  it("bilinen uzaklıkları hesaplar", () => {
    expect(levenshtein("kilic", "kilic")).toBe(0);
    expect(levenshtein("kilic", "kllic")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});
