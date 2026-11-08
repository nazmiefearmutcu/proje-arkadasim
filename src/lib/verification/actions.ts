"use server";

import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasActiveConsent, recordConsent } from "@/lib/consent";

/**
 * Yapay zeka incelemesi için açık rıza kaydı (CROSS_BORDER_AI). Rıza isteğe bağlıdır; reddetmek
 * belgenin yerel manuel incelemeye alınmasına yol açar. Kayıt geri alınabilir (Ayarlar).
 */
export async function grantAiConsentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Oturumun süresi dolmuş. Tekrar giriş yap.");

  if (formData.get("onay") !== "on") {
    return fail("Devam etmek için onay kutusunu işaretle.", {
      onay: "Devam etmek için onay kutusunu işaretle.",
    });
  }

  if (await hasActiveConsent(user.id, "CROSS_BORDER_AI")) return ok();

  await recordConsent(user.id, "CROSS_BORDER_AI", true);
  revalidatePath("/dogrulama");
  return ok();
}
