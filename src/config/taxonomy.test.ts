import { describe, expect, it } from "vitest";
import { foldTr } from "@/lib/tr";
import {
  CITIES,
  DISCIPLINE_GROUPS,
  DISCIPLINE_GROUP_IDS,
  disciplineGroupForDepartment,
  getDisciplineGroup,
  isDisciplineGroupId,
  labelOf,
  CATEGORIES,
  STAGES,
} from "@/config/taxonomy";

describe("disiplin grupları", () => {
  it("tam olarak 12 grup içerir", () => {
    expect(DISCIPLINE_GROUPS).toHaveLength(12);
    expect(DISCIPLINE_GROUP_IDS).toHaveLength(12);
  });

  it("her grubun id'si benzersizdir ve renk kodu içerir", () => {
    const ids = DISCIPLINE_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(12);
    for (const group of DISCIPLINE_GROUPS) {
      expect(group.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("anahtar kelimeler katlanmış biçimde yazılmıştır", () => {
    for (const group of DISCIPLINE_GROUPS) {
      for (const keyword of group.keywords) {
        expect(foldTr(keyword), `${group.id}: ${keyword}`).toBe(keyword);
      }
    }
  });

  it("tamamlayıcı grup kimlikleri geçerli gruplardır ve kendini içermez", () => {
    for (const group of DISCIPLINE_GROUPS) {
      expect(group.complements).toHaveLength(3);
      for (const complement of group.complements) {
        expect(isDisciplineGroupId(complement)).toBe(true);
        expect(complement).not.toBe(group.id);
      }
    }
  });

  it("getDisciplineGroup grubu id ile bulur", () => {
    expect(getDisciplineGroup("yazilim")?.label).toBe("Yazılım ve bilişim");
    expect(getDisciplineGroup("yok")).toBeUndefined();
  });

  it("isDisciplineGroupId yalnız geçerli kimlikleri kabul eder", () => {
    expect(isDisciplineGroupId("tasarim")).toBe(true);
    expect(isDisciplineGroupId("tasarım")).toBe(false);
    expect(isDisciplineGroupId(null)).toBe(false);
  });
});

describe("disciplineGroupForDepartment", () => {
  const cases: Array<[string, string | null]> = [
    ["Bilgisayar Mühendisliği", "yazilim"],
    ["Endüstriyel Tasarım", "tasarim"],
    ["Endüstri Mühendisliği", "endustri"],
    ["İç Mimarlık", "tasarim"],
    ["Mimarlık", "mimarlik"],
    ["Yönetim Bilişim Sistemleri", "yazilim"],
    ["Görsel İletişim Tasarımı", "tasarim"],
    ["İletişim Fakültesi Gazetecilik", "sosyal"],
    ["Tıp", "saglik"],
    ["Moleküler Biyoloji ve Genetik", "temel"],
    ["Elektrik-Elektronik Mühendisliği", "elektronik"],
    ["Mekatronik Mühendisliği", "makine"],
    ["bilinmeyen", null],
  ];

  it.each(cases)("%s -> %s", (department, expected) => {
    expect(disciplineGroupForDepartment(department)).toBe(expected);
  });

  it("öğretmenlik ve ekli biçimleri kökle eşleştirir", () => {
    expect(disciplineGroupForDepartment("Sınıf Öğretmenliği")).toBe("sosyal");
    expect(disciplineGroupForDepartment("Öğretmenliği")).toBe("sosyal");
  });

  it("boş ve eksik girdilerde null döner", () => {
    expect(disciplineGroupForDepartment(null)).toBeNull();
    expect(disciplineGroupForDepartment(undefined)).toBeNull();
    expect(disciplineGroupForDepartment("")).toBeNull();
    expect(disciplineGroupForDepartment("   ")).toBeNull();
  });
});

describe("CITIES", () => {
  it("81 il içerir ve hepsi benzersizdir", () => {
    expect(CITIES).toHaveLength(81);
    expect(new Set(CITIES).size).toBe(81);
  });

  it("Türkçe yazımı doğru uç illeri içerir", () => {
    expect(CITIES).toContain("İstanbul");
    expect(CITIES).toContain("Düzce");
    expect(CITIES).toContain("Şanlıurfa");
    expect(CITIES).toContain("Iğdır");
  });
});

describe("labelOf ve seçenek listeleri", () => {
  it("değerin etiketini döner, bulunamazsa değerin kendisini", () => {
    expect(labelOf(CATEGORIES, "YAZILIM")).toBe("Yazılım");
    expect(labelOf(STAGES, "FIKIR")).toBe("Fikir");
    expect(labelOf(STAGES, "BILINMEYEN")).toBe("BILINMEYEN");
  });
});
