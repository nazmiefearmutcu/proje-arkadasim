import { describe, expect, it } from "vitest";
import { foldTr, searchTokens, toSearchText } from "@/lib/tr";

describe("foldTr", () => {
  it("İ ve I harflerini Türkçe küçük harfe çevirip katlar", () => {
    expect(foldTr("İSTANBUL")).toBe("istanbul");
    expect(foldTr("IŞIK")).toBe("isik");
  });

  it("boşlukları ve Türkçe harfleri ASCII karşılığına çevirir", () => {
    expect(foldTr("Ayşe Nur")).toBe("ayse nur");
    expect(foldTr("Çağrı Gümüş")).toBe("cagri gumus");
    expect(foldTr("Öğrenci Şöleni")).toBe("ogrenci soleni");
  });

  it("birleşik işaretli (NFD) İ harfini de katlar", () => {
    expect(foldTr("İzmir")).toBe("izmir");
    expect(foldTr("İzmir")).toBe("izmir");
  });

  it("[a-z0-9] dışındaki karakterleri boşluğa çevirir ve tekilleştirir", () => {
    expect(foldTr("Elektrik-Elektronik   Mühendisliği!!")).toBe(
      "elektrik elektronik muhendisligi",
    );
    expect(foldTr("  (ön)  lisans  ")).toBe("on lisans");
  });

  it("boş girdiyi boş metne çevirir", () => {
    expect(foldTr("")).toBe("");
    expect(foldTr("   ")).toBe("");
  });
});

describe("toSearchText", () => {
  it("parçaları katlar ve tek boşlukla birleştirir", () => {
    expect(toSearchText("Ayşe", null, undefined, "İstanbul")).toBe("ayse istanbul");
  });

  it("dizi parçalarını düzleştirir", () => {
    expect(toSearchText("Robotik", ["Yazılım", "Gömülü Sistem"])).toBe(
      "robotik yazilim gomulu sistem",
    );
  });

  it("boş parçaları yok sayar", () => {
    expect(toSearchText(null, undefined, "", [])).toBe("");
  });
});

describe("searchTokens", () => {
  it("katlanmış belirteçler üretir ve 2 karakterden kısaları atar", () => {
    expect(searchTokens("Ş a Robotik")).toEqual(["robotik"]);
    expect(searchTokens("İzmir Yazılım")).toEqual(["izmir", "yazilim"]);
  });

  it("en fazla 6 belirteç döner", () => {
    const tokens = searchTokens("bir iki uc dort bes alti yedi sekiz");
    expect(tokens).toHaveLength(6);
    expect(tokens[0]).toBe("bir");
  });

  it("boş sorguda boş dizi döner", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens("   ")).toEqual([]);
  });
});
