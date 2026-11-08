"use client";

import Link from "next/link";
import { useActionState } from "react";
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
          label={
            <>
              Belgemin maskelenmiş metninin yapay zeka incelemesi için yurt dışına gönderilmesine açık rıza
              veriyorum. Ayrıntılar için{" "}
              <Link href="/kvkk/acik-riza" className="text-pen underline underline-offset-2">
                açık rıza metnini
              </Link>{" "}
              oku.
            </>
          }
        />
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
