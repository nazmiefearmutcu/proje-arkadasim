"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { purgeMaskedTextAction } from "@/lib/admin/actions";

/** Süresi dolan maskeli metinleri temizler ve kaç satırın temizlendiğini gösterir. */
export function PurgeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await purgeMaskedTextAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const count = result.data?.count ?? 0;
      setMessage(
        count === 0
          ? "Süresi dolmuş maskeli metin yok."
          : `${count} belgenin süresi dolmuş maskeli metni temizlendi.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" loading={pending} onClick={run} className="self-start">
        Süresi dolan maskeli metinleri temizle
      </Button>
      {message ? (
        <p role="status" className="t-meta text-ink-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
