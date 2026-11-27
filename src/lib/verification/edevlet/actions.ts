"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { verifyBarcode } from "./service";
import type { BarcodeOutcome } from "./service";

export type BarcodeFormState = (BarcodeOutcome & { barcode: string }) | null;

/**
 * e-Devlet barkoduyla doğrulama formu. T.C. kimlik no yalnız bu istek boyunca bellekte kalır; dönen
 * durumda yer almaz (form yeniden çizildiğinde alan boş gelir). Barkod, kullanıcı düzeltebilsin diye geri döner.
 */
export async function verifyBarcodeAction(_previous: BarcodeFormState, formData: FormData): Promise<BarcodeFormState> {
  const barcode = String(formData.get("barkod") ?? "").slice(0, 80);
  const tckn = String(formData.get("tckn") ?? "").slice(0, 20);

  const user = await getCurrentUser();
  if (!user) return { status: "ERROR", message: "Oturumun süresi dolmuş. Tekrar giriş yap.", barcode };

  const outcome = await verifyBarcode({ userId: user.id, barcode, tckn });
  if (outcome.status !== "ERROR") revalidatePath("/dogrulama");
  return { ...outcome, barcode };
}
