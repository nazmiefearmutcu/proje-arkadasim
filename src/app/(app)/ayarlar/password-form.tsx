"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { changePasswordAction } from "@/lib/settings/actions";

/** Şifre değişimi. Alanlar kontrollü: hata olduğunda girilenler silinmez, başarıda temizlenir. */
export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordRepeat("");
    }
  }, [state]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="currentPassword" label="Mevcut şifre" error={errors.currentPassword}>
        <Input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </Field>
      <Field
        id="newPassword"
        label="Yeni şifre"
        hint="En az 10 karakter, bir harf ve bir rakam içermeli."
        error={errors.newPassword}
      >
        <Input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>
      <Field id="newPasswordRepeat" label="Yeni şifre (tekrar)" error={errors.newPasswordRepeat}>
        <Input
          name="newPasswordRepeat"
          type="password"
          autoComplete="new-password"
          value={newPasswordRepeat}
          onChange={(event) => setNewPasswordRepeat(event.target.value)}
        />
      </Field>

      <p className="t-meta text-ink-3">
        Şifreni değiştirdiğinde bu cihaz hariç diğer tüm oturumlar kapanır.
      </p>

      {state?.ok ? (
        <p role="status" className="t-meta text-ok">
          Şifren değiştirildi.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="t-meta text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Şifreni değiştir
        </Button>
      </div>
    </form>
  );
}
