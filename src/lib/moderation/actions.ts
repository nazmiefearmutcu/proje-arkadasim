"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { REMOVAL_REASONS } from "./reasons";
import type { RemovalReason } from "./reasons";
import { notifyFollowersOfNewProject } from "./review";

// Editörün ilan kararları (spec 2026-11-27 §3). Yalnız editör çağırabilir. Her karar denetim kaydına
// yazılır; aynı karar iki kez basılırsa bir kez işlenir.

const NOT_EDITOR = "Bu işlem için editör yetkin yok.";
const NOT_FOUND = "İlan bulunamadı. Başka bir editör işlemi yapmış olabilir; sayfayı yenile.";

const RemoveSchema = z.object({
  projectId: z.string().min(1).max(64),
  reason: z.enum(Object.keys(REMOVAL_REASONS) as [RemovalReason, ...RemovalReason[]], {
    message: "Kaldırma nedenini seç.",
  }),
  note: z
    .string()
    .trim()
    .max(300, { message: "Not en fazla 300 karakter olabilir." })
    .transform((value) => (value.length > 0 ? value : null)),
});

async function currentEditor() {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

function revalidateModeration(projectId: string): void {
  revalidatePath("/editor");
  revalidatePath("/editor/icerik");
  revalidatePath("/projeler");
  revalidatePath(`/projeler/${projectId}`);
  revalidatePath("/");
}

/**
 * İlanı onaylar: yayına alır, denetim zamanını yazar, ilana ait açık şikayetleri çözer. Bekleyen ilan
 * yayına girdiyse sahibine "yayında" bildirimi, takipçilerine yeni ilan bildirimi gider.
 */
export async function approveProjectAction(projectId: string): Promise<ActionResult> {
  const editor = await currentEditor();
  if (!editor) return fail(NOT_EDITOR);
  if (typeof projectId !== "string" || projectId.length === 0 || projectId.length > 64) return fail(NOT_FOUND);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, moderationStatus: true },
  });
  if (!project) return fail(NOT_FOUND);

  const now = new Date();
  const wasPending = await db.$transaction(async (tx) => {
    const published = await tx.project.updateMany({
      where: { id: project.id, moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED", moderatedAt: now, moderatedById: editor.id },
    });
    if (published.count === 0) {
      // Zaten yayında (ör. şikayet edilen ilan): yalnız denetim zamanı yenilenir.
      await tx.project.update({ where: { id: project.id }, data: { moderatedAt: now, moderatedById: editor.id } });
    }
    await tx.report.updateMany({
      where: { targetType: "PROJECT", targetId: project.id, status: "OPEN" },
      data: { status: "RESOLVED" },
    });
    await tx.adminAuditLog.create({
      data: { adminId: editor.id, action: "APPROVE_PROJECT", targetUserId: project.ownerId, targetId: project.id },
    });
    return published.count > 0;
  });

  if (wasPending) {
    await notify({ userId: project.ownerId, type: "PROJECT_APPROVED", projectId: project.id });
    await notifyFollowersOfNewProject(project.ownerId, project.id);
  }

  revalidateModeration(project.id);
  return ok();
}

/**
 * İlanı gerekçeyle siler. Bağlı roller, üyelikler, başvurular ve davetler birlikte silinir; açık
 * şikayetler çözülür. Sahibine başlık ve gerekçeyle bildirim gider.
 */
export async function removeProjectAction(input: { projectId: string; reason: string; note: string }): Promise<ActionResult> {
  const editor = await currentEditor();
  if (!editor) return fail(NOT_EDITOR);

  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Bilgileri kontrol et.";
    return fail(message, { reason: message });
  }
  const { projectId, reason, note } = parsed.data;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, title: true },
  });
  if (!project) return fail(NOT_FOUND);

  const deleted = await db.$transaction(async (tx) => {
    const result = await tx.project.deleteMany({ where: { id: project.id } });
    if (result.count === 0) return false;
    await tx.report.updateMany({
      where: { targetType: "PROJECT", targetId: project.id, status: "OPEN" },
      data: { status: "RESOLVED" },
    });
    await tx.adminAuditLog.create({
      data: { adminId: editor.id, action: `DELETE_PROJECT:${reason}`, targetUserId: project.ownerId, targetId: project.id },
    });
    return true;
  });
  if (!deleted) return fail(NOT_FOUND);

  const label = REMOVAL_REASONS[reason];
  await notify({
    userId: project.ownerId,
    type: "PROJECT_REMOVED",
    data: { title: project.title, reason: note ? `${label}. ${note}` : label },
  });

  revalidateModeration(project.id);
  return ok();
}
