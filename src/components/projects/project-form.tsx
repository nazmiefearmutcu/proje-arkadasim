"use client";

import { Minus, Plus, Trash2, X } from "lucide-react";
import { useActionState, useRef, useState, type KeyboardEvent } from "react";
import { CATEGORIES, CITIES, DISCIPLINE_GROUPS, STAGES, WORK_MODES, getDisciplineGroup } from "@/config/taxonomy";
import { zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { projectInputSchema } from "@/lib/projects/schemas";
import { DisciplineChip } from "@/components/common/discipline-chip";
import { DisciplineSpine } from "@/components/common/discipline-spine";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { focusRing } from "@/components/ui/styles";
import { Textarea } from "@/components/ui/textarea";

export interface ProjectFormRole {
  id?: string;
  title: string;
  disciplineGroup: string;
  slots: number;
  description: string;
}

export interface ProjectFormInitial {
  title: string;
  summary: string;
  description: string;
  category: string;
  stage: string;
  workMode: string;
  city: string | null;
  tags: string[];
  roles: ProjectFormRole[];
}

export type ProjectFormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface ProjectFormProps {
  action: ProjectFormAction;
  initial?: ProjectFormInitial;
  submitLabel: string;
  cancelHref?: string;
}

interface RoleDraft extends ProjectFormRole {
  key: number;
}

const MAX_ROLES = 6;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 30;

const EMPTY_INITIAL: ProjectFormInitial = {
  title: "",
  summary: "",
  description: "",
  category: "",
  stage: "FIKIR",
  workMode: "UZAKTAN",
  city: null,
  tags: [],
  roles: [{ title: "", disciplineGroup: "", slots: 1, description: "" }],
};

/** Şehir alanı yalnız yüz yüze ve hibrit çalışmada gösterilir ve zorunludur. */
function needsCity(workMode: string): boolean {
  return workMode === "YUZ_YUZE" || workMode === "HIBRIT";
}

/** Hata sözlüğünde tam anahtarı ya da o anahtarla başlayan ilk iç içe anahtarı bulur (ör. "tags" -> "tags.0"). */
function pickError(errors: Record<string, string>, key: string, nested: boolean): string | undefined {
  if (errors[key]) return errors[key];
  if (!nested) return undefined;
  const found = Object.keys(errors).find((name) => name.startsWith(`${key}.`));
  return found ? errors[found] : undefined;
}

/**
 * Proje paylaşma ve düzenleme formu. Sunucu ile aynı zod şeması istemcide de çalışır. İstemci hataları
 * ilk gönderimden sonra gösterilir; sunucu sonucundaki alan hataları her zaman gösterilir.
 */
export function ProjectForm({ action, initial = EMPTY_INITIAL, submitLabel, cancelHref }: ProjectFormProps) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(action, null);

  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [stage, setStage] = useState(initial.stage);
  const [workMode, setWorkMode] = useState(initial.workMode);
  const [city, setCity] = useState(initial.city ?? "");
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const nextKey = useRef(initial.roles.length);
  const [roles, setRoles] = useState<RoleDraft[]>(() => initial.roles.map((role, index) => ({ ...role, key: index })));

  const payload = {
    title,
    summary,
    description,
    category,
    stage,
    workMode,
    city: needsCity(workMode) && city ? city : null,
    tags,
    roles: roles.map((role) => ({
      ...(role.id ? { id: role.id } : {}),
      title: role.title,
      disciplineGroup: role.disciplineGroup,
      slots: role.slots,
      description: role.description,
    })),
  };

  const parsed = projectInputSchema.safeParse(payload);
  const clientErrors: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error);
  const serverErrors: Record<string, string> = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  /** Üst düzey alan hatası: önce sunucu, sonra (gönderimden sonra) istemci. */
  function errorFor(key: string, nested = true): string | undefined {
    const fromServer = pickError(serverErrors, key, nested);
    if (fromServer) return fromServer;
    return submitted ? pickError(clientErrors, key, nested) : undefined;
  }

  /** Rol alanı hatası: tam anahtar (ör. "roles.2.title"). */
  function roleErrorFor(index: number, field: string): string | undefined {
    const key = `roles.${index}.${field}`;
    return serverErrors[key] ?? (submitted ? clientErrors[key] : undefined);
  }

  const formError =
    state && !state.ok ? state.error : submitted && !parsed.success ? "Lütfen işaretli alanları düzelt." : null;

  function addTag(raw: string): void {
    const value = raw.trim();
    if (value.length < 2 || value.length > MAX_TAG_LENGTH) return;
    if (tags.length >= MAX_TAGS) return;
    const lowered = value.toLocaleLowerCase("tr-TR");
    if (tags.some((tag) => tag.toLocaleLowerCase("tr-TR") === lowered)) return;
    setTags([...tags, value]);
  }

  function onTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
  }

  function updateRole(key: number, patch: Partial<ProjectFormRole>): void {
    setRoles((current) => current.map((role) => (role.key === key ? { ...role, ...patch } : role)));
  }

  function addRole(): void {
    if (roles.length >= MAX_ROLES) return;
    nextKey.current += 1;
    setRoles([...roles, { key: nextKey.current, title: "", disciplineGroup: "", slots: 1, description: "" }]);
  }

  function removeRole(key: number): void {
    if (roles.length <= 1) return;
    setRoles(roles.filter((role) => role.key !== key));
  }

  const spineGroups = roles.map((role) => role.disciplineGroup).filter((id) => id.length > 0);

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(event) => {
        setSubmitted(true);
        if (!parsed.success) event.preventDefault();
      }}
      className="flex flex-col gap-2 pb-4"
    >
      <input type="hidden" name="payload" value={JSON.stringify(payload)} readOnly />

      <p className="t-body t-prose text-ink-2">
        Yalnızca proje paylaşılabilir. Ekip arkadaşı aradığın gerçek bir proje anlat.
      </p>

      {formError ? (
        <p role="alert" className="rounded-control bg-danger-soft p-3 t-body text-danger">
          {formError}
        </p>
      ) : null}

      <Section title="Temel bilgiler">
        <Field id="title" label="Başlık" hint="8 ile 80 karakter arası." error={errorFor("title")}>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} autoComplete="off" />
        </Field>
        <Field
          id="summary"
          label="Kısa özet"
          hint={`${summary.trim().length}/160 karakter. En az 20.`}
          error={errorFor("summary")}
        >
          <Textarea rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Field
          id="description"
          label="Açıklama"
          hint={`${description.trim().length}/4000 karakter. En az 80.`}
          error={errorFor("description")}
        >
          <Textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </Section>

      <Section title="Kategori ve aşama">
        <Field id="category" label="Kategori" error={errorFor("category")}>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Kategori seç</option>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="stage" label="Aşama" error={errorFor("stage")}>
          <Select value={stage} onChange={(event) => setStage(event.target.value)}>
            {STAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Çalışma şekli">
        <div role="group" aria-labelledby="work-mode-label" className="flex flex-col gap-2">
          <span id="work-mode-label" className="t-label text-ink">
            Nasıl çalışılacak
          </span>
          <div className="grid grid-cols-3 gap-2">
            {WORK_MODES.map((option) => {
              const selected = workMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setWorkMode(option.value)}
                  className={cn(
                    "min-h-11 rounded-control border px-2 t-label transition-colors",
                    selected ? "border-pen bg-pen-soft text-pen" : "border-line bg-surface text-ink-2",
                    focusRing,
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {errorFor("workMode") ? <p className="t-meta text-danger">{errorFor("workMode")}</p> : null}
        </div>
        {needsCity(workMode) ? (
          <Field id="city" label="Şehir" hint="Yüz yüze ve hibrit projelerde şehir zorunlu." error={errorFor("city")}>
            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Şehir seç</option>
              {CITIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </Section>

      <Section title="Etiketler">
        <Field
          id="tag-input"
          label="Etiket ekle"
          hint={`En fazla ${MAX_TAGS} etiket. Enter ile ekle (${tags.length}/${MAX_TAGS}).`}
          error={errorFor("tags")}
        >
          <Input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={onTagKeyDown}
            disabled={tags.length >= MAX_TAGS}
            maxLength={MAX_TAG_LENGTH}
            autoComplete="off"
          />
        </Field>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-chip bg-surface-2 py-1 pr-1 pl-3 t-label text-ink-2">
                  {tag}
                  <button
                    type="button"
                    aria-label={`${tag} etiketini kaldır`}
                    onClick={() => setTags(tags.filter((item) => item !== tag))}
                    className={cn("inline-flex size-8 items-center justify-center rounded-chip text-ink-3", focusRing)}
                  >
                    <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Aranan roller">
        <div className="flex flex-col gap-2">
          <p className="t-meta text-ink-3">Projenin aradığı disiplinler</p>
          <DisciplineSpine orientation="horizontal" groups={spineGroups} />
        </div>

        <div className="flex flex-col gap-3">
          {roles.map((role, index) => {
            const group = role.disciplineGroup ? getDisciplineGroup(role.disciplineGroup) : undefined;
            return (
              <div key={role.key} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="t-label text-ink">Rol {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRole(role.key)}
                    disabled={roles.length <= 1}
                    className={buttonClasses("ghost", "md", "h-11 px-3 text-danger disabled:opacity-40")}
                  >
                    <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    Rolü kaldır
                  </button>
                </div>

                <Field
                  id={`role-${role.key}-title`}
                  label="Rol adı"
                  hint="3 ile 60 karakter."
                  error={roleErrorFor(index, "title")}
                >
                  <Input
                    value={role.title}
                    onChange={(event) => updateRole(role.key, { title: event.target.value })}
                    autoComplete="off"
                  />
                </Field>

                <Field id={`role-${role.key}-discipline`} label="Disiplin" error={roleErrorFor(index, "disciplineGroup")}>
                  <Select
                    value={role.disciplineGroup}
                    onChange={(event) => updateRole(role.key, { disciplineGroup: event.target.value })}
                  >
                    <option value="">Disiplin seç</option>
                    {DISCIPLINE_GROUPS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {group ? <DisciplineChip id={group.id} selected /> : null}

                <div className="flex flex-col gap-1.5">
                  <span className="t-label text-ink">Kişi sayısı</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Kişi sayısını azalt"
                      onClick={() => updateRole(role.key, { slots: Math.max(1, role.slots - 1) })}
                      disabled={role.slots <= 1}
                      className={buttonClasses("secondary", "md", "size-11 px-0 disabled:opacity-40")}
                    >
                      <Minus aria-hidden="true" strokeWidth={1.75} className="size-5" />
                    </button>
                    <output aria-live="polite" className="t-card min-w-8 text-center text-ink">
                      {role.slots}
                    </output>
                    <button
                      type="button"
                      aria-label="Kişi sayısını artır"
                      onClick={() => updateRole(role.key, { slots: Math.min(5, role.slots + 1) })}
                      disabled={role.slots >= 5}
                      className={buttonClasses("secondary", "md", "size-11 px-0 disabled:opacity-40")}
                    >
                      <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
                    </button>
                  </div>
                  {roleErrorFor(index, "slots") ? (
                    <p className="t-meta text-danger">{roleErrorFor(index, "slots")}</p>
                  ) : null}
                </div>

                <Field
                  id={`role-${role.key}-description`}
                  label="Kısa açıklama"
                  hint={`${role.description.trim().length}/200 karakter. İsteğe bağlı.`}
                  error={roleErrorFor(index, "description")}
                >
                  <Input
                    value={role.description}
                    onChange={(event) => updateRole(role.key, { description: event.target.value })}
                    autoComplete="off"
                  />
                </Field>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={addRole} disabled={roles.length >= MAX_ROLES}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
            Rol ekle
          </Button>
          {roles.length >= MAX_ROLES ? <Chip>En fazla {MAX_ROLES} rol</Chip> : null}
        </div>
        {errorFor("roles", false) ? <p className="t-meta text-danger">{errorFor("roles", false)}</p> : null}
      </Section>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
        <Button type="submit" loading={isPending} className="flex-1 sm:flex-none">
          {submitLabel}
        </Button>
        {cancelHref ? (
          <ButtonLink href={cancelHref} variant="secondary">
            Vazgeç
          </ButtonLink>
        ) : null}
      </div>
    </form>
  );
}
