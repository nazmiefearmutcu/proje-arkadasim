"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/** Kabuklu sayfalardaki beklenmeyen hatalar için. Kabuk (üst bar, alt menü) kalır; yeniden deneme sunulur. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      title="Sayfa yüklenemedi"
      text="Bağlantını kontrol edip yeniden dene. Sorun sürerse sayfayı yenile."
      action={<Button onClick={reset}>Yeniden dene</Button>}
    />
  );
}
