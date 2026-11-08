import { describe, expect, it } from "vitest";
import { groupNotifications, notificationGroupOf } from "./group";

/**
 * İstanbul saatiyle (sabit UTC+3) bir an. Testler sunucunun saat diliminden bağımsızdır:
 * yerel `new Date(y, m, d, h)` kurucusu kullanılmaz.
 */
function ist(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

const now = ist(2026, 11, 8, 14, 30); // 8 Kasım 2026, 14:30 İstanbul

describe("notificationGroupOf", () => {
  it("puts anything since the start of today (Istanbul) in Bugün", () => {
    expect(notificationGroupOf(ist(2026, 11, 8, 0, 0), now)).toBe("Bugün");
    expect(notificationGroupOf(ist(2026, 11, 8, 14, 29), now)).toBe("Bugün");
  });

  it("puts the previous six days in Bu hafta", () => {
    expect(notificationGroupOf(ist(2026, 11, 7, 23, 59), now)).toBe("Bu hafta");
    expect(notificationGroupOf(ist(2026, 11, 2, 0, 0), now)).toBe("Bu hafta");
  });

  it("puts older notifications in Daha önce", () => {
    expect(notificationGroupOf(ist(2026, 11, 1, 23, 59), now)).toBe("Daha önce");
  });

  it("uses Istanbul midnight, not UTC midnight, after 00:00 Istanbul (before 03:00)", () => {
    // 03:30 İstanbul = 00:30 UTC. 01:00 İstanbul (22:00 UTC, önceki UTC günü) bugündür.
    const earlyMorning = new Date("2026-11-08T00:30:00.000Z");
    expect(notificationGroupOf(new Date("2026-11-07T22:00:00.000Z"), earlyMorning)).toBe("Bugün");
    expect(notificationGroupOf(new Date("2026-11-07T21:00:00.000Z"), earlyMorning)).toBe("Bugün");
    // 23:59 İstanbul (20:59 UTC) dündür.
    expect(notificationGroupOf(new Date("2026-11-07T20:59:00.000Z"), earlyMorning)).toBe("Bu hafta");
  });

  it("does not treat yesterday evening as today when it is already the next day in Istanbul only", () => {
    // 01:30 İstanbul, 8 Kasım = 22:30 UTC, 7 Kasım. 23:30 İstanbul, 7 Kasım (20:30 UTC) dün sayılır.
    const justAfterMidnight = new Date("2026-11-07T22:30:00.000Z");
    expect(notificationGroupOf(new Date("2026-11-07T20:30:00.000Z"), justAfterMidnight)).toBe("Bu hafta");
    expect(notificationGroupOf(new Date("2026-11-07T21:10:00.000Z"), justAfterMidnight)).toBe("Bugün");
  });

  it("starts Bu hafta at Istanbul midnight six days ago", () => {
    const earlyMorning = new Date("2026-11-08T00:30:00.000Z"); // 03:30 İstanbul, 8 Kasım
    expect(notificationGroupOf(new Date("2026-11-01T21:00:00.000Z"), earlyMorning)).toBe("Bu hafta"); // 2 Kasım 00:00
    expect(notificationGroupOf(new Date("2026-11-01T20:59:00.000Z"), earlyMorning)).toBe("Daha önce"); // 1 Kasım 23:59
  });
});

describe("groupNotifications", () => {
  it("keeps order and drops empty groups", () => {
    const items = [
      { id: "a", createdAt: ist(2026, 11, 8, 9, 0) },
      { id: "b", createdAt: ist(2026, 11, 8, 8, 0) },
      { id: "c", createdAt: ist(2026, 11, 4, 8, 0) },
      { id: "d", createdAt: ist(2026, 10, 1, 8, 0) },
    ];
    const groups = groupNotifications(items, now);
    expect(groups.map((group) => group.label)).toEqual(["Bugün", "Bu hafta", "Daha önce"]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupNotifications([], now)).toEqual([]);
  });
});
