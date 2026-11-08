import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../tests/helpers/db";
import {
  canMessageDirectly,
  displayName,
  fullName,
  isBlockedEitherWay,
} from "./permissions";

async function createProject(ownerId: string, title = "Akıllı sera") {
  return db.project.create({
    data: {
      ownerId,
      title,
      summary: "Sera nemini ölçen düşük maliyetli bir sistem.",
      description: "Sera nemini ve sıcaklığını ölçüp uzaktan izleyen bir prototip. ".repeat(3),
      category: "YAZILIM",
      stage: "PROTOTIP",
      workMode: "UZAKTAN",
      searchText: "akilli sera",
    },
  });
}

describe("displayName ve fullName", () => {
  const person = { firstName: "Ayşe Nur", lastName: "Kılıç Öztürk" };
  const verified = { verificationStatus: "VERIFIED" };

  it("doğrulanmış görüntüleyene tam ad gösterilir", () => {
    expect(displayName(person, verified)).toBe("Ayşe Nur Kılıç Öztürk");
  });

  it("doğrulanmamış görüntüleyene soyadın baş harfleri gösterilir", () => {
    expect(displayName(person, { verificationStatus: "UNVERIFIED" })).toBe("Ayşe Nur K. Ö.");
  });

  it("misafire (viewer null) soyadın baş harfleri gösterilir", () => {
    expect(displayName(person, null)).toBe("Ayşe Nur K. Ö.");
  });

  it("baş harf büyütmesi Türkçe kurala göre yapılır (i → İ)", () => {
    expect(displayName({ firstName: "Ali", lastName: "ilhan" }, null)).toBe("Ali İ.");
  });

  it("yönetici tam adı görür", () => {
    expect(displayName(person, { verificationStatus: "UNVERIFIED", role: "ADMIN" })).toBe(
      "Ayşe Nur Kılıç Öztürk",
    );
  });

  it("fullName ad ve soyadı birleştirir", () => {
    expect(fullName({ firstName: "Mehmet", lastName: "Öz" })).toBe("Mehmet Öz");
  });
});

describe("mesajlaşma izni", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("karşılıklı takipte doğrudan mesaj açılabilir", async () => {
    const a = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const b = await createUser({ firstName: "Elif", lastName: "Kaya" });
    await db.follow.create({ data: { followerId: a.id, followingId: b.id } });
    await db.follow.create({ data: { followerId: b.id, followingId: a.id } });

    expect(await canMessageDirectly(a.id, b.id)).toBe(true);
  });

  it("aynı projenin üyeleri arasında doğrudan mesaj açılabilir", async () => {
    const owner = await createUser({ firstName: "Mehmet", lastName: "Öz" });
    const member = await createUser({ firstName: "Zeynep", lastName: "Aksoy" });
    const project = await createProject(owner.id);
    await db.projectMember.create({
      data: { projectId: project.id, userId: owner.id, isOwner: true },
    });
    await db.projectMember.create({ data: { projectId: project.id, userId: member.id } });

    expect(await canMessageDirectly(owner.id, member.id)).toBe(true);
  });

  it("tek yönlü takipte doğrudan mesaj açılmaz", async () => {
    const a = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const b = await createUser({ firstName: "Elif", lastName: "Kaya" });
    await db.follow.create({ data: { followerId: a.id, followingId: b.id } });

    expect(await canMessageDirectly(a.id, b.id)).toBe(false);
  });

  it("engel varsa karşılıklı takipte bile mesaj açılmaz", async () => {
    const a = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const b = await createUser({ firstName: "Elif", lastName: "Kaya" });
    await db.follow.create({ data: { followerId: a.id, followingId: b.id } });
    await db.follow.create({ data: { followerId: b.id, followingId: a.id } });
    await db.block.create({ data: { blockerId: b.id, blockedId: a.id } });

    expect(await isBlockedEitherWay(a.id, b.id)).toBe(true);
    expect(await canMessageDirectly(a.id, b.id)).toBe(false);
  });
});
