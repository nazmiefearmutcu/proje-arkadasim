import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * Düğmeden çağrılan Server Action için küçük yardımcı. Başarısızlık mesajını tutar, bekleme
 * durumunu verir. Başarılı eylemlerin sayfa yenilemesini Server Action içindeki revalidatePath yapar.
 */
export function useRunAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult<unknown>>, onSuccess?: () => void): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  return { isPending, error, run };
}
