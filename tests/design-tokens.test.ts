import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISCIPLINE_GROUP_IDS } from "@/config/taxonomy";

// globals.css tokenlarını okur ve WCAG kontrastlarını sayıyla doğrular (docs/design-system.md).
// Tek tema vardır (açık); tokenlar :root bloğundan okunur. Koyu tema bilerek yoktur.

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

describe("discipline colours carry dark ink (avatars and role strips)", () => {
  it.each(DISCIPLINE_GROUP_IDS.map((id) => [id]))("%s initials and strip text reach 4.5:1", (id) => {
    expect(contrast(light, `--d-${id}-ink`, `--d-${id}`)).toBeGreaterThanOrEqual(AA);
    expect(contrast(light, "--ink", `--d-${id}`)).toBeGreaterThanOrEqual(AA);
  });

  it("defines --avatar-ink", () => {
    expect(light["--avatar-ink"]).toBeDefined();
  });
});

describe("text pairs reach AA for small text", () => {
  it.each([
    ["--ink-3", "--paper"],
    ["--ink-3", "--surface"],
    ["--ink-3", "--surface-2"],
    ["--ink-2", "--paper"],
    ["--ink-2", "--surface-2"],
    ["--warn", "--warn-soft"],
    ["--warn", "--surface"],
    ["--warn", "--paper"],
    ["--ok", "--ok-soft"],
    ["--ok", "--surface"],
    ["--danger", "--danger-soft"],
    ["--danger", "--surface"],
    ["--stamp", "--stamp-soft"],
    ["--stamp", "--surface"],
    ["--pen", "--pen-soft"],
    ["--pen", "--surface"],
    ["--pen", "--paper"],
    ["--pen-ink", "--pen"],
    ["--pen-ink", "--pen-strong"],
    ["--surface", "--stamp"],
  ])("%s on %s", (foreground, background) => {
    expect(contrast(light, foreground, background)).toBeGreaterThanOrEqual(AA);
  });

  it("has a single theme: no dark colour-scheme override", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
    expect(light["color-scheme"] ?? css.match(/color-scheme:\s*(\w+)/)?.[1]).toBe("light");
  });

  it("makes the logo tick readable on the navy notebook and the blue bar", () => {
    expect(contrast(light, "--tick", "--ink")).toBeGreaterThanOrEqual(7);
    expect(contrast(light, "--tick", "--pen")).toBeGreaterThanOrEqual(AA);
  });
});

describe("modal scrim (F47)", () => {
  const scrimBlock = declarations(block(/:root,\s*::backdrop\s*\{([^}]*)\}/));

  it("is one dark token, also defined on ::backdrop", () => {
    expect(scrimBlock["--scrim"]).toMatch(/^rgb\(\s*\d+ \d+ \d+ \/ 0?\.\d+\s*\)$/);
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
