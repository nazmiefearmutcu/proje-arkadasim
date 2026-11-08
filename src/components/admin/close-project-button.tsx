"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { adminCloseProjectAction } from "@/lib/admin/actions";

/** Şikayet edilen açık projeyi kapatır; başarıda sayfa yenilenir ve düğme kalkar. */
export function CloseProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    if (!window.confirm("Proje kapatılacak ve keşifte görünmeyecek. Devam edilsin mi?")) return;
    startTransition(async () => {
      const result = await adminCloseProjectAction(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" loading={pending} onClick={close} className="self-start">
        Projeyi kapat
      </Button>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
