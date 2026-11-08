import { describe, expect, it } from "vitest";
import { getSearchSuggestions, locativeTr } from "./search-suggestions";

const GUEST = [
  "Yapay zeka projelerini ara…",
  "Mobil uygulama projesi ara…",
  "Endüstriyel tasarımcı ara…",
  "Girişim projelerini ara…",
];

describe("getSearchSuggestions", () => {
  it("returns the fixed guest list for a visitor", () => {
    expect(getSearchSuggestions(null)).toEqual(GUEST);
  });

  it("gives a yazilim user the complement phrases tasarim, isletme and elektronik", () => {
    const list = getSearchSuggestions({ disciplineGroup: "yazilim", interestsJson: "[]", city: null });
    expect(list).toEqual([
      "Endüstriyel tasarımcı ara…",
      "Pazarlama ve iş geliştirme ekip arkadaşı ara…",
      "Elektronik mühendisi ara…",
      // Üç tamamlayıcı tek başına 4'e ulaşmaz; ilk genel öneri tamamlar.
      "Yapay zeka projelerini ara…",
    ]);
  });

  it("adds at most two interests as quoted phrases", () => {
    const list = getSearchSuggestions({
      disciplineGroup: "yazilim",
      interestsJson: JSON.stringify(["robotik", "yapay zeka", "müzik"]),
      city: null,
    });
    expect(list).toContain("'robotik' projelerini ara…");
    expect(list).toContain("'yapay zeka' projelerini ara…");
    expect(list).not.toContain("'müzik' projelerini ara…");
  });

  it("adds the city with the Turkish locative", () => {
    const list = getSearchSuggestions({ disciplineGroup: null, interestsJson: "[]", city: "İzmir" });
    expect(list).toContain("İzmir'deki projeleri ara…");
  });

  it("keeps between 4 and 6 unique strings", () => {
    const full = getSearchSuggestions({
      disciplineGroup: "yazilim",
      interestsJson: JSON.stringify(["robotik", "müzik", "oyun"]),
      city: "Ankara",
    });
    expect(full.length).toBeGreaterThanOrEqual(4);
    expect(full.length).toBeLessThanOrEqual(6);
    expect(new Set(full).size).toBe(full.length);

    const sparse = getSearchSuggestions({ disciplineGroup: null, interestsJson: "[]", city: null });
    expect(sparse.length).toBe(4);
  });
});

describe("locativeTr", () => {
  it.each([
    ["İstanbul", "İstanbul'daki"],
    ["İzmir", "İzmir'deki"],
    ["Ankara", "Ankara'daki"],
    ["Bursa", "Bursa'daki"],
    ["Eskişehir", "Eskişehir'deki"],
    ["Sivas", "Sivas'taki"],
    ["Muş", "Muş'taki"],
    ["Kars", "Kars'taki"],
    ["Bitlis", "Bitlis'teki"],
    ["Hatay", "Hatay'daki"],
    ["Iğdır", "Iğdır'daki"],
    ["Tokat", "Tokat'taki"],
    ["Rize", "Rize'deki"],
    ["Van", "Van'daki"],
  ])("%s takes %s", (city, expected) => {
    expect(locativeTr(city)).toBe(expected);
  });
});
