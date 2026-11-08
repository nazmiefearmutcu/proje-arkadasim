"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  REPORT_DETAILS_MAX,
  REPORT_OK_MESSAGE,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
} from "./report-reasons";

// Engelleme ve şikayet eylemleri. Bu dosya yalnız async dışa aktarım içerir ('use server' kuralı).

const NOT_VERIFIED = "Bu işlem için belgeni doğrulaman gerekiyor.";
const NOT_FOUND = "Kişi bulunamadı.";

async function verifiedViewer(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.verificationStatus !== "VERIFIED") return null;
  return user;
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES, { error: "Geçersiz şikayet türü." }),
  targetId: z.string().min(1, { error: "Şikayet edilecek kayıt bulunamadı." }).max(64),
  reason: z.enum(REPORT_REASONS, { error: "Bir şikayet nedeni seç." }),
  details: z
    .string()
    .max(REPORT_DETAILS_MAX, { error: `Açıklama en fazla ${REPORT_DETAILS_MAX} karakter olabilir.` })
    .optional(),
});

/**
 * Engeller. Her iki yönde: takipler kalkar, bekleyen mesaj istekleri reddedilir, bekleyen davetler
 * iptal edilir. Engel satırı tek kez yazılır; tekrar çağrı zararsızdır.
 */
export async function blockUserAction(targetId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (!isValidId(targetId)) return fail(NOT_FOUND);
  if (targetId === viewer.id) return fail("Kendini engelleyemezsin.");

  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, username: true } });
  if (!target) return fail(NOT_FOUND);

  const now = new Date();
  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: target.id } },
      update: {},
      create: { blockerId: viewer.id, blockedId: target.id },
    }),
    db.follow.deleteMany({
      where: {
        OR: [
          { followerId: viewer.id, followingId: target.id },
          { followerId: target.id, followingId: viewer.id },
        ],
      },
    }),
    db.conversation.updateMany({
      where: {
        status: "REQUEST",
        OR: [
          { userAId: viewer.id, userBId: target.id },
          { userAId: target.id, userBId: viewer.id },
        ],
      },
      data: { status: "DECLINED" },
    }),
    db.projectInvite.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { inviterId: viewer.id, inviteeId: target.id },
          { inviterId: target.id, inviteeId: viewer.id },
        ],
      },
      data: { status: "CANCELLED", decidedAt: now },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/network");
  revalidatePath("/mesajlar");
  revalidatePath(`/u/${target.username}`);
  return ok();
}

/** Engeli kaldırır. Takipler ve davetler geri gelmez. */
export async function unblockUserAction(targetId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (!isValidId(targetId)) return fail(NOT_FOUND);

  await db.block.deleteMany({ where: { blockerId: viewer.id, blockedId: targetId } });

  const target = await db.user.findUnique({ where: { id: targetId }, select: { username: true } });
  revalidatePath("/");
  revalidatePath("/network");
  revalidatePath("/mesajlar");
  if (target) revalidatePath(`/u/${target.username}`);
  return ok();
}

type ReportState = ActionResult<string> | null;

/**
 * Kullanıcı, proje ya da mesajı şikayet eder. Kendini ya da var olmayan bir kaydı şikayet edemez.
 * Mesaj şikayetinde şikayet eden, mesajın sohbetinin tarafı olmalıdır. Hız sınırı kullanıcı başınadır.
 */
export async function reportAction(_prev: ReportState, formData: FormData): Promise<ActionResult<string>> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const limit = rateLimit(`report:${viewer.id}`, LIMITS.report[0], LIMITS.report[1]);
  if (!limit.ok) return fail("Çok fazla şikayet gönderdin. Bir süre sonra tekrar dene.");

  const rawDetails = formData.get("details");
  const details = typeof rawDetails === "string" ? rawDetails.trim() : "";
  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    details,
  });
  if (!parsed.success) return fail("Lütfen şikayet formunu kontrol et.", zodFieldErrors(parsed.error));
  const input = parsed.data;

  if (input.targetType === "USER") {
    if (input.targetId === viewer.id) return fail("Kendini şikayet edemezsin.");
    const user = await db.user.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!user) return fail("Şikayet edilecek kişi bulunamadı.");
  } else if (input.targetType === "PROJECT") {
    const project = await db.project.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!project) return fail("Şikayet edilecek proje bulunamadı.");
  } else {
    const message = await db.message.findUnique({
      where: { id: input.targetId },
      select: { conversation: { select: { userAId: true, userBId: true } } },
    });
    const isParticipant =
      message !== null &&
      (message.conversation.userAId === viewer.id || message.conversation.userBId === viewer.id);
    if (!isParticipant) return fail("Şikayet edilecek mesaj bulunamadı.");
  }

  await db.report.create({
    data: {
      reporterId: viewer.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: details.length > 0 ? details : null,
    },
  });

  return ok(REPORT_OK_MESSAGE);
}
