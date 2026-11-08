import { describe, expect, it } from "vitest";
import { groupNotifications, notificationGroupOf } from "./group";

const now = new Date(2026, 10, 8, 14, 30); // 8 Kasım 2026, yerel saat

describe("notificationGroupOf", () => {
  it("puts anything since the start of today in Bugün", () => {
    expect(notificationGroupOf(new Date(2026, 10, 8, 0, 0), now)).toBe("Bugün");
    expect(notificationGroupOf(new Date(2026, 10, 8, 14, 29), now)).toBe("Bugün");
  });

  it("puts the previous six days in Bu hafta", () => {
    expect(notificationGroupOf(new Date(2026, 10, 7, 23, 59), now)).toBe("Bu hafta");
    expect(notificationGroupOf(new Date(2026, 10, 2, 0, 0), now)).toBe("Bu hafta");
  });

  it("puts older notifications in Daha önce", () => {
    expect(notificationGroupOf(new Date(2026, 10, 1, 23, 59), now)).toBe("Daha önce");
  });
});

describe("groupNotifications", () => {
  it("keeps order and drops empty groups", () => {
    const items = [
      { id: "a", createdAt: new Date(2026, 10, 8, 9, 0) },
      { id: "b", createdAt: new Date(2026, 10, 8, 8, 0) },
      { id: "c", createdAt: new Date(2026, 10, 4, 8, 0) },
      { id: "d", createdAt: new Date(2026, 9, 1, 8, 0) },
    ];
    const groups = groupNotifications(items, now);
    expect(groups.map((group) => group.label)).toEqual(["Bugün", "Bu hafta", "Daha önce"]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupNotifications([], now)).toEqual([]);
  });
});
