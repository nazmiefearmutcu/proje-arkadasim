"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { revokeVerificationAction } from "@/lib/admin/actions";

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

/**
 * Şikayet edilen doğrulanmış hesabın doğrulamasını geri alır (spec §5.3). Gerekçe kullanıcıya doğrulama
 * sayfasında gösterilir. Başarıda sayfa yenilenir ve form kalkar.
 */
export function RevokeVerificationForm({ userId, username }: { userId: string; username: string }) {
  const router = useRouter();
  const id = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    setFormError(null);
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Gerekçe en az ${MIN_REASON_LENGTH} karakter olmalı.`);
      return;
    }
    setReasonError(null);
    if (!window.confirm(`@${username} hesabının doğrulaması geri alınacak. Devam edilsin mi?`)) return;

    startTransition(async () => {
      const result = await revokeVerificationAction(userId, trimmed);
      if (!result.ok) {
        const fieldError = result.fieldErrors?.reason ?? null;
        setReasonError(fieldError);
        setFormError(fieldError ? null : result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form method="post"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        revoke();
      }}
    >
      <Field
        id={`${id}-reason`}
        label="Geri alma gerekçesi"
        hint="Kullanıcı bu metni doğrulama sayfasında görür."
        error={reasonError ?? undefined}
      >
        <Textarea
          name="reason"
          maxLength={MAX_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {formError ? (
        <p role="alert" className="t-meta text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="danger" loading={pending} className="self-start">
        Doğrulamayı geri al
      </Button>
    </form>
  );
}
