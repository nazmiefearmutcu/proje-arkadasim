import { describe, expect, it } from "vitest";
import { assessContent, HOLD_THRESHOLD } from "./assess";

const clean = {
  title: "Kampüs etkinlik uygulaması",
  summary: "Öğrenci kulüplerinin etkinliklerini tek yerde toplayan mobil uygulama.",
  description:
    "React Native ile bir uygulama geliştiriyoruz. Arayüz tasarımı ve veri analizi becerisi olan arkadaşlar arıyoruz. Kod github.com/ornek/kampus adresinde.",
  tags: ["mobil", "react"],
  roles: [{ title: "Arayüz tasarımı", description: "Figma ile ekran tasarımı" }],
};

describe("assessContent", () => {
  it("olağan bir ilanı bekletmez; GitHub bağlantısı puan almaz", () => {
    const result = assessContent(clean);
    expect(result).toEqual({ score: 0, flags: [], hold: false });
  });

  it("telefon numarasını yakalar ve ilanı bekletir", () => {
    const result = assessContent({ ...clean, description: "Bilgi için 0532 123 45 67 numarasını arayın." });
    expect(result.flags).toContain("PHONE");
    expect(result.hold).toBe(true);
  });

  it("+90 biçimli numarayı da yakalar", () => {
    expect(assessContent({ ...clean, summary: "Ulaş: +90 (532) 123-45-67" }).flags).toContain("PHONE");
  });

  it("ücretli ödev ve tez ilanını bekletir", () => {
    const result = assessContent({ ...clean, title: "Ödev yapılır, tez yazılır" });
    expect(result.flags).toContain("PAID_WORK");
    expect(result.hold).toBe(true);
  });

  it("reklam dili tek başına bekletmez, bağlantıyla birlikte bekletir", () => {
    const adOnly = assessContent({ ...clean, summary: "Büyük indirim fırsatı!" });
    expect(adOnly.flags).toEqual(["ADVERTISING"]);
    expect(adOnly.hold).toBe(false);

    const adWithLink = assessContent({ ...clean, summary: "Büyük indirim, hemen tıkla: bit.ly/ornek" });
    expect(adWithLink.flags).toEqual(expect.arrayContaining(["ADVERTISING", "LINK"]));
    expect(adWithLink.hold).toBe(true);
  });

  it("meşru proje konularını reklam saymaz", () => {
    const result = assessContent({
      ...clean,
      title: "Kripto para fiyat karşılaştırma ve sipariş takip uygulaması",
      summary: "Farkındalık kampanyası için ASP.NET tabanlı bir panel.",
    });
    expect(result.flags).toEqual([]);
  });

  it("küfrü yakalar, benzer masum kelimeleri yakalamaz", () => {
    expect(assessContent({ ...clean, summary: "Siktir git" }).flags).toContain("PROFANITY");
    expect(assessContent({ ...clean, summary: "amk bu ne" }).flags).toContain("PROFANITY");
    expect(assessContent({ ...clean, summary: "Aquarium sensörü ve picnic haritası" }).flags).not.toContain("PROFANITY");
  });

  it("e-posta adresini yakalar ve bağlantı saymaz", () => {
    const result = assessContent({ ...clean, summary: "Yaz: ornek@mail.com" });
    expect(result.flags).toContain("EMAIL");
    expect(result.flags).not.toContain("LINK");
  });

  it("iki yabancı bağlantı tek başına eşiği geçer", () => {
    const result = assessContent({ ...clean, summary: "site-bir.com ve https://iki.xyz/kayit" });
    expect(result.score).toBeGreaterThanOrEqual(HOLD_THRESHOLD);
  });

  it("aynı sahibin tekrarlanan ilanını ve kısa sürede çok ilanını puanlar", () => {
    const result = assessContent(clean, {
      recent: [{ title: "KAMPÜS etkinlik uygulaması!", description: "başka" }],
      createdLast24h: 2,
    });
    expect(result.flags).toEqual(expect.arrayContaining(["DUPLICATE", "BURST"]));
    expect(result.hold).toBe(true);
  });

  it("büyük harf seli ve karakter tekrarını hafif puanlar", () => {
    const result = assessContent({ ...clean, title: "HEMEN KATIL ÇOK ACİL!!!!!!" });
    expect(result.flags).toEqual(expect.arrayContaining(["SHOUTING", "REPEATED_CHARS"]));
    expect(result.score).toBe(2);
    expect(result.hold).toBe(false);
  });
});
