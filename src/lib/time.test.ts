import { describe, expect, it } from "vitest";
import { relativeTimeTr } from "./time";

const NOW = new Date("2026-11-08T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("relativeTimeTr", () => {
  it("says az önce under a minute", () => {
    expect(relativeTimeTr(ago(30 * 1000), NOW)).toBe("az önce");
    expect(relativeTimeTr(NOW, NOW)).toBe("az önce");
  });

  it("counts minutes under an hour", () => {
    expect(relativeTimeTr(ago(5 * MINUTE), NOW)).toBe("5 dakika önce");
  });

  it("counts hours under a day", () => {
    expect(relativeTimeTr(ago(3 * HOUR), NOW)).toBe("3 saat önce");
  });

  it("says dün for one day", () => {
    expect(relativeTimeTr(ago(DAY + HOUR), NOW)).toBe("dün");
  });

  it("counts days up to a week", () => {
    expect(relativeTimeTr(ago(4 * DAY), NOW)).toBe("4 gün önce");
  });

  it("counts weeks up to a month", () => {
    expect(relativeTimeTr(ago(14 * DAY), NOW)).toBe("2 hafta önce");
  });

  it("writes older dates as day, long month and year", () => {
    const old = new Date("2026-01-05T09:00:00.000Z");
    expect(relativeTimeTr(old, NOW)).toBe("5 Ocak 2026");
  });
});
