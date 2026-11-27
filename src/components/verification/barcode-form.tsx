"use client";

import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { verifyBarcodeAction } from "@/lib/verification/edevlet/actions";
import type { BarcodeFormState } from "@/lib/verification/edevlet/actions";

/**
 * e-Devlet barkoduyla anında doğrulama (spec 2026-11-27 §4). Barkod ve T.C. kimlik no girilir; sonuç
 * aynı istekte döner. Onay ya da editör incelemesi sonucunda sayfa yenilenir ve durum kartı güncellenir.
 */
export function BarcodeForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState<BarcodeFormState, FormData>(verifyBarcodeAction, null);

  useEffect(() => {
    if (state?.status === "APPROVED" || state?.status === "MANUAL_REVIEW") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        id="barkod"
        label="Barkod numarası"
        hint="Belgenin sağ alt köşesinde, karekodun yanında yazar."
        error={state?.fieldErrors?.barcode}
      >
        <Input
          name="barkod"
          defaultValue={state?.barcode ?? ""}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={60}
          required
          // Barkod ASCII'dir: Türkçe büyütme "i"yi "İ" gösterirdi.
          lang="en"
          className="font-mono tracking-wide uppercase"
        />
      </Field>
      <Field
        id="tckn"
        label="T.C. kimlik numarası"
        hint="e-Devlet belgeyi sorgulamak için ister. Yalnız bu sorguda kullanılır, saklanmaz."
        error={state?.fieldErrors?.tckn}
      >
        <Input
          name="tckn"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{11}"
          maxLength={11}
          required
          className="font-mono tracking-wide"
        />
      </Field>

      <SubmitButton disabled={disabled} className="self-start">
        e-Devlet&apos;te doğrula
      </SubmitButton>

      {/* Alan hatası varsa mesaj alanın altında durur; ayrıca tekrarlanmaz. */}
      {state && !state.fieldErrors ? <Result state={state} /> : null}
    </form>
  );
}

function Result({ state }: { state: NonNullable<BarcodeFormState> }) {
  if (state.status === "APPROVED") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-card bg-stamp-soft p-4 t-body text-ink">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-stamp" />
        {state.message}
      </p>
    );
  }
  if (state.status === "MANUAL_REVIEW") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-card bg-warn-soft p-4 t-body text-ink">
        <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn" />
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="flex items-start gap-2 rounded-card bg-danger-soft p-4 t-body text-ink">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
      {state.message}
    </p>
  );
}
