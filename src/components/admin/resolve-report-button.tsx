"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolveReportAction } from "@/lib/admin/actions";

/** Şikayeti çözüldü olarak işaretler; başarıda sayfa yenilenir ve kayıt açık listeden çıkar. */
export function ResolveReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveReportAction(reportId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" loading={pending} onClick={resolve} className="self-start">
        Çözüldü olarak işaretle
      </Button>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
