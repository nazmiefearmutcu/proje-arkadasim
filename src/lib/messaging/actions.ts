"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getCurrentUser, isVerified } from "@/lib/auth/guards";
import { acceptRequest, declineRequest, sendMessage, startConversation } from "./service";
import type { MessageDTO } from "./types";

const NOT_VERIFIED = "Bu işlem için belgeni doğrulaman gerekiyor.";
const NOT_SIGNED_IN = "Bu işlem için giriş yapmalısın.";

const startSchema = z.object({
  kime: z.string().trim().min(1, { message: "Alıcı bulunamadı." }).max(64),
  body: z.string().max(10_000),
});

const conversationIdSchema = z.string().min(1).max(64);

type VerifiedResult = { ok: true; userId: string } | { ok: false; error: string };

async function requireVerifiedUser(): Promise<VerifiedResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  if (!isVerified(user)) return { ok: false, error: NOT_VERIFIED };
  return { ok: true, userId: user.id };
}

/**
 * Yeni sohbet formu. Başarıda `/mesajlar/<id>` sayfasına yönlendirir; hata varsa formda gösterilir.
 * Yönlendirme istisna fırlattığı için bu fonksiyonda try/catch kullanılmaz.
 */
export async function startConversationAction(
  _previous: ActionResult<{ conversationId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ conversationId: string }>> {
  const session = await requireVerifiedUser();
  if (!session.ok) return fail(session.error);

  const parsed = startSchema.safeParse({
    kime: formData.get("kime") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return fail("Mesaj bilgileri eksik.", zodFieldErrors(parsed.error));

  const result = await startConversation(session.userId, parsed.data.kime, parsed.data.body);
  if (!result.ok || !result.data) {
    return fail(result.ok ? "Sohbet açılamadı. Tekrar dene." : result.error, result.ok ? undefined : result.fieldErrors);
  }

  revalidatePath("/mesajlar");
  redirect(`/mesajlar/${result.data.conversationId}`);
}

/** Açık sohbette mesaj gönderir. Başarıda yeni mesajın DTO'sunu döner. */
export async function sendMessageAction(conversationId: string, body: string): Promise<ActionResult<MessageDTO>> {
  const session = await requireVerifiedUser();
  if (!session.ok) return fail(session.error);

  const id = conversationIdSchema.safeParse(conversationId);
  if (!id.success) return fail("Sohbet bulunamadı.");

  return sendMessage(session.userId, id.data, body);
}

/** Gelen isteği kabul eder ve sohbeti aç. Başarıda listeleri yeniden çizer. */
export async function acceptRequestAction(conversationId: string): Promise<ActionResult> {
  const session = await requireVerifiedUser();
  if (!session.ok) return fail(session.error);

  const id = conversationIdSchema.safeParse(conversationId);
  if (!id.success) return fail("Sohbet bulunamadı.");

  const result = await acceptRequest(session.userId, id.data);
  if (!result.ok) return result;

  revalidatePath("/mesajlar");
  revalidatePath(`/mesajlar/${id.data}`);
  return ok();
}

/**
 * Gelen isteği reddeder. Başarıda istekler sekmesine yönlendirir; hata varsa sonucu döner.
 * Reddetme engelden bağımsız çalışır.
 */
export async function declineRequestAction(conversationId: string): Promise<ActionResult> {
  const session = await requireVerifiedUser();
  if (!session.ok) return fail(session.error);

  const id = conversationIdSchema.safeParse(conversationId);
  if (!id.success) return fail("Sohbet bulunamadı.");

  const result = await declineRequest(session.userId, id.data);
  if (!result.ok) return result;

  revalidatePath("/mesajlar");
  redirect("/mesajlar?sekme=istekler");
}
