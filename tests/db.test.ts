import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "./helpers/db";

describe("veritabanı kaskad silme", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("kullanıcı silinince projesi, rolü ve takibi de silinir", async () => {
    const owner = await createUser({ firstName: "Mehmet", lastName: "Öz" });
    const follower = await createUser({ firstName: "Elif", lastName: "Kaya" });

    const project = await db.project.create({
      data: {
        ownerId: owner.id,
        title: "Akıllı sera",
        summary: "Sera nemini ölçen düşük maliyetli bir sistem.",
        description: "Sera nemini ve sıcaklığını ölçüp uzaktan izleyen bir prototip. ".repeat(3),
        category: "YAZILIM",
        stage: "PROTOTIP",
        workMode: "UZAKTAN",
        searchText: "akilli sera",
      },
    });

    const role = await db.projectRole.create({
      data: {
        projectId: project.id,
        title: "Gömülü yazılımcı",
        disciplineGroup: "elektronik",
        slots: 1,
      },
    });

    await db.follow.create({
      data: { followerId: follower.id, followingId: owner.id },
    });

    expect(await db.project.count({ where: { id: project.id } })).toBe(1);
    expect(await db.projectRole.count({ where: { id: role.id } })).toBe(1);
    expect(await db.follow.count({ where: { followingId: owner.id } })).toBe(1);

    await db.user.delete({ where: { id: owner.id } });

    expect(await db.project.count({ where: { id: project.id } })).toBe(0);
    expect(await db.projectRole.count({ where: { id: role.id } })).toBe(0);
    expect(await db.follow.count({ where: { followingId: owner.id } })).toBe(0);
    // Takip eden kullanıcı silinmez.
    expect(await db.user.count({ where: { id: follower.id } })).toBe(1);
  });

  it("yönetici ve hedef kullanıcı silinince denetim kaydı kalır, ilişki alanı boşalır", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const target = await createUser();

    const audit = await db.adminAuditLog.create({
      data: { adminId: admin.id, action: "VERIFICATION_REVIEW", targetUserId: target.id },
    });

    await db.user.delete({ where: { id: target.id } });
    const afterTarget = await db.adminAuditLog.findUniqueOrThrow({ where: { id: audit.id } });
    expect(afterTarget.targetUserId).toBeNull();
    expect(afterTarget.adminId).toBe(admin.id);

    await db.user.delete({ where: { id: admin.id } });
    const afterAdmin = await db.adminAuditLog.findUniqueOrThrow({ where: { id: audit.id } });
    expect(afterAdmin.adminId).toBeNull();
    expect(afterAdmin.action).toBe("VERIFICATION_REVIEW");
  });

  it("raporlayan kullanıcı silinince rapor kaydı kalır", async () => {
    const reporter = await createUser();
    const reported = await createUser();

    const report = await db.report.create({
      data: { reporterId: reporter.id, targetType: "USER", targetId: reported.id, reason: "SPAM" },
    });

    await db.user.delete({ where: { id: reporter.id } });
    const after = await db.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(after.reporterId).toBeNull();
    expect(after.targetId).toBe(reported.id);
  });
});
