import { describe, expect, it } from "vitest";
import { activeFilterCount, parseProjectFilters, projectsHref } from "./filters";

describe("parseProjectFilters", () => {
  it("boş parametrelerde varsayılanları döner", () => {
    const state = parseProjectFilters({});
    expect(state).toEqual({
      q: "",
      category: null,
      disciplineGroup: null,
      workMode: null,
      city: null,
      stage: null,
      page: 1,
      mine: false,
    });
  });

  it("taksonomi dışı değerleri atar", () => {
    const state = parseProjectFilters({
      kategori: "UZAY",
      disiplin: "bilinmeyen",
      calisma: "HAYALI",
      sehir: "Atlantis",
      asama: "BITTI",
    });
    expect(state.category).toBeNull();
    expect(state.disciplineGroup).toBeNull();
    expect(state.workMode).toBeNull();
    expect(state.city).toBeNull();
    expect(state.stage).toBeNull();
  });

  it("geçerli değerleri kabul eder ve sayfayı sayıya çevirir", () => {
    const state = parseProjectFilters({
      kategori: "YAZILIM",
      disiplin: "yazilim",
      calisma: "UZAKTAN",
      sehir: "İzmir",
      asama: "FIKIR",
      sayfa: "3",
      filtre: "benim",
      q: "  robotik  ",
    });
    expect(state).toMatchObject({
      q: "robotik",
      category: "YAZILIM",
      disciplineGroup: "yazilim",
      workMode: "UZAKTAN",
      city: "İzmir",
      stage: "FIKIR",
      page: 3,
      mine: true,
    });
  });

  it("geçersiz sayfa numarasında birinci sayfaya döner", () => {
    expect(parseProjectFilters({ sayfa: "-2" }).page).toBe(1);
    expect(parseProjectFilters({ sayfa: "abc" }).page).toBe(1);
  });

  it("dizi biçimindeki parametrede ilk değeri alır", () => {
    expect(parseProjectFilters({ kategori: ["OYUN", "YAZILIM"] }).category).toBe("OYUN");
  });
});

describe("activeFilterCount", () => {
  it("disiplin ve sayfa filtrelerini saymaz", () => {
    const state = parseProjectFilters({ disiplin: "yazilim", sayfa: "2", sehir: "Ankara" });
    expect(activeFilterCount(state)).toBe(1);
  });
});

describe("projectsHref", () => {
  it("boş durumda yalnız temel yolu döner", () => {
    expect(projectsHref(parseProjectFilters({}))).toBe("/projeler");
  });

  it("birinci sayfayı yazmaz, sonraki sayfayı yazar", () => {
    expect(projectsHref({ page: 1 })).toBe("/projeler");
    expect(projectsHref({ page: 2, city: "Ankara" })).toBe("/projeler?sehir=Ankara&sayfa=2");
  });

  it("benim filtresini ve disiplini URL'e yazar", () => {
    expect(projectsHref({ mine: true, disciplineGroup: "tasarim" })).toBe(
      "/projeler?filtre=benim&disiplin=tasarim",
    );
  });
});
