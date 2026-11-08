"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";
import { loginAction } from "@/lib/auth/login-action";
import type { ActionResult } from "@/lib/action-result";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/styles";
import { FormAlert } from "./form-alert";

export function LoginForm({ next = "" }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    loginAction,
    null,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const generalError = state && !state.ok && !state.fieldErrors ? state.error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const registerHref = next ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />

        {generalError ? <FormAlert tone="danger">{generalError}</FormAlert> : null}

        <Field id="login-email" label="E-posta" error={fieldErrors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <Field id="login-password" label="Şifre" error={fieldErrors.password}>
            <Input type="password" name="password" autoComplete="current-password" />
          </Field>
          <Link
            href="/sifremi-unuttum"
            className={`inline-flex min-h-11 items-center self-end rounded-control px-1 t-label text-pen ${focusRing}`}
          >
            Şifremi unuttum
          </Link>
        </div>

        <Button type="submit" loading={pending} className="w-full">
          Giriş yap
        </Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="t-meta text-ink-3">Hesabın yok mu?</p>
        <ButtonLink href={registerHref} variant="secondary" className="w-full">
          Hesap oluştur
        </ButtonLink>
      </div>
    </div>
  );
}
