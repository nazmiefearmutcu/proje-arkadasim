import type { Metadata } from "next";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";

/** Yönetici olmayanlar 404 görür; sekme başlığı da yönetim alanının varlığını sızdırmamalı. */
export const ADMIN_HIDDEN_TITLE = "Sayfa bulunamadı";

export async function adminMetadata(title: string): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user && isAdmin(user) ? title : ADMIN_HIDDEN_TITLE };
}
