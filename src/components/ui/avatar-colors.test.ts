import { describe, expect, it } from "vitest";
import { DISCIPLINE_GROUP_IDS } from "@/config/taxonomy";
import { avatarColorsFor, paletteColorFor, paletteGroupFor } from "./avatar-colors";

describe("avatarColorsFor", () => {
  it("pairs the discipline colour with its own ink token instead of raw white", () => {
    expect(avatarColorsFor("endustri", "ayse")).toEqual({
      background: "var(--d-endustri)",
      color: "var(--d-endustri-ink)",
    });
  });

  it("falls back to the seed palette and keeps background and ink on the same group", () => {
    const colors = avatarColorsFor(null, "ayse.kilic");
    const group = paletteGroupFor("ayse.kilic");
    expect(DISCIPLINE_GROUP_IDS).toContain(group);
    expect(colors).toEqual({ background: `var(--d-${group})`, color: `var(--d-${group}-ink)` });
    expect(paletteColorFor("ayse.kilic")).toBe(colors.background);
  });

  it("ignores unknown discipline ids", () => {
    const group = paletteGroupFor("x");
    expect(avatarColorsFor("bilinmeyen", "x").background).toBe(`var(--d-${group})`);
  });
});
