"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { isBlockedEitherWay } from "@/lib/permissions";

// Takip eylemleri. Bu dosya yalnız async dışa aktarım içerir ('use server' kuralı).
// Sorgular follow-queries.ts içindedir.

const NOT_VERIFIED = "Bu işlem için belgeni doğrulaman gerekiyor.";
const NOT_FOUND = "Kişi bulunamadı.";

/** Doğrulanmış oturum sahibi. Değilse null. */
async function verifiedViewer(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.verificationStatus !== "VERIFIED") return null;
  return user;
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function revalidateFollowPaths(username: string | null): void {
  revalidatePath("/");
  revalidatePath("/network");
  if (username) revalidatePath(`/u/${username}`);
}

/**
 * Kişiyi takip eder. Hedef doğrulanmış olmalı; kendisi ya da engel ilişkisi olan biri takip edilemez.
 * FOLLOW bildirimi yalnız takip ilişkisi yeni oluştuğunda gider.
 */
export async function followUserAction(targetUserId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (!isValidId(targetUserId)) return fail(NOT_FOUND);
  if (targetUserId === viewer.id) return fail("Kendini takip edemezsin.");

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, username: true, verificationStatus: true },
  });
  if (!target) return fail(NOT_FOUND);
  if (target.verificationStatus !== "VERIFIED") {
    return fail("Yalnızca doğrulanmış kullanıcılar takip edilebilir.");
  }
  if (await isBlockedEitherWay(viewer.id, target.id)) return fail("Bu kişiyi takip edemezsin.");

  const existing = await db.follow.findUnique({
    where: { followerId_followingId: { followerId: viewer.id, followingId: target.id } },
    select: { followerId: true },
  });

  if (!existing) {
    try {
      await db.follow.create({ data: { followerId: viewer.id, followingId: target.id } });
      await notify({ userId: target.id, actorId: viewer.id, type: "FOLLOW" });
    } catch (error) {
      // Aynı anda iki istek geldiyse ikincisi benzersizlik hatasına düşer: takip zaten var.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }

  revalidateFollowPaths(target.username);
  return ok();
}

/** Takibi bırakır. Takip yoksa sessizce başarılı döner. */
export async function unfollowUserAction(targetUserId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (!isValidId(targetUserId)) return fail(NOT_FOUND);

  await db.follow.deleteMany({ where: { followerId: viewer.id, followingId: targetUserId } });

  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { username: true } });
  revalidateFollowPaths(target?.username ?? null);
  return ok();
}
