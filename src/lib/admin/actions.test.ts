import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import {
  approveAttemptAction,
  purgeMaskedTextAction,
  rejectAttemptAction,
  resolveReportAction,
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

async function createPendingUser() {
  return createUser({
    verificationStatus: "MANUAL_REVIEW",
    verifiedAt: null,
    academicStatus: null,
    university: null,
    department: null,
    disciplineGroup: null,
  });
}

async function createReviewAttempt(userId: string) {
  return db.verificationAttempt.create({
    data: {
      userId,
      status: "MANUAL_REVIEW",
      source: "PDF_TEXT",
      docHash: `hash-${Math.random().toString(36).slice(2)}`,
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
