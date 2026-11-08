"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ActionResult } from "@/lib/action-result";
import { grantAiConsentAction, withdrawAiConsentAction } from "@/lib/settings/actions";

/**
 * Açık rıza durumu ve işlemleri. Rıza isteğe bağlıdır; reddetmek hizmet kullanımını etkilemez.
 * Rıza geri alındığında sonraki belgeler yapay zeka yerine manuel incelemeye gider.
 */
export function AiConsentPanel({ active }: { active: boolean }) {
  return active ? <ActiveConsent /> : <InactiveConsent />;
}

function ActiveConsent() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    withdrawAiConsentAction,
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="t-body text-ink">Yapay zeka ile hızlı belge incelemesine rıza verdin.</p>
      <p className="t-meta text-ink-3">
        Rızanı geri alırsan sonraki belgelerin ekibimiz tarafından incelenir. Daha önce tamamlanan
        doğrulaman değişmez.
      </p>
      <form action={action} noValidate>
        <Button type="submit" variant="secondary" loading={pending}>
          Açık rızamı geri al
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="t-meta text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="t-meta text-ok">
          Açık rızan geri alındı.
        </p>
      ) : null}
    </div>
  );
}

function InactiveConsent() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(grantAiConsentAction, null);
  const error = state && !state.ok ? (state.fieldErrors?.aiConsent ?? state.error) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="t-body text-ink">Yapay zeka ile hızlı belge incelemesine rıza vermedin.</p>
      <p className="t-meta text-ink-3">
        Rıza verirsen belgenden yalnızca maskelenmiş metin, yurt dışındaki bir yapay zeka sağlayıcısına
        gönderilir. Rıza vermezsen belgen ekibimiz tarafından en geç 24 saat içinde incelenir.
      </p>
      <div>
        <ButtonLink href="/kvkk/acik-riza" variant="secondary">
          Rıza ver
        </ButtonLink>
      </div>
      <form action={action} noValidate className="flex flex-col gap-3">
        <Checkbox
          name="aiConsent"
          label="Maskelenmiş belge metnimin yapay zeka incelemesi için yurt dışına (DeepSeek, Çin Halk Cumhuriyeti) aktarılmasına açık rıza veriyorum."
          description="Rıza isteğe bağlıdır ve hizmet şartı değildir."
        />
        {error ? (
          <p role="alert" className="t-meta text-danger">
            {error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="t-meta text-ok">
            Rızan kaydedildi.
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            Rızamı kaydet
          </Button>
        </div>
      </form>
      <p className="t-meta text-ink-3">
        Rızanı istediğin zaman bu sayfadan geri alabilirsin.{" "}
        <Link href="/kvkk/aydinlatma" className="text-pen underline underline-offset-2">
          Aydınlatma metni
        </Link>
      </p>
    </div>
  );
}
