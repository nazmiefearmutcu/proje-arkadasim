import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getProjectDetail, listProjects } from "@/lib/projects/queries";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { approveProjectAction, removeProjectAction } from "./actions";
import { holdIfReportedEnough, moderationForEditedProject, moderationForNewProject } from "./review";

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/guards")>();
  return { ...actual, getCurrentUser: async () => session.user };
});

async function loginAs(role: "ADMIN" | "USER") {
  const user = await createUser({ role });
  session.user = { id: user.id, role };
  return user;
}

async function createProject(ownerId: string, overrides: Record<string, unknown> = {}) {
  return db.project.create({
    data: {
      ownerId,
      title: "Kampüs etkinlik uygulaması",
      summary: "Kulüp etkinliklerini toplayan uygulama.",
      description: "Mobil uygulama geliştiriyoruz.",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
      searchText: "kampus etkinlik uygulamasi",
      members: { create: { userId: ownerId, isOwner: true } },
      ...overrides,
    },
  });
}

describe("içerik denetimi", () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
  });

  it("yeni ilanda şüpheli metni bekletir, temiz metni yayınlar", async () => {
    const owner = await createUser();
    const clean = await moderationForNewProject(owner.id, {
      title: "Akıllı sera sensörü",
      summary: "Sensör verisi toplayan bir sistem.",
      description: "Elektronik ve biyoloji becerisi arıyoruz.",
    });
    expect(clean).toEqual({ moderationStatus: "APPROVED", moderationFlagsJson: "[]" });

    const spam = await moderationForNewProject(owner.id, {
      title: "Ödev yapılır",
      summary: "Ucuza ödev yapılır, ulaş: 0532 123 45 67",
      description: "Hemen yaz.",
    });
    expect(spam.moderationStatus).toBe("PENDING");
    expect(JSON.parse(spam.moderationFlagsJson)).toEqual(expect.arrayContaining(["PHONE", "PAID_WORK"]));
  });

  it("editörün gördüğü işaret düzenlemede yeniden bekletmez; yeni işaret bekletir", async () => {
    const owner = await createUser();
    const project = await createProject(owner.id, {
      moderationFlagsJson: JSON.stringify(["PHONE"]),
      moderatedAt: new Date(),
    });
    const withPhone = { title: "Sera", summary: "Ulaş: 0532 123 45 67", description: "Açıklama metni" };

    expect((await moderationForEditedProject(project, withPhone)).moderationStatus).toBe("APPROVED");
    expect(
      (await moderationForEditedProject(project, { ...withPhone, description: "Ödev yapılır, tez yazılır" })).moderationStatus,
    ).toBe("PENDING");
  });

  it("bekleyen ilan keşifte ve başkasına görünmez, sahibine görünür", async () => {
    const owner = await createUser();
    const other = await createUser();
    const pending = await createProject(owner.id, { moderationStatus: "PENDING" });
    await createProject(owner.id, { title: "Yayındaki ilan" });

    const list = await listProjects({});
    expect(list.items.map((item) => item.id)).not.toContain(pending.id);
    expect(list.items).toHaveLength(1);

    const ownerView = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    const otherView = await db.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(await getProjectDetail(pending.id, otherView as never)).toBeNull();
    expect(await getProjectDetail(pending.id, null)).toBeNull();
    expect((await getProjectDetail(pending.id, ownerView as never))?.moderationStatus).toBe("PENDING");
  });

  it("üç farklı kişiden şikayet gelince ilanı bekletir", async () => {
    const owner = await createUser();
    const project = await createProject(owner.id);
    for (let i = 0; i < 2; i += 1) {
      const reporter = await createUser();
      await db.report.create({ data: { reporterId: reporter.id, targetType: "PROJECT", targetId: project.id, reason: "Spam" } });
    }
    expect(await holdIfReportedEnough(project.id)).toBe(false);

    const third = await createUser();
    await db.report.create({ data: { reporterId: third.id, targetType: "PROJECT", targetId: project.id, reason: "Reklam" } });
    expect(await holdIfReportedEnough(project.id)).toBe(true);
    const held = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(held.moderationStatus).toBe("PENDING");
    expect(JSON.parse(held.moderationFlagsJson)).toContain("REPORTED");
  });

  it("editör onayı ilanı yayınlar, şikayetleri çözer, sahibe ve takipçilere bildirir", async () => {
    const owner = await createUser();
    const follower = await createUser();
    await db.follow.create({ data: { followerId: follower.id, followingId: owner.id } });
    const project = await createProject(owner.id, { moderationStatus: "PENDING" });
    await db.report.create({ data: { reporterId: follower.id, targetType: "PROJECT", targetId: project.id, reason: "Spam" } });
    const editor = await loginAs("ADMIN");

    expect(await approveProjectAction(project.id)).toEqual({ ok: true });
    // İkinci basış yeni bildirim üretmez.
    expect(await approveProjectAction(project.id)).toEqual({ ok: true });

    const approved = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(approved).toMatchObject({ moderationStatus: "APPROVED", moderatedById: editor.id });
    expect(await db.report.count({ where: { status: "OPEN" } })).toBe(0);
    expect(await db.notification.count({ where: { userId: owner.id, type: "PROJECT_APPROVED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: follower.id, type: "NEW_PROJECT_FROM_FOLLOWING" } })).toBe(1);
    expect(await db.adminAuditLog.count({ where: { action: "APPROVE_PROJECT" } })).toBe(2);
  });

  it("editör ilanı gerekçeyle siler ve sahibine başlık ve gerekçeyle bildirir", async () => {
    const owner = await createUser();
    const project = await createProject(owner.id, { title: "Bedava takipçi" });
    await loginAs("ADMIN");

    expect(await removeProjectAction({ projectId: project.id, reason: "ADVERTISING", note: "İlan reklam içeriyor." })).toEqual({ ok: true });

    expect(await db.project.findUnique({ where: { id: project.id } })).toBeNull();
    const notification = await db.notification.findFirstOrThrow({ where: { userId: owner.id, type: "PROJECT_REMOVED" } });
    expect(JSON.parse(notification.dataJson)).toEqual({ title: "Bedava takipçi", reason: "Reklam. İlan reklam içeriyor." });
    expect(await db.adminAuditLog.count({ where: { action: "DELETE_PROJECT:ADVERTISING" } })).toBe(1);

    expect((await removeProjectAction({ projectId: project.id, reason: "SPAM", note: "" })).ok).toBe(false);
  });

  it("gerekçesiz silmeyi ve editör olmayanı reddeder", async () => {
    const owner = await createUser();
    const project = await createProject(owner.id);

    await loginAs("USER");
    expect((await approveProjectAction(project.id)).ok).toBe(false);
    expect((await removeProjectAction({ projectId: project.id, reason: "SPAM", note: "" })).ok).toBe(false);

    await loginAs("ADMIN");
    expect((await removeProjectAction({ projectId: project.id, reason: "", note: "" })).ok).toBe(false);
    expect(await db.project.count()).toBe(1);
  });
});
