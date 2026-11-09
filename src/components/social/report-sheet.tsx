"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { reportAction } from "@/lib/social/moderation";
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportTargetType } from "@/lib/social/report-reasons";

export interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Kısa ad, örn. kişinin adı ya da "Proje". Açıklama metninde kullanılır. */
  subject: string;
}

/** Şikayet paneli. Form her açılışta yeniden kurulur. */
export function ReportSheet({ open, onClose, targetType, targetId, subject }: ReportSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Şikayet et">
      {open ? <ReportForm targetType={targetType} targetId={targetId} subject={subject} onClose={onClose} /> : null}
    </Sheet>
  );
}

interface ReportFormProps {
  targetType: ReportTargetType;
  targetId: string;
  subject: string;
  onClose: () => void;
}

function ReportForm({ targetType, targetId, subject, onClose }: ReportFormProps) {
  const [state, formAction, isPending] = useActionState(reportAction, null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  // Alanlar denetimlidir ve eylem `onSubmit` ile başlatılır: `<form action>` React 19'da her eylemden
  // sonra formu sıfırlar (denetimli `select` bile ilk seçeneğe döner). Sunucu reddinde seçilen neden ve
  // açıklama korunur. Başarıda form kapanır, durum panelle birlikte gider.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 px-2 pt-2 pb-2">
        <p role="status" className="rounded-control bg-ok-soft p-3 t-body text-ok">
          {state.data ?? "Şikayetin alındı."}
        </p>
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      </div>
    );
  }

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4 px-2 pt-2 pb-2">
      <input type="hidden" name="targetType" value={targetType} readOnly />
      <input type="hidden" name="targetId" value={targetId} readOnly />
      <p className="t-body text-ink-2">{subject} için bir neden seç. Şikayetin ekibimiz tarafından incelenir.</p>
      {formError ? (
        <p role="alert" className="t-body text-danger">
          {formError}
        </p>
      ) : null}
      <Field id="report-reason" label="Neden" error={fieldErrors.reason}>
        <Select name="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="" disabled>
            Bir neden seç
          </option>
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="report-details"
        label="Açıklama"
        hint={`İsteğe bağlı, en fazla ${REPORT_DETAILS_MAX} karakter.`}
        error={fieldErrors.details}
      >
        <Textarea
          name="details"
          rows={3}
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </Field>
      <p className="t-meta text-ink-3">
        {details.length}/{REPORT_DETAILS_MAX}
      </p>
      <Button type="submit" loading={isPending}>
        Şikayeti gönder
      </Button>
    </form>
  );
}
