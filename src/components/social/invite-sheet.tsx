"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { inviteToProjectAction } from "@/lib/projects/actions";
import type { OpenProjectForInvite } from "@/lib/projects/queries";

export interface InviteSheetProps {
  open: boolean;
  onClose: () => void;
  /** Davet edilecek kişinin kullanıcı adı (gizli alan olarak gönderilir). */
  username: string;
  /** Görüntüleyen kişinin adı; başlık metninde kullanılır. */
  name: string;
  /** Görüntüleyenin açık projeleri. Boşsa panel açılmamalıdır. */
  projects: OpenProjectForInvite[];
}

/** Projeye davet paneli: proje, rol ve mesaj. Davet sunucuda `inviteToProjectAction` ile doğrulanır. */
export function InviteSheet({ open, onClose, username, name, projects }: InviteSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Projeye davet et">
      {open ? <InviteForm username={username} name={name} projects={projects} onClose={onClose} /> : null}
    </Sheet>
  );
}

function InviteForm({
  username,
  name,
  projects,
  onClose,
}: {
  username: string;
  name: string;
  projects: OpenProjectForInvite[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(inviteToProjectAction, null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [roleId, setRoleId] = useState("");
  const [message, setMessage] = useState("");
  const project = projects.find((candidate) => candidate.id === projectId) ?? projects[0];

  // Alanlar denetimlidir ve eylem `onSubmit` ile başlatılır: `<form action>` React 19'da her eylemden
  // sonra formu sıfırlar (denetimli `select` bile ilk seçeneğe döner). Sunucu reddinde (bekleyen davet,
  // oturum süresi) proje, rol ve yazılan mesaj korunur. Başarıda form kapanır, durum panelle birlikte gider.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 px-2 pt-2 pb-2">
        <p role="status" className="rounded-control bg-ok-soft p-3 t-body text-ok">
          Davet gönderildi. {name} bildirimlerinde görecek.
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
      <input type="hidden" name="username" value={username} readOnly />
      <p className="t-body text-ink-2">{name} için proje ve rol seç.</p>
      {formError ? (
        <p role="alert" className="t-body text-danger">
          {formError}
        </p>
      ) : null}
      {fieldErrors.username ? <p className="t-meta text-danger">{fieldErrors.username}</p> : null}
      <Field id="invite-project" label="Proje" error={fieldErrors.projectId}>
        <Select
          name="projectId"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setRoleId("");
          }}
        >
          {projects.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="invite-role" label="Rol" error={fieldErrors.roleId}>
        <Select name="roleId" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
          <option value="">Rol fark etmez</option>
          {(project?.roles ?? []).map((role) => (
            <option key={role.id} value={role.id} disabled={role.openSlots === 0}>
              {role.openSlots === 0 ? `${role.title} (dolu)` : role.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="invite-message" label="Mesaj" hint="İsteğe bağlı, en fazla 500 karakter." error={fieldErrors.message}>
        <Textarea
          name="message"
          rows={3}
          maxLength={500}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>
      <Button type="submit" loading={isPending}>
        Davet gönder
      </Button>
    </form>
  );
}
