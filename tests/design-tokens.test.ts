import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISCIPLINE_GROUP_IDS } from "@/config/taxonomy";

// globals.css tokenlarını okur ve WCAG kontrastlarını sayıyla doğrular (docs/design-system.md).
// Açık tema :root bloğundan, koyu tema prefers-color-scheme: dark içindeki :root bloğundan gelir;
// koyu blok yalnız değiştirdiği tokenları tanımlar, gerisi açık temadan miras kalır.

const css = readFileSync(fileURLToPath(new URL("../src/app/globals.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function declarations(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1]] = match[2].trim();
  }
  return result;
}

function block(pattern: RegExp): string {
  const match = css.match(pattern);
  if (!match) throw new Error(`globals.css içinde blok bulunamadı: ${pattern}`);
  return match[1];
}

const light = declarations(block(/(?:^|\n):root\s*\{([^}]*)\}/));
const darkOverrides = declarations(block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/));
const dark = { ...light, ...darkOverrides };

function resolve(theme: Record<string, string>, name: string, depth = 0): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`Token tanımlı değil: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) {
    if (depth > 5) throw new Error(`Token döngüsü: ${name}`);
    return resolve(theme, reference[1], depth + 1);
  }
  return value;
}

function luminance(hex: string): number {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) throw new Error(`Hex renk bekleniyordu: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(theme: Record<string, string>, foreground: string, background: string): number {
  const [high, low] = [luminance(resolve(theme, foreground)), luminance(resolve(theme, background))].sort(
    (a, b) => b - a,
  );
  return (high + 0.05) / (low + 0.05);
}

const AA = 4.5;

describe("avatar initials ink (F45)", () => {
  for (const [themeName, theme] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it.each(DISCIPLINE_GROUP_IDS.map((id) => [id]))(`%s initials reach 4.5:1 in the ${themeName} theme`, (id) => {
      expect(contrast(theme, `--d-${id}-ink`, `--d-${id}`)).toBeGreaterThanOrEqual(AA);
    });
  }

  it("defines --avatar-ink for both themes", () => {
    expect(light["--avatar-ink"]).toBeDefined();
    expect(darkOverrides["--avatar-ink"]).toBeDefined();
  });
});

describe("light theme text pairs reach AA for small text (F46)", () => {
  it.each([
    ["--ink-3", "--paper"],
    ["--ink-3", "--surface"],
    ["--ink-3", "--surface-2"],
    ["--warn", "--warn-soft"],
    ["--warn", "--surface"],
    ["--warn", "--paper"],
    ["--ok", "--ok-soft"],
    ["--ok", "--surface"],
    ["--danger", "--danger-soft"],
    ["--stamp", "--stamp-soft"],
    ["--pen", "--pen-soft"],
    ["--ink-2", "--surface-2"],
  ])("%s on %s", (foreground, background) => {
    expect(contrast(light, foreground, background)).toBeGreaterThanOrEqual(AA);
  });

  it("leaves the dark theme text tokens unchanged", () => {
    expect(darkOverrides["--ink-3"]).toBe("#858aa8");
    expect(darkOverrides["--warn"]).toBe("#e9b44c");
    expect(darkOverrides["--ok"]).toBe("#5bcb8f");
  });
});

describe("modal scrim (F47)", () => {
  const scrimBlock = declarations(block(/:root,\s*::backdrop\s*\{([^}]*)\}/));

  it("is one theme-independent dark token, also defined on ::backdrop", () => {
    expect(scrimBlock["--scrim"]).toMatch(/^rgb\(\s*\d+ \d+ \d+ \/ 0?\.\d+\s*\)$/);
    expect(darkOverrides["--scrim"]).toBeUndefined();
    expect(scrimBlock["--scrim"]).not.toContain("--ink");
  });

  it("is exposed as a colour utility", () => {
    expect(css).toMatch(/--color-scrim:\s*var\(--scrim\);/);
  });
});

describe("text classes wrap long unbreakable tokens (F16)", () => {
  it("sets overflow-wrap: anywhere on every type class except t-hero", () => {
    const rule = css.match(/((?:\.t-[\w-]+\s*,\s*)*\.t-[\w-]+)\s*\{\s*overflow-wrap:\s*anywhere;\s*\}/);
    expect(rule).not.toBeNull();
    const selectors = (rule?.[1] ?? "").split(",").map((selector) => selector.trim());
    expect(selectors.sort()).toEqual(
      [".t-body", ".t-card", ".t-label", ".t-meta", ".t-page", ".t-prose", ".t-section"].sort(),
    );
  });
});
