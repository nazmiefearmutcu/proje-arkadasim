"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { requestPasswordResetAction } from "@/lib/auth/password-reset-action";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./form-alert";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    requestPasswordResetAction,
    null,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const generalError = state && !state.ok && !state.fieldErrors ? state.error : null;
  const sent = state?.ok === true;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex flex-col gap-5">
      {sent ? (
        <FormAlert tone="ok">Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderdik.</FormAlert>
      ) : null}
      {generalError ? <FormAlert tone="danger">{generalError}</FormAlert> : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field id="forgot-email" label="E-posta" hint="Hesabına bağlı e-posta adresini yaz." error={fieldErrors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          Bağlantı gönder
        </Button>
      </form>
    </div>
  );
}
