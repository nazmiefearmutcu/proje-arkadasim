"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { deleteAccountAction } from "@/lib/settings/actions";

/** Hesap silme. Şifre ve kullanıcı adının yazılması zorunlu; işlem geri alınamaz. */
export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deleteAccountAction, null);
  const [confirmation, setConfirmation] = useState("");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="deletePassword" label="Şifren" error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      <Field
        id="usernameConfirm"
        label="Kullanıcı adını yaz"
        hint={`Onaylamak için @${username} yaz.`}
        error={errors.usernameConfirm}
      >
        <Input
          name="usernameConfirm"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={username}
        />
      </Field>

      {state && !state.ok ? (
        <p role="alert" className="t-meta text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="danger" loading={pending}>
          Hesabımı kalıcı olarak sil
        </Button>
      </div>
    </form>
  );
}
