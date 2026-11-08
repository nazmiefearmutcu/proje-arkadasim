"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Grup düzenlerinde ((app)/layout, (auth)/layout) oluşan beklenmeyen hatalar için. Kök düzen (yazı tipi,
 * temalar) kalır; kabuk çizilemediği için sayfa not-found gibi ortalanmış dar kolondur.
 * `router.refresh()` sayfayı sunucudan yeniden ister, `reset()` sınırı temizler.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-4 py-10">
      <EmptyState
        title="Sayfa yüklenemedi"
        text="Bağlantını kontrol edip yeniden dene. Sorun sürerse ana sayfaya dön."
        action={
          <div className="flex flex-wrap justify-center gap-2">
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
            <ButtonLink href="/" variant="secondary">
              Ana sayfaya dön
            </ButtonLink>
          </div>
        }
      />
    </main>
  );
}
