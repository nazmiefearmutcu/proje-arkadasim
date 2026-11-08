import { describe, expect, it } from "vitest";
import { parseList, parseObject, toListJson } from "@/lib/json-fields";

describe("parseList", () => {
  it("geçerli dizi metnini listeye çevirir", () => {
    expect(parseList('["Robotik","Yapay zeka"]')).toEqual(["Robotik", "Yapay zeka"]);
  });

  it("bozuk JSON için hata vermeden boş liste döner", () => {
    expect(parseList("{bozuk")).toEqual([]);
  });

  it("dizi olmayan JSON için boş liste döner", () => {
    expect(parseList('{"a":1}')).toEqual([]);
    expect(parseList("42")).toEqual([]);
  });

  it("boş, null ve undefined girdiler için boş liste döner", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(null)).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });

  it("dizideki metin olmayan öğeleri atar", () => {
    expect(parseList('["a", 1, null, "b"]')).toEqual(["a", "b"]);
  });
});

describe("toListJson", () => {
  it("öğeleri kırpar ve boşları atar", () => {
    expect(toListJson(["  Robotik  ", "", "   ", "Yapay zeka"])).toBe(
      '["Robotik","Yapay zeka"]',
    );
  });

  it("büyük/küçük harf ve Türkçe harf farkı gözetmeksizin tekilleştirir", () => {
    expect(toListJson(["Robotik", "robotik", "ROBOTİK", "Yapay Zeka", "yapay zeka"])).toBe(
      '["Robotik","Yapay Zeka"]',
    );
  });

  it("her öğeyi en fazla 40 karakterle sınırlar", () => {
    const long = "a".repeat(60);
    const parsed = parseList(toListJson([long]));
    expect(parsed).toEqual(["a".repeat(40)]);
  });

  it("öğe sayısını varsayılan 20 ile sınırlar", () => {
    const items = Array.from({ length: 30 }, (_, i) => `etiket${i}`);
    expect(parseList(toListJson(items))).toHaveLength(20);
  });

  it("öğe sayısını verilen max ile sınırlar", () => {
    const items = ["bir", "iki", "uc", "dort"];
    expect(parseList(toListJson(items, 2))).toEqual(["bir", "iki"]);
  });

  it("parseList ile geri okunabilir", () => {
    const json = toListJson(["Tasarım", "Girişim"]);
    expect(parseList(json)).toEqual(["Tasarım", "Girişim"]);
  });
});

describe("parseObject", () => {
  it("nesne metnini okur", () => {
    expect(parseObject<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });

  it("bozuk JSON için varsayılanı döner", () => {
    expect(parseObject("{bozuk", { a: 0 })).toEqual({ a: 0 });
  });

  it("dizi ya da ilkel değer için varsayılanı döner", () => {
    expect(parseObject("[1,2]", { a: 0 })).toEqual({ a: 0 });
    expect(parseObject("5", { a: 0 })).toEqual({ a: 0 });
    expect(parseObject("null", { a: 0 })).toEqual({ a: 0 });
  });

  it("boş ve null girdiler için varsayılanı döner", () => {
    expect(parseObject("", { a: 0 })).toEqual({ a: 0 });
    expect(parseObject(null, { a: 0 })).toEqual({ a: 0 });
  });
});
