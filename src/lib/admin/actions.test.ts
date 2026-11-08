import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import {
  adminCloseProjectAction,
  approveAttemptAction,
  purgeMaskedTextAction,
  rejectAttemptAction,
  resolveReportAction,
  revokeVerificationAction,
} from "./actions";
import type { EducationFieldsInput } from "./actions";

// Oturumdaki kullanıcı testte değiştirilir; gerçek çerez ve istek bağlamı kullanılmaz.
const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/guards")>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
  };
});

const VALID_FIELDS: EducationFieldsInput = {
  university: "Orta Doğu Teknik Üniversitesi",
  faculty: "Mühendislik Fakültesi",
  department: "Bilgisayar Mühendisliği",
  academicStatus: "STUDENT",
  degreeLevel: "LISANS",
  classYear: "3",
  graduationYear: "",
};

const PENDING_FIELDS = {
  verificationStatus: "MANUAL_REVIEW",
  verifiedAt: null,
  academicStatus: null,
  university: null,
  department: null,
  disciplineGroup: null,
} as const;

async function createPendingUser(overrides: { city?: string } = {}) {
  return createUser({ ...PENDING_FIELDS, ...overrides });
}

async function createReviewAttempt(userId: string, docHash = `hash-${Math.random().toString(36).slice(2)}`) {
  return db.verificationAttempt.create({
    data: {
      userId,
      status: "MANUAL_REVIEW",
      source: "PDF_TEXT",
      docHash,
      nameMatch: true,
      aiUsed: true,
      aiModel: "mock-1",
      aiConfidence: 0.6,
      aiSummary: "Belge kısmen okundu.",
      redFlagsJson: JSON.stringify(["Tarih belirsiz"]),
      maskedText: "[AD] [SOYAD] [TCKN] Bilgisayar Mühendisliği",
      maskedTextExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

async function loginAs(role: "ADMIN" | "USER") {
  const user = await createUser({ role });
  session.user = { id: user.id, role };
  return user;
}

/** Kendi belgesi manuel incelemede olan yönetici. */
async function loginAsPendingAdmin() {
  const user = await createUser({ role: "ADMIN", ...PENDING_FIELDS });
  session.user = { id: user.id, role: "ADMIN" };
  return user;
}

async function createApprovedAttempt(userId: string, docHash = `hash-${Math.random().toString(36).slice(2)}`) {
  return db.verificationAttempt.create({
    data: {
      userId,
      status: "APPROVED",
      source: "PDF_TEXT",
      docHash,
      nameMatch: true,
      aiUsed: true,
      aiModel: "mock-1",
      aiConfidence: 0.95,
      extractedJson: JSON.stringify({ university: "Test Üniversitesi" }),
    },
  });
}

async function createProject(ownerId: string, status: "OPEN" | "CLOSED" = "OPEN") {
  return db.project.create({
    data: {
      ownerId,
      title: "Akıllı sera",
      summary: "Sera nemini ölçen düşük maliyetli bir sistem.",
      description: "Sera nemini ve sıcaklığını ölçüp uzaktan izleyen bir prototip. ".repeat(3),
      category: "YAZILIM",
      stage: "PROTOTIP",
      workMode: "UZAKTAN",
      status,
      searchText: "akilli sera",
    },
  });
}

async function verificationNotices(userId: string) {
  return db.notification.count({ where: { userId, type: "VERIFICATION_RESULT" } });
}

beforeEach(async () => {
  await resetDb();
  session.user = null;
});

describe("approveAttemptAction", () => {
  it("belgeyi onaylar: kullanıcı VERIFIED olur, alanlar ve disiplin grubu yazılır, maskeli metin silinir", async () => {
    const admin = await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(result).toEqual({ ok: true });

    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.verificationStatus).toBe("VERIFIED");
    expect(user.verifiedAt).not.toBeNull();
    expect(user.university).toBe("Orta Doğu Teknik Üniversitesi");
    expect(user.department).toBe("Bilgisayar Mühendisliği");
    expect(user.academicStatus).toBe("STUDENT");
    expect(user.degreeLevel).toBe("LISANS");
    expect(user.classYear).toBe(3);
    expect(user.graduationYear).toBeNull();
    expect(user.disciplineGroup).toBe("yazilim");
    expect(user.searchText).toContain("orta dogu teknik universitesi");

    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("APPROVED");
    expect(row.maskedText).toBeNull();
    expect(row.maskedTextExpiresAt).toBeNull();
    expect(row.reviewedById).toBe(admin.id);
    expect(row.reviewedAt).not.toBeNull();

    const audit = await db.adminAuditLog.findMany({ where: { action: "APPROVE_VERIFICATION" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ adminId: admin.id, targetUserId: pending.id, targetId: attempt.id });

    const notice = await db.notification.findFirst({
      where: { userId: pending.id, type: "VERIFICATION_RESULT" },
    });
    expect(notice).not.toBeNull();
    expect(JSON.parse(notice!.dataJson)).toEqual({ status: "APPROVED" });
  });

  it("aynı belgeyi ikinci kez onaylamaz", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    expect((await approveAttemptAction(attempt.id, VALID_FIELDS)).ok).toBe(true);
    const second = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(second.ok).toBe(false);
    expect(await db.adminAuditLog.count({ where: { action: "APPROVE_VERIFICATION" } })).toBe(1);
  });

  it("geçersiz alanlarda alan hatası döner ve hiçbir şey değişmez", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await approveAttemptAction(attempt.id, { ...VALID_FIELDS, university: " " });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.university).toBeTruthy();
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
  });

  it("yönetici olmayan kullanıcı için hata döner ve hiçbir şey değişmez", async () => {
    const user = await loginAs("USER");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
    const target = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(target.verificationStatus).toBe("MANUAL_REVIEW");
    expect(await db.adminAuditLog.count({ where: { adminId: user.id } })).toBe(0);
  });

  it("oturum yoksa hata döner", async () => {
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
  });

  it("yönetici kendi belgesini onaylayamaz: belge ve kullanıcı MANUAL_REVIEW kalır, denetim kaydı yazılmaz", async () => {
    const admin = await loginAsPendingAdmin();
    const attempt = await createReviewAttempt(admin.id);

    const result = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(result).toEqual({ ok: false, error: "Kendi belgeni inceleyemezsin." });
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
    expect(row.reviewedById).toBeNull();
    expect(row.maskedText).not.toBeNull();
    const self = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(self.verificationStatus).toBe("MANUAL_REVIEW");
    expect(self.university).toBeNull();
    expect(await db.adminAuditLog.count()).toBe(0);
    expect(await verificationNotices(admin.id)).toBe(0);
  });

  it("sınıfı ayarlarla aynı üst sınıra (8) kadar kabul eder", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    expect(await approveAttemptAction(attempt.id, { ...VALID_FIELDS, classYear: "8" })).toEqual({ ok: true });

    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.classYear).toBe(8);
  });

  it("ayarların üst sınırını (8) aşan sınıfı reddeder ve hiçbir şey değişmez", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await approveAttemptAction(attempt.id, { ...VALID_FIELDS, classYear: "9" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.classYear).toBe("Sınıf 1-8 arasında olmalı.");
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
  });

  it("onay, kullanıcının ayarlarda yazdığı şehri arama metninde korur", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser({ city: "İzmir" });
    const attempt = await createReviewAttempt(pending.id);

    expect((await approveAttemptAction(attempt.id, VALID_FIELDS)).ok).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.searchText).toContain("izmir");
    expect(user.searchText).toContain("bilgisayar muhendisligi");
  });
});

describe("approveAttemptAction: aynı belgenin başka hesapta kullanımı", () => {
  it("iki hesap aynı belgeyle incelemedeyken ilki onaylanır, ikincisinin onayı reddedilir ve hiçbir şey değişmez", async () => {
    const admin = await loginAs("ADMIN");
    const first = await createPendingUser();
    const second = await createPendingUser();
    const attemptA = await createReviewAttempt(first.id, "shared-hash");
    const attemptB = await createReviewAttempt(second.id, "shared-hash");

    expect(await approveAttemptAction(attemptA.id, VALID_FIELDS)).toEqual({ ok: true });
    const result = await approveAttemptAction(attemptB.id, VALID_FIELDS);

    expect(result).toEqual({
      ok: false,
      error: "Bu belge başka bir doğrulanmış hesapta kullanılmış. Belgeyi reddet.",
    });
    const rowB = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptB.id } });
    expect(rowB.status).toBe("MANUAL_REVIEW");
    expect(rowB.reviewedById).toBeNull();
    expect(rowB.maskedText).not.toBeNull();
    const userB = await db.user.findUniqueOrThrow({ where: { id: second.id } });
    expect(userB.verificationStatus).toBe("MANUAL_REVIEW");
    expect(userB.university).toBeNull();
    expect(await db.adminAuditLog.count({ where: { action: "APPROVE_VERIFICATION", adminId: admin.id } })).toBe(1);
    expect(await verificationNotices(second.id)).toBe(0);

    // İkinci belge hâlâ reddedilebilir.
    expect(await rejectAttemptAction(attemptB.id, "Bu belge başka bir hesapta kullanılmış.")).toEqual({ ok: true });
  });

  it("belge başka bir hesapta yapay zekayla onaylandıysa incelemedeki aynı belge onaylanamaz", async () => {
    await loginAs("ADMIN");
    const verified = await createUser();
    await createApprovedAttempt(verified.id, "shared-hash");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id, "shared-hash");

    const result = await approveAttemptAction(attempt.id, VALID_FIELDS);

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.verificationStatus).toBe("MANUAL_REVIEW");
    expect(await db.adminAuditLog.count({ where: { action: "APPROVE_VERIFICATION" } })).toBe(0);
  });

  it("başka hesapta reddedilmiş aynı belge onayı engellemez", async () => {
    await loginAs("ADMIN");
    const other = await createUser({ verificationStatus: "REJECTED", verifiedAt: null });
    await db.verificationAttempt.create({
      data: { userId: other.id, status: "REJECTED", source: "PDF_TEXT", docHash: "shared-hash", nameMatch: false },
    });
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id, "shared-hash");

    expect(await approveAttemptAction(attempt.id, VALID_FIELDS)).toEqual({ ok: true });
  });
});

describe("rejectAttemptAction", () => {
  it("belgeyi reddeder: gerekçe yazılır, kullanıcı REJECTED olur, bildirim gider", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);
    const reason = "Belgedeki ad soyad hesabınızla eşleşmiyor.";

    const result = await rejectAttemptAction(attempt.id, reason);

    expect(result).toEqual({ ok: true });
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectReason).toBe(reason);
    expect(row.maskedText).toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.verificationStatus).toBe("REJECTED");

    expect(await db.adminAuditLog.count({ where: { action: "REJECT_VERIFICATION" } })).toBe(1);
    const notice = await db.notification.findFirst({
      where: { userId: pending.id, type: "VERIFICATION_RESULT" },
    });
    expect(JSON.parse(notice!.dataJson)).toEqual({ status: "REJECTED" });
  });

  it("on karakterden kısa gerekçeyi reddeder", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await rejectAttemptAction(attempt.id, "kısa");

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
  });

  it("yönetici olmayan kullanıcı reddedemez", async () => {
    await loginAs("USER");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id);

    const result = await rejectAttemptAction(attempt.id, "Yeterli bir gerekçe burada.");

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
  });

  it("yönetici kendi belgesini reddedemez: belge ve kullanıcı MANUAL_REVIEW kalır, denetim kaydı yazılmaz", async () => {
    const admin = await loginAsPendingAdmin();
    const attempt = await createReviewAttempt(admin.id);

    const result = await rejectAttemptAction(attempt.id, "Kendi belgemi reddetmeye çalışıyorum.");

    expect(result).toEqual({ ok: false, error: "Kendi belgeni inceleyemezsin." });
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
    expect(row.rejectReason).toBeNull();
    expect(row.maskedText).not.toBeNull();
    const self = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(self.verificationStatus).toBe("MANUAL_REVIEW");
    expect(await db.adminAuditLog.count()).toBe(0);
    expect(await verificationNotices(admin.id)).toBe(0);
  });
});

describe("resolveReportAction", () => {
  it("şikayeti çözüldü olarak işaretler ve denetim kaydı yazar", async () => {
    const admin = await loginAs("ADMIN");
    const report = await db.report.create({
      data: { targetType: "PROJECT", targetId: "x", reason: "Spam" },
    });

    expect(await resolveReportAction(report.id)).toEqual({ ok: true });

    const row = await db.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(row.status).toBe("RESOLVED");
    const audit = await db.adminAuditLog.findFirst({ where: { action: "RESOLVE_REPORT" } });
    expect(audit).toMatchObject({ adminId: admin.id, targetId: report.id });
  });
});

describe("purgeMaskedTextAction", () => {
  it("süresi dolan maskeli metinleri temizler ve sayıyı döner", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const expired = await createReviewAttempt(pending.id);
    await db.verificationAttempt.update({
      where: { id: expired.id },
      data: { maskedTextExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await purgeMaskedTextAction();

    expect(result).toEqual({ ok: true, data: { count: 1 } });
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: expired.id } });
    expect(row.maskedText).toBeNull();
  });
});

describe("aynı kullanıcıya ait eski inceleme kayıtları", () => {
  it("doğrulanmış kullanıcının eski bekleyen belgesi reddedilince kullanıcı REJECTED olmaz, bildirim gitmez", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const older = await createReviewAttempt(pending.id);
    const newer = await createReviewAttempt(pending.id);

    expect((await approveAttemptAction(newer.id, VALID_FIELDS)).ok).toBe(true);
    const rejected = await rejectAttemptAction(older.id, "Eski belge, yeni belge onaylandı.");

    expect(rejected).toEqual({ ok: true });
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: older.id } });
    expect(row.status).toBe("REJECTED");
    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.verificationStatus).toBe("VERIFIED");
    expect(user.university).toBe("Orta Doğu Teknik Üniversitesi");
    const rejectNotices = await db.notification.count({
      where: { userId: pending.id, type: "VERIFICATION_RESULT", dataJson: { contains: "REJECTED" } },
    });
    expect(rejectNotices).toBe(0);
  });

  it("doğrulanmış kullanıcının ikinci bekleyen belgesi onaylanamaz ve kayıt değişmez", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();
    const first = await createReviewAttempt(pending.id);
    const second = await createReviewAttempt(pending.id);

    expect((await approveAttemptAction(first.id, VALID_FIELDS)).ok).toBe(true);
    const result = await approveAttemptAction(second.id, VALID_FIELDS);

    expect(result.ok).toBe(false);
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: second.id } });
    expect(row.status).toBe("MANUAL_REVIEW");
    expect(row.reviewedById).toBeNull();
    expect(await db.adminAuditLog.count({ where: { action: "APPROVE_VERIFICATION" } })).toBe(1);
  });
});

describe("revokeVerificationAction", () => {
  const REASON = "Şikayet incelendi: belge sahte, hesap başkasının adına açılmış.";

  it("doğrulamayı geri alır: kullanıcı REJECTED olur, son onaylı belge gerekçeyle REJECTED olur, denetim kaydı ve bildirim yazılır", async () => {
    const admin = await loginAs("ADMIN");
    const target = await createUser();
    const older = await createApprovedAttempt(target.id);
    const latest = await createApprovedAttempt(target.id);
    await db.verificationAttempt.update({
      where: { id: older.id },
      data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const result = await revokeVerificationAction(target.id, REASON);

    expect(result).toEqual({ ok: true });
    const user = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.verificationStatus).toBe("REJECTED");
    expect(user.verifiedAt).toBeNull();

    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: latest.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectReason).toBe(REASON);
    expect(row.reviewedById).toBe(admin.id);
    expect(row.reviewedAt).not.toBeNull();
    const untouched = await db.verificationAttempt.findUniqueOrThrow({ where: { id: older.id } });
    expect(untouched.status).toBe("APPROVED");

    const audit = await db.adminAuditLog.findMany({ where: { action: "REVOKE_VERIFICATION" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ adminId: admin.id, targetUserId: target.id, targetId: latest.id });

    const notice = await db.notification.findFirst({
      where: { userId: target.id, type: "VERIFICATION_RESULT" },
    });
    expect(JSON.parse(notice!.dataJson)).toEqual({ status: "REJECTED" });
  });

  it("geri alınan belge, aynı belgeyle başka bir hesabın onayını artık engellemez", async () => {
    await loginAs("ADMIN");
    const target = await createUser();
    await createApprovedAttempt(target.id, "shared-hash");
    const pending = await createPendingUser();
    const attempt = await createReviewAttempt(pending.id, "shared-hash");

    expect((await approveAttemptAction(attempt.id, VALID_FIELDS)).ok).toBe(false);
    expect(await revokeVerificationAction(target.id, REASON)).toEqual({ ok: true });
    expect(await approveAttemptAction(attempt.id, VALID_FIELDS)).toEqual({ ok: true });
  });

  it("yönetici olmayan kullanıcı geri alamaz ve hiçbir şey değişmez", async () => {
    const actor = await loginAs("USER");
    const target = await createUser();
    const attempt = await createApprovedAttempt(target.id);

    const result = await revokeVerificationAction(target.id, REASON);

    expect(result).toEqual({ ok: false, error: "Bu işlem için yönetici yetkin yok." });
    const user = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.verificationStatus).toBe("VERIFIED");
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("APPROVED");
    expect(await db.adminAuditLog.count({ where: { adminId: actor.id } })).toBe(0);
    expect(await verificationNotices(target.id)).toBe(0);
  });

  it("yönetici kendi doğrulamasını geri alamaz", async () => {
    const admin = await loginAs("ADMIN");
    const attempt = await createApprovedAttempt(admin.id);

    const result = await revokeVerificationAction(admin.id, REASON);

    expect(result).toEqual({ ok: false, error: "Kendi doğrulamanı geri alamazsın." });
    const self = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(self.verificationStatus).toBe("VERIFIED");
    const row = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("APPROVED");
    expect(await db.adminAuditLog.count()).toBe(0);
  });

  it("doğrulanmamış kullanıcıda hata döner, denetim kaydı ve bildirim yazılmaz", async () => {
    await loginAs("ADMIN");
    const pending = await createPendingUser();

    const result = await revokeVerificationAction(pending.id, REASON);

    expect(result).toEqual({ ok: false, error: "Bu kullanıcı doğrulanmış durumda değil." });
    const user = await db.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(user.verificationStatus).toBe("MANUAL_REVIEW");
    expect(await db.adminAuditLog.count()).toBe(0);
    expect(await verificationNotices(pending.id)).toBe(0);
  });

  it("on karakterden kısa gerekçede alan hatası döner ve kullanıcı doğrulanmış kalır", async () => {
    await loginAs("ADMIN");
    const target = await createUser();

    const result = await revokeVerificationAction(target.id, "kısa");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.reason).toBe("Gerekçe en az 10 karakter olmalı.");
    const user = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.verificationStatus).toBe("VERIFIED");
    expect(await db.adminAuditLog.count()).toBe(0);
  });

  it("bilinmeyen kullanıcıda hata döner", async () => {
    await loginAs("ADMIN");

    const result = await revokeVerificationAction("yok-boyle-biri", REASON);

    expect(result).toEqual({ ok: false, error: "Kullanıcı bulunamadı." });
    expect(await db.adminAuditLog.count()).toBe(0);
  });
});

describe("adminCloseProjectAction", () => {
  it("açık projeyi kapatır ve denetim kaydı yazar", async () => {
    const admin = await loginAs("ADMIN");
    const owner = await createUser();
    const project = await createProject(owner.id);

    expect(await adminCloseProjectAction(project.id)).toEqual({ ok: true });

    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.status).toBe("CLOSED");
    const audit = await db.adminAuditLog.findMany({ where: { action: "CLOSE_PROJECT" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ adminId: admin.id, targetId: project.id });
  });

  it("zaten kapalı projede hata döner ve denetim kaydı yazmaz", async () => {
    await loginAs("ADMIN");
    const owner = await createUser();
    const project = await createProject(owner.id, "CLOSED");

    const result = await adminCloseProjectAction(project.id);

    expect(result).toEqual({ ok: false, error: "Bu proje zaten kapalı." });
    expect(await db.adminAuditLog.count({ where: { action: "CLOSE_PROJECT" } })).toBe(0);
  });

  it("yönetici olmayan kullanıcı projeyi kapatamaz", async () => {
    const actor = await loginAs("USER");
    const owner = await createUser();
    const project = await createProject(owner.id);

    const result = await adminCloseProjectAction(project.id);

    expect(result).toEqual({ ok: false, error: "Bu işlem için yönetici yetkin yok." });
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.status).toBe("OPEN");
    expect(await db.adminAuditLog.count({ where: { adminId: actor.id } })).toBe(0);
  });

  it("bilinmeyen projede hata döner", async () => {
    await loginAs("ADMIN");

    expect(await adminCloseProjectAction("yok-boyle-proje")).toEqual({ ok: false, error: "Proje bulunamadı." });
    expect(await db.adminAuditLog.count()).toBe(0);
  });
});
