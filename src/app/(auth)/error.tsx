"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Kimlik sayfalarındaki (giriş, kayıt, şifre sıfırlama) beklenmeyen hatalar için. Sade kabuk (marka
 * bağlantısı) kalır. `router.refresh()` sayfayı sunucudan yeniden ister, `reset()` sınırı temizler.
 */
export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <EmptyState
      title="Sayfa yüklenemedi"
      text="Bağlantını kontrol edip yeniden dene. Sorun sürerse sayfayı yenile."
      action={
        <Button
          loading={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Yeniden dene
        </Button>
      }
    />
  );
}
