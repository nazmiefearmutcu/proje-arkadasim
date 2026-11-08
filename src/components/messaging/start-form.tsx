"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { startConversationAction } from "@/lib/messaging/actions";
import { MESSAGE_MAX_LENGTH } from "@/lib/messaging/types";

/** Yeni sohbetin ilk mesajı formu. Başarıda sunucu `/mesajlar/<id>` adresine yönlendirir. */
export function StartForm({ recipientUsername }: { recipientUsername: string }) {
  const [state, formAction, pending] = useActionState(startConversationAction, null);
  const bodyError = state && !state.ok ? (state.fieldErrors?.body ?? undefined) : undefined;
  const formError = state && !state.ok && !bodyError ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="kime" value={recipientUsername} />
      <Field id="mesaj-metni" label="Mesajın" error={bodyError} hint={`En fazla ${MESSAGE_MAX_LENGTH} karakter.`}>
        <Textarea name="body" required maxLength={MESSAGE_MAX_LENGTH} rows={5} placeholder="Kendini ve projeni kısaca anlat." />
      </Field>
      {formError ? (
        <p role="alert" className="t-meta text-danger">
          {formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          Gönder
        </Button>
      </div>
    </form>
  );
}
