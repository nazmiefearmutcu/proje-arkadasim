"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Kabuklu sayfalardaki beklenmeyen hatalar için. Kabuk (üst bar, alt menü) kalır; yeniden deneme sunulur.
 * Yalnız `reset()` önbellekteki (hatayı içeren) sunucu yükünü yeniden çizer; bu yüzden önce
 * `router.refresh()` ile sayfa sunucudan yeniden istenir (ör. geçici "database is locked" hatası).
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
