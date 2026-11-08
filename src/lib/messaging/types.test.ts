import { describe, expect, it } from "vitest";
import { dayLabel, clockLabel, isGroupEnd } from "./format";
import { normalizeBody, previewText, truncateText } from "./types";

describe("normalizeBody", () => {
  it("trims and accepts 1 to 2000 characters", () => {
    expect(normalizeBody("  Merhaba  ")).toBe("Merhaba");
    expect(normalizeBody("x".repeat(2000))).toBe("x".repeat(2000));
  });

  it("rejects empty and over-long bodies", () => {
    expect(normalizeBody("   \n ")).toBeNull();
    expect(normalizeBody("x".repeat(2001))).toBeNull();
  });

  it("counts characters, not UTF-16 units", () => {
    expect(normalizeBody("😀".repeat(2000))).not.toBeNull();
    expect(normalizeBody("😀".repeat(2001))).toBeNull();
  });
});

describe("truncateText and previewText", () => {
  it("cuts at 80 characters and adds an ellipsis", () => {
    const text = "a".repeat(85);
    expect(truncateText(text)).toBe(`${"a".repeat(80)}…`);
    expect(truncateText("kısa")).toBe("kısa");
  });

  it("prefixes the viewer's own messages with 'Sen: '", () => {
    expect(previewText("Selam", true)).toBe("Sen: Selam");
    expect(previewText("Selam", false)).toBe("Selam");
  });

  it("collapses line breaks in previews", () => {
    expect(previewText("satır\nbir\n\niki", false)).toBe("satır bir iki");
  });
});

describe("format helpers", () => {
  const now = new Date(2026, 10, 8, 14, 30);

  it("labels today, yesterday and older days in Turkish", () => {
    expect(dayLabel(new Date(2026, 10, 8, 9), now)).toBe("Bugün");
    expect(dayLabel(new Date(2026, 10, 7, 23), now)).toBe("Dün");
    expect(dayLabel(new Date(2026, 9, 1, 10), now)).toBe("1 Ekim 2026");
  });

  it("formats the clock as HH:mm", () => {
    expect(clockLabel(new Date(2026, 10, 8, 7, 5))).toBe("07:05");
  });

  it("ends a group on sender change, day change or a gap of more than five minutes", () => {
    const base = new Date(2026, 10, 8, 10, 0);
    const current = { mine: true, createdAt: base, dayKey: "d1" };
    expect(isGroupEnd(current, undefined)).toBe(true);
    expect(isGroupEnd(current, { mine: true, createdAt: new Date(base.getTime() + 60_000), dayKey: "d1" })).toBe(false);
    expect(isGroupEnd(current, { mine: false, createdAt: new Date(base.getTime() + 60_000), dayKey: "d1" })).toBe(true);
    expect(isGroupEnd(current, { mine: true, createdAt: new Date(base.getTime() + 60_000), dayKey: "d2" })).toBe(true);
    expect(isGroupEnd(current, { mine: true, createdAt: new Date(base.getTime() + 6 * 60_000), dayKey: "d1" })).toBe(true);
  });
});
