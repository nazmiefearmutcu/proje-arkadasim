"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACADEMIC_STATUSES, CITIES, DEGREE_LEVELS } from "@/config/taxonomy";
import type { ActionResult } from "@/lib/action-result";
import {
  BIO_MAX,
  CLASS_YEAR_MAX,
  DEPARTMENT_MAX,
  FACULTY_MAX,
  GRADUATION_YEAR_MIN,
  INTERESTS_MAX,
  SKILLS_MAX,
} from "@/lib/settings/limits";
import { updateProfileAction } from "@/lib/settings/actions";
import { ChipInput } from "./chip-input";

export interface ProfileFormProps {
  firstName: string;
  lastName: string;
  verified: boolean;
  academicStatus: string | null;
  university: string | null;
  bio: string;
  city: string;
  skills: string[];
  interests: string[];
  lookingForProject: boolean;
  faculty: string;
  department: string;
  degreeLevel: string;
  classYear: number | null;
  graduationYear: number | null;
}

const CLASS_YEARS = Array.from({ length: CLASS_YEAR_MAX }, (_, index) => index + 1);

// Belgeden gelen kurum ve durum bilgisi doğrulanmış hesapta yeniden belge yüklenerek
// değiştirilemez (/dogrulama doğrulanmış kullanıcıya yükleme alanı göstermez).
const DOCUMENT_FIELD_HINT = "Belgenden alındı; buradan değiştirilemez. Hatalıysa KVKK başvuru adresine yaz.";

/** Profil formu. Ad, soyad ve üniversite yalnız okunur; eğitim alanları yalnız doğrulanmış hesapta düzenlenir. */
export function ProfileForm(props: ProfileFormProps) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);

  // Denetimler kontrollü tutulur: form gönderildikten sonra React'in form sıfırlaması kayıtlı
  // değerleri eski başlangıç değerine geri döndürmez.
  const [bio, setBio] = useState(props.bio);
  const [city, setCity] = useState(props.city);
  const [lookingForProject, setLookingForProject] = useState(props.lookingForProject);
  const [faculty, setFaculty] = useState(props.faculty);
  const [department, setDepartment] = useState(props.department);
  const [degreeLevel, setDegreeLevel] = useState(props.degreeLevel);
  const [classYear, setClassYear] = useState(props.classYear === null ? "" : String(props.classYear));
  const [graduationYear, setGraduationYear] = useState(
    props.graduationYear === null ? "" : String(props.graduationYear),
  );

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const isGraduate = props.academicStatus === "GRADUATE";
  // Kayıtlı sınıf listede yoksa (ör. belgeden ya da yöneticiden gelen 10) yine seçenek olarak
  // gösterilir; böylece kayıt değişmeden geri gönderilir.
  const storedClassYearOutsideList =
    props.classYear !== null && !CLASS_YEARS.includes(props.classYear) ? props.classYear : null;
  const statusLabel = ACADEMIC_STATUSES.find((status) => status.value === props.academicStatus)?.label ?? "";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-3">
        <p className="t-meta text-ink-3">Ad ve soyad belgeyle eşleştiği için değiştirilemez.</p>
        <Field id="firstName" label="Ad">
          <Input id="firstName" value={props.firstName} readOnly aria-readonly="true" />
        </Field>
        <Field id="lastName" label="Soyad">
          <Input id="lastName" value={props.lastName} readOnly aria-readonly="true" />
        </Field>
      </div>

      <Field id="bio" label="Biyografi" hint={`${bio.length}/${BIO_MAX} karakter`} error={errors.bio}>
        <Textarea
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={BIO_MAX}
        />
      </Field>

      <Field id="city" label="Şehir" hint="İsteğe bağlı." error={errors.city}>
        <Select name="city" value={city} onChange={(event) => setCity(event.target.value)}>
          <option value="">Şehir seçme</option>
          {CITIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <ChipInput
        id="skills"
        name="skills"
        label="Beceriler"
        hint={`En fazla ${SKILLS_MAX}. Enter ile ekle.`}
        placeholder="ör. React, SQL"
        initial={props.skills}
        max={SKILLS_MAX}
        error={errors.skills}
      />

      <ChipInput
        id="interests"
        name="interests"
        label="İlgi alanları"
        hint={`En fazla ${INTERESTS_MAX}. Enter ile ekle.`}
        placeholder="ör. sürdürülebilirlik"
        initial={props.interests}
        max={INTERESTS_MAX}
        error={errors.interests}
      />

      <Switch
        name="lookingForProject"
        label="Proje arıyorum"
        description="Açıkken profilinde 'Proje arıyor' görünür ve tanıştırma önerilerinde öne çıkarsın."
        checked={lookingForProject}
        onChange={(event) => setLookingForProject(event.target.checked)}
      />

      {props.verified ? (
        <div className="flex flex-col gap-4 border-t border-line pt-5">
          <h3 className="t-section text-ink">Eğitim bilgileri</h3>

          <Field id="university" label="Üniversite" hint={DOCUMENT_FIELD_HINT}>
            <Input id="university" value={props.university ?? ""} readOnly aria-readonly="true" />
          </Field>

          <Field id="academicStatus" label="Durum" hint={DOCUMENT_FIELD_HINT}>
            <Input id="academicStatus" value={statusLabel} readOnly aria-readonly="true" />
          </Field>

          <Field id="faculty" label="Fakülte" error={errors.faculty}>
            <Input
              name="faculty"
              value={faculty}
              onChange={(event) => setFaculty(event.target.value)}
              maxLength={FACULTY_MAX}
            />
          </Field>

          <Field
            id="department"
            label="Bölüm"
            hint="Disiplin grubun bölümünden belirlenir."
            error={errors.department}
          >
            <Input
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              maxLength={DEPARTMENT_MAX}
            />
          </Field>

          <Field id="degreeLevel" label="Öğrenim düzeyi" error={errors.degreeLevel}>
            <Select
              name="degreeLevel"
              value={degreeLevel}
              onChange={(event) => setDegreeLevel(event.target.value)}
            >
              <option value="">Seçme</option>
              {DEGREE_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </Select>
          </Field>

          {isGraduate ? (
            <Field id="graduationYear" label="Mezuniyet yılı" hint="İsteğe bağlı." error={errors.graduationYear}>
              <Input
                name="graduationYear"
                type="number"
                inputMode="numeric"
                min={GRADUATION_YEAR_MIN}
                value={graduationYear}
                onChange={(event) => setGraduationYear(event.target.value)}
              />
            </Field>
          ) : (
            <Field id="classYear" label="Sınıf" hint="İsteğe bağlı." error={errors.classYear}>
              <Select name="classYear" value={classYear} onChange={(event) => setClassYear(event.target.value)}>
                <option value="">Belirtilmemiş</option>
                {CLASS_YEARS.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}. sınıf
                  </option>
                ))}
                {storedClassYearOutsideList !== null ? (
                  <option value={String(storedClassYearOutsideList)}>{storedClassYearOutsideList}. sınıf</option>
                ) : null}
              </Select>
            </Field>
          )}
        </div>
      ) : (
        <p className="t-meta text-ink-3">
          Eğitim bilgilerin belge doğrulamasından sonra burada görünür.{" "}
          <Link href="/dogrulama" className="text-pen underline underline-offset-2">
            Belgeni doğrula
          </Link>
        </p>
      )}

      {state?.ok ? (
        <p role="status" className="t-meta text-ok">
          Profilin kaydedildi.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="t-meta text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" loading={pending}>
          Profili kaydet
        </Button>
      </div>
    </form>
  );
}
