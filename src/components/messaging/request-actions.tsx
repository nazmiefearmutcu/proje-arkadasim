"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { acceptRequestAction, declineRequestAction } from "@/lib/messaging/actions";

export interface RequestActionsProps {
  conversationId: string;
  /** Kabul başarılı olunca çağrılır (sohbet ekranı durumu günceller). */
  onAccepted?: () => void;
}

/** Mesaj isteği için Kabul et / Reddet düğmeleri. Reddetme sonrası sunucu istekler sekmesine yönlendirir. */
export function RequestActions({ conversationId, onAccepted }: RequestActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await acceptRequestAction(conversationId);
      } catch {
        setError("İstek kabul edilemedi. Bağlantını kontrol edip tekrar dene.");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAccepted?.();
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      // Başarıda sunucu redirect() çağırır; istemci sonucu undefined olarak çözebilir. Bu yüzden sonucu yalnızca tanımlıysa oku.
      let result: ActionResult | undefined;
      try {
        result = await declineRequestAction(conversationId);
      } catch {
        setError("İstek reddedilemedi. Bağlantını kontrol edip tekrar dene.");
        return;
      }
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={accept} loading={pending}>
          Kabul et
        </Button>
        <Button type="button" variant="secondary" onClick={decline} disabled={pending}>
          Reddet
        </Button>
      </div>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
