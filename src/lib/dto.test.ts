import { describe, expect, it } from "vitest";
import { toProjectCardData, toPersonSummary, type ProjectCardRow } from "./dto";

const owner = {
  id: "u1",
  username: "ayse",
  firstName: "Ayşe",
  lastName: "Kılıç",
  avatarPath: null,
  university: "Test Üniversitesi",
  department: "Bilgisayar Mühendisliği",
  disciplineGroup: "yazilim",
  academicStatus: "STUDENT",
  verificationStatus: "VERIFIED",
};

function makeRow(overrides: Partial<ProjectCardRow> = {}): ProjectCardRow {
  return {
    id: "p1",
    title: "Akıllı sera",
    summary: "Sera nemini ölçen bir sistem.",
    category: "DONANIM",
    stage: "PROTOTIP",
    workMode: "HIBRIT",
    city: "İzmir",
    status: "OPEN",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    owner,
    roles: [
      { id: "r1", title: "Devre tasarımcısı", disciplineGroup: "elektronik", slots: 2, _count: { members: 0 } },
      { id: "r2", title: "Gömülü yazılımcı", disciplineGroup: "yazilim", slots: 1, _count: { members: 1 } },
      { id: "r3", title: "Sensör uzmanı", disciplineGroup: "elektronik", slots: 1, _count: { members: 0 } },
      { id: "r4", title: "Kasa tasarımcısı", disciplineGroup: "tasarim", slots: 1, _count: { members: 0 } },
    ],
    _count: { members: 2 },
    ...overrides,
  } as unknown as ProjectCardRow;
}

describe("toProjectCardData", () => {
  it("keeps unique discipline groups in role order", () => {
    const data = toProjectCardData(makeRow());
    expect(data.disciplineGroups).toEqual(["elektronik", "yazilim", "tasarim"]);
  });

  it("counts open slots per role and never goes negative", () => {
    const data = toProjectCardData(makeRow());
    // r1: 2 - 0 = 2, r2: 1 - 1 = 0, r3: 1 - 0 = 1, r4: 1 - 0 = 1
    expect(data.openRoleCount).toBe(4);
  });

  it("lists one strip per role in role order and marks filled roles as full", () => {
    const data = toProjectCardData(makeRow());
    expect(data.roles.map((role) => role.title)).toEqual([
      "Devre tasarımcısı",
      "Gömülü yazılımcı",
      "Sensör uzmanı",
      "Kasa tasarımcısı",
    ]);
    expect(data.roles.map((role) => role.full)).toEqual([false, true, false, false]);
    expect(data.roles[3]).toEqual({ id: "r4", title: "Kasa tasarımcısı", disciplineGroup: "tasarim", full: false });
  });

  it("marks the owner verified only for VERIFIED accounts", () => {
    expect(toProjectCardData(makeRow()).owner.verified).toBe(true);
    const pending = toProjectCardData(
      makeRow({ owner: { ...owner, verificationStatus: "PENDING" } } as Partial<ProjectCardRow>),
    );
    expect(pending.owner.verified).toBe(false);
  });

  it("copies the card fields", () => {
    const data = toProjectCardData(makeRow());
    expect(data).toMatchObject({ id: "p1", title: "Akıllı sera", city: "İzmir", status: "OPEN" });
  });
});

describe("toPersonSummary", () => {
  it("drops the verification status and adds the verified flag", () => {
    const summary = toPersonSummary(owner);
    expect(summary).not.toHaveProperty("verificationStatus");
    expect(summary.verified).toBe(true);
    expect(summary.username).toBe("ayse");
  });
});
