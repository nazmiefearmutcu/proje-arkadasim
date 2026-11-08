import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toSearchText } from "@/lib/tr";
import { createUser, resetDb } from "../../tests/helpers/db";
import { isSearchableQuery, searchPeople, searchProjects } from "./search";

async function makeProject(ownerId: string, title: string, extra: { status?: string; summary?: string } = {}) {
  const summary = extra.summary ?? "Öğrencilerin birlikte geliştirdiği bir proje özeti.";
  return db.project.create({
    data: {
      ownerId,
      title,
      summary,
      description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
      status: extra.status ?? "OPEN",
      searchText: toSearchText(title, summary),
      roles: { create: [{ title: "Geliştirici", disciplineGroup: "yazilim", slots: 2 }] },
      members: { create: [{ userId: ownerId, isOwner: true }] },
    },
  });
}

describe("isSearchableQuery", () => {
  it("needs two folded characters and a token", () => {
    expect(isSearchableQuery("a")).toBe(false);
    expect(isSearchableQuery("a b")).toBe(false);
    expect(isSearchableQuery("  ")).toBe(false);
    expect(isSearchableQuery("ai")).toBe(true);
    expect(isSearchableQuery("Işık")).toBe(true);
  });
});

describe("searchProjects", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("matches Turkish capitals without diacritics", async () => {
    const owner = await createUser();
    const project = await makeProject(owner.id, "İstanbul Robotik Kulübü");
    await makeProject(owner.id, "Ankara Girişimi");

    const results = await searchProjects("istanbul");
    expect(results.map((item) => item.id)).toEqual([project.id]);
  });

  it("requires every token to match", async () => {
    const owner = await createUser();
    const both = await makeProject(owner.id, "Robotik kamera sistemi");
    await makeProject(owner.id, "Robotik kol tasarımı");

    const results = await searchProjects("robotik kamera");
    expect(results.map((item) => item.id)).toEqual([both.id]);
  });

  it("returns only open projects", async () => {
    const owner = await createUser();
    await makeProject(owner.id, "Kapanmış yapay zeka projesi", { status: "CLOSED" });
    const open = await makeProject(owner.id, "Açık yapay zeka projesi");

    const results = await searchProjects("yapay zeka");
    expect(results.map((item) => item.id)).toEqual([open.id]);
  });

  it("returns nothing for a short query", async () => {
    const owner = await createUser();
    await makeProject(owner.id, "Robotik kamera sistemi");
    expect(await searchProjects("r")).toEqual([]);
    expect(await searchProjects("a b")).toEqual([]);
  });
});

describe("searchPeople", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("matches Turkish letters folded to ASCII", async () => {
    const viewer = await createUser();
    const person = await createUser({ firstName: "Işık", lastName: "Yılmaz", username: "isikyilmaz" });

    const results = await searchPeople("isik", viewer.id);
    expect(results.map((item) => item.person.id)).toEqual([person.id]);
    expect(results[0].person.verified).toBe(true);
  });

  it("excludes unverified users", async () => {
    const viewer = await createUser();
    await createUser({
      firstName: "Ayşe",
      lastName: "Doğrulanmamış",
      username: "dogrulanmamis",
      verificationStatus: "UNVERIFIED",
      verifiedAt: null,
    });

    expect(await searchPeople("dogrulanmamis", viewer.id)).toEqual([]);
  });

  it("never returns the viewer", async () => {
    const viewer = await createUser({ firstName: "Mert", lastName: "Kaya", username: "mertkaya" });
    expect(await searchPeople("mert", viewer.id)).toEqual([]);
  });

  it("excludes users blocked in either direction", async () => {
    const viewer = await createUser();
    const blockedByViewer = await createUser({ firstName: "Deniz", lastName: "Engelli", username: "denizengelli" });
    const blockingViewer = await createUser({ firstName: "Deniz", lastName: "Engelleyen", username: "denizengelleyen" });
    const visible = await createUser({ firstName: "Deniz", lastName: "Açık", username: "denizacik" });

    await db.block.create({ data: { blockerId: viewer.id, blockedId: blockedByViewer.id } });
    await db.block.create({ data: { blockerId: blockingViewer.id, blockedId: viewer.id } });

    const results = await searchPeople("deniz", viewer.id);
    expect(results.map((item) => item.person.id)).toEqual([visible.id]);
  });

  it("requires every token and reports following", async () => {
    const viewer = await createUser();
    const match = await createUser({ firstName: "Elif", lastName: "Demir", username: "elifdemir" });
    await createUser({ firstName: "Elif", lastName: "Yıldız", username: "elifyildiz" });
    await db.follow.create({ data: { followerId: viewer.id, followingId: match.id } });

    const results = await searchPeople("elif demir", viewer.id);
    expect(results).toHaveLength(1);
    expect(results[0].person.id).toBe(match.id);
    expect(results[0].following).toBe(true);
  });

  it("puts an exact username match first, then the newest verification", async () => {
    const viewer = await createUser({ firstName: "Zeynep", lastName: "Kara", username: "zeynepkara" });
    const older = await createUser({
      firstName: "Ayşe",
      lastName: "Eski",
      username: "aysenurx",
      verifiedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = await createUser({
      firstName: "Ayşe",
      lastName: "Yeni",
      username: "aysenury",
      verifiedAt: new Date("2026-06-01T00:00:00Z"),
    });
    const exact = await createUser({
      firstName: "Ayşe",
      lastName: "Tam",
      username: "ayse",
      verifiedAt: new Date("2025-01-01T00:00:00Z"),
    });

    const results = await searchPeople("ayse", viewer.id);
    expect(results.map((item) => item.person.id)).toEqual([exact.id, newer.id, older.id]);
  });

  it("returns nothing for a short query", async () => {
    const viewer = await createUser();
    await createUser({ firstName: "Ali", lastName: "Veli", username: "aliveli" });
    expect(await searchPeople("a", viewer.id)).toEqual([]);
  });
});
