"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

// Bildirim eylemleri. Bu dosya yalnız async dışa aktarım içerir ('use server' kuralı).

/** Oturum açık kullanıcının okunmamış tüm bildirimlerini okundu yapar. */
export async function markAllReadAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Bu işlem için giriş yapman gerekiyor.");

  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  // Üst bardaki bildirim rozeti de düz sayfa yenilemesiyle güncellensin diye düzen de geçersiz kılınır.
  revalidatePath("/", "layout");
  return ok();
}
