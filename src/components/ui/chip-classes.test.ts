import { describe, expect, it } from "vitest";
import { chipClasses } from "./chip-classes";

const classes = (value: string) => value.split(/\s+/);

describe("chipClasses", () => {
  it("gives static chips 32 px and lets long text wrap inside the container (F16)", () => {
    const list = classes(chipClasses());
    expect(list).toContain("min-h-8");
    expect(list).toContain("max-w-full");
    expect(list).toContain("whitespace-normal");
    expect(list).toContain("[overflow-wrap:anywhere]");
    expect(list).not.toContain("whitespace-nowrap");
  });

  it("gives interactive filter chips a 44 px target and keeps them on one line (M4)", () => {
    const list = classes(chipClasses(true, "shrink-0", { interactive: true, nowrap: true }));
    expect(list).toContain("min-h-11");
    expect(list).toContain("whitespace-nowrap");
    expect(list).toContain("bg-pen-soft");
    expect(list).toContain("shrink-0");
    expect(list).not.toContain("min-h-8");
    expect(list).not.toContain("whitespace-normal");
  });

  it("lets interactive suggestion chips wrap while keeping the 44 px target (R3)", () => {
    const list = classes(chipClasses(false, undefined, { interactive: true }));
    expect(list).toContain("min-h-11");
    expect(list).toContain("[overflow-wrap:anywhere]");
    expect(list).not.toContain("min-h-8");
  });

  it("never emits two min-height or two white-space classes (cn does not merge conflicts)", () => {
    for (const style of [{}, { interactive: true }, { nowrap: true }, { interactive: true, nowrap: true }]) {
      const list = classes(chipClasses(false, undefined, style));
      expect(list.filter((name) => name.startsWith("min-h-"))).toHaveLength(1);
      expect(list.filter((name) => name.startsWith("whitespace-"))).toHaveLength(1);
    }
  });
});
