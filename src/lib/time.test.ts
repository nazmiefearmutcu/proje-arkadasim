import { describe, expect, it } from "vitest";
import { istanbulDayNumber, relativeTimeTr, startOfIstanbulDay } from "./time";

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

  it("writes the absolute date in Istanbul time, not the server's time zone", () => {
    // 5 Ekim 01:30 İstanbul = 4 Ekim 22:30 UTC. UTC biçimleyici "4 Ekim 2026" yazardı.
    expect(relativeTimeTr(new Date("2026-10-04T22:30:00.000Z"), NOW)).toBe("5 Ekim 2026");
  });

  it("bases dün on Istanbul calendar days at the UTC-midnight edge", () => {
    // Şimdi 8 Kasım 01:30 İstanbul (7 Kasım 22:30 UTC).
    const now = new Date("2026-11-07T22:30:00.000Z");
    // 6 Kasım 23:30 İstanbul: 26 saat önce ama iki İstanbul takvim günü önce (UTC'de ise bir gün).
    expect(relativeTimeTr(new Date("2026-11-06T20:30:00.000Z"), now)).toBe("2 gün önce");
    // 7 Kasım 00:30 İstanbul (6 Kasım 21:30 UTC): 25 saat önce, bir İstanbul günü önce.
    expect(relativeTimeTr(new Date("2026-11-06T21:30:00.000Z"), now)).toBe("dün");
  });

  it("keeps hours for anything under 24 hours, even across Istanbul midnight", () => {
    const now = new Date("2026-11-07T22:30:00.000Z"); // 8 Kasım 01:30 İstanbul
    expect(relativeTimeTr(new Date("2026-11-07T19:30:00.000Z"), now)).toBe("3 saat önce");
  });
});

describe("Istanbul day helpers", () => {
  it("starts the Istanbul day at 21:00 UTC of the previous UTC day", () => {
    expect(startOfIstanbulDay(new Date("2026-11-08T00:30:00.000Z")).toISOString()).toBe("2026-11-07T21:00:00.000Z");
    expect(startOfIstanbulDay(new Date("2026-11-07T20:59:59.999Z")).toISOString()).toBe("2026-11-06T21:00:00.000Z");
  });

  it("gives the same day number for moments on the same Istanbul day", () => {
    expect(istanbulDayNumber(new Date("2026-11-07T21:00:00.000Z"))).toBe(
      istanbulDayNumber(new Date("2026-11-08T20:59:59.999Z")),
    );
    expect(istanbulDayNumber(new Date("2026-11-07T20:59:59.999Z"))).toBe(
      istanbulDayNumber(new Date("2026-11-07T21:00:00.000Z")) - 1,
    );
  });
});
