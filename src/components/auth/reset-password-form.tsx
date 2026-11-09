"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";
import { resetPasswordAction } from "@/lib/auth/password-reset-action";
import type { ActionResult } from "@/lib/action-result";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/styles";
import { FormAlert } from "./form-alert";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  // Tek genel hata: jeton geçersiz, kullanılmış ya da süresi dolmuş. Bu durumda form yerine yeni istek bağlantısı gösterilir.
  const generalError = state && !state.ok && !state.fieldErrors ? state.error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex flex-col gap-5">
      {generalError ? (
        <>
          <FormAlert tone="danger">{generalError}</FormAlert>
          <ButtonLink href="/sifremi-unuttum" variant="secondary" className="w-full">
            Yeni bağlantı iste
          </ButtonLink>
        </>
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <input type="hidden" name="token" value={token} />

          <Field
            id="reset-password"
            label="Yeni şifre"
            hint="En az 10 karakter; bir harf ve bir rakam içermeli."
            error={fieldErrors.password}
          >
            <Input type="password" name="password" autoComplete="new-password" />
          </Field>

          <Field id="reset-password-repeat" label="Yeni şifre tekrar" error={fieldErrors.passwordRepeat}>
            <Input type="password" name="passwordRepeat" autoComplete="new-password" />
          </Field>

          <Button type="submit" loading={pending} className="w-full">
            Şifremi kaydet
          </Button>
          <Link
            href="/giris"
            className={`inline-flex min-h-11 items-center justify-center rounded-control t-label text-pen ${focusRing}`}
          >
            Giriş sayfasına dön
          </Link>
        </form>
      )}
    </div>
  );
}
