"use client";

import { useActionState } from "react";
import { AI_CONSENT_STATEMENT } from "@/config/legal";
import { AiConsentTextLink } from "@/components/legal/ai-consent-link";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { grantAiConsentAction } from "@/lib/verification/actions";

/** Hızlı inceleme için açık rıza formu. Rıza verilince sayfa sunucuda yenilenir ve panel kalkar. */
export function ConsentPanel() {
  const [state, action, pending] = useActionState(grantAiConsentAction, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="t-card text-ink">Hızlı inceleme</h2>
      <p className="t-body t-prose text-ink-2">
        Rıza vermezsen belgen ekibimiz tarafından en geç 24 saat içinde incelenir. Rıza verirsen
        belgenin yalnızca kişisel verileri çıkarılmış metni, yapay zeka incelemesi için yurt dışındaki
        bir servise gönderilir ve sonuç genellikle birkaç saniyede çıkar.
      </p>
      <form action={action} className="flex flex-col gap-2">
        <Checkbox
          name="onay"
          value="on"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "rıza-hata" : undefined}
          label={AI_CONSENT_STATEMENT}
        />
        <AiConsentTextLink />
        {error ? (
          <p id="rıza-hata" role="alert" className="t-meta text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={pending} className="self-start">
          Rızamı kaydet
        </Button>
      </form>
    </Card>
  );
}
