"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";

// Tanıştırma önerisini gizleme. Bu dosya yalnız async dışa aktarım içerir ('use server' kuralı).
// Öneri hesabı suggestions.ts içindedir.

const NOT_VERIFIED = "Bu işlem için belgeni doğrulaman gerekiyor.";

async function verifiedViewer(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.verificationStatus !== "VERIFIED") return null;
  return user;
}

/**
 * Öneriyi gizler. Satır yoksa gizli olarak oluşturulur; böylece aynı kişi bir daha önerilmez.
 */
export async function dismissIntroductionAction(candidateId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (typeof candidateId !== "string" || candidateId.length === 0 || candidateId.length > 64) {
    return fail("Kişi bulunamadı.");
  }
  if (candidateId === viewer.id) return fail("Bu öneri gizlenemez.");

  const candidate = await db.user.findUnique({ where: { id: candidateId }, select: { id: true } });
  if (!candidate) return fail("Kişi bulunamadı.");

  await db.introduction.upsert({
    where: { userId_suggestedUserId: { userId: viewer.id, suggestedUserId: candidateId } },
    update: { dismissed: true },
    create: { userId: viewer.id, suggestedUserId: candidateId, reason: "", dismissed: true },
  });

  revalidatePath("/network");
  return ok();
}
