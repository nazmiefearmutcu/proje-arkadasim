"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACADEMIC_STATUSES, DEGREE_LEVELS } from "@/config/taxonomy";
import { approveAttemptAction, rejectAttemptAction } from "@/lib/admin/actions";
import type { EducationFieldsInput } from "@/lib/admin/actions";

export interface ReviewDefaults {
  university: string;
  faculty: string;
  department: string;
  academicStatus: string;
  degreeLevel: string;
  classYear: string;
  graduationYear: string;
}

const MIN_REASON_LENGTH = 10;

/**
 * İnceleme formu: çıkarılan eğitim alanları düzenlenebilir. "Onayla" profili yazar; "Reddet" gerekçeyi
 * kullanıcıya gösterir. İkisi de sonrasında sayfayı yeniler, kayıt listeden kalkar.
 */
export function ReviewForm({ attemptId, defaults }: { attemptId: string; defaults: ReviewDefaults }) {
  const router = useRouter();
  const [values, setValues] = useState<ReviewDefaults>(defaults);
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const idFor = (name: string) => `${attemptId}-${name}`;
  const errorFor = (name: string) => fieldErrors[name];

  function update<K extends keyof ReviewDefaults>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function approve() {
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      const payload: EducationFieldsInput = { ...values };
      const result = await approveAttemptAction(attemptId, payload);
      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    setFormError(null);
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setFieldErrors({ reason: `Gerekçe en az ${MIN_REASON_LENGTH} karakter olmalı.` });
      return;
    }
    setFieldErrors({});
    startTransition(async () => {
      const result = await rejectAttemptAction(attemptId, trimmed);
      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      // Enter tuşu formu gönderip onaylamasın: onay yalnızca "Onayla" düğmesiyle yapılır.
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={idFor("university")} label="Üniversite" error={errorFor("university")}>
          <Input
            name="university"
            value={values.university}
            onChange={(event) => update("university", event.target.value)}
          />
        </Field>
        <Field id={idFor("faculty")} label="Fakülte" error={errorFor("faculty")}>
          <Input name="faculty" value={values.faculty} onChange={(event) => update("faculty", event.target.value)} />
        </Field>
        <Field id={idFor("department")} label="Bölüm" error={errorFor("department")}>
          <Input
            name="department"
            value={values.department}
            onChange={(event) => update("department", event.target.value)}
          />
        </Field>
        <Field id={idFor("academicStatus")} label="Durum" error={errorFor("academicStatus")}>
          <Select
            name="academicStatus"
            value={values.academicStatus}
            onChange={(event) => update("academicStatus", event.target.value)}
          >
            <option value="">Seç</option>
            {ACADEMIC_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={idFor("degreeLevel")} label="Öğrenim düzeyi" error={errorFor("degreeLevel")}>
          <Select
            name="degreeLevel"
            value={values.degreeLevel}
            onChange={(event) => update("degreeLevel", event.target.value)}
          >
            <option value="">Belirtilmemiş</option>
            {DEGREE_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={idFor("classYear")} label="Sınıf" error={errorFor("classYear")}>
          <Input
            name="classYear"
            inputMode="numeric"
            value={values.classYear}
            onChange={(event) => update("classYear", event.target.value)}
          />
        </Field>
        <Field id={idFor("graduationYear")} label="Mezuniyet yılı" error={errorFor("graduationYear")}>
          <Input
            name="graduationYear"
            inputMode="numeric"
            value={values.graduationYear}
            onChange={(event) => update("graduationYear", event.target.value)}
          />
        </Field>
      </div>

      <Field id={idFor("reason")} label="Red gerekçesi" hint="Reddedersen kullanıcı bu metni görür." error={errorFor("reason")}>
        <Textarea
          name="reason"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      {formError ? (
        <p role="alert" className="t-meta text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" loading={pending} onClick={approve}>
          Onayla
        </Button>
        <Button variant="danger" disabled={pending} onClick={reject}>
          Reddet
        </Button>
      </div>
    </form>
  );
}
