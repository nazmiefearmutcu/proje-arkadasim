"use client";

import { useActionState, useState } from "react";
import { applyToProjectAction, leaveProjectAction, withdrawApplicationAction } from "@/lib/projects/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "./use-run-action";

export interface ProjectActionRole {
  id: string;
  title: string;
  full: boolean;
}

export type ProjectViewerState = "guest" | "unverified" | "member" | "pending" | "open" | "closed";

export interface ProjectActionsProps {
  projectId: string;
  viewerState: ProjectViewerState;
  pendingRequestId: string | null;
  roles: ProjectActionRole[];
}

const MIN_MESSAGE = 20;

/**
 * Detayın alt eylem çubuğu (yalnız sahip dışındaki ziyaretçiler için). Mobilde alt menünün üstünde
 * yapışkan kalır. Hangi düğmenin görüneceği sunucuda hesaplanır.
 */
export function ProjectActions({ projectId, viewerState, pendingRequestId, roles }: ProjectActionsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isPending, error, run } = useRunAction();

  const loginHref = `/giris?next=${encodeURIComponent(`/projeler/${projectId}`)}`;

  return (
    <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3">
      {viewerState === "guest" ? (
        <>
          <p className="t-meta text-ink-2">Bu projeye katılmak için giriş yapman gerekiyor.</p>
          <ButtonLink href={loginHref}>Katılmak için giriş yap</ButtonLink>
        </>
      ) : null}

      {viewerState === "unverified" ? (
        <>
          <p className="t-meta text-ink-2">Katılmak için belgeni doğrulaman gerekiyor.</p>
          <ButtonLink href="/dogrulama">Katılmak için belgeni doğrula</ButtonLink>
        </>
      ) : null}

      {viewerState === "open" ? (
        <>
          <p className="t-meta text-ink-2">Rol seçip motivasyonunu yazabilirsin.</p>
          <Button onClick={() => setSheetOpen(true)}>Projeye katıl</Button>
          {sheetOpen ? (
            <ApplySheet projectId={projectId} roles={roles} onClose={() => setSheetOpen(false)} />
          ) : null}
        </>
      ) : null}

      {viewerState === "pending" ? (
        <>
          <p className="t-label text-ink">Başvurun değerlendiriliyor</p>
          {pendingRequestId ? (
            <Button
              variant="secondary"
              loading={isPending}
              onClick={() => run(() => withdrawApplicationAction(pendingRequestId))}
            >
              Başvuruyu geri çek
            </Button>
          ) : null}
        </>
      ) : null}

      {viewerState === "member" ? (
        <>
          <p className="t-label text-ink">Ekiptesin</p>
          <Button
            variant="secondary"
            loading={isPending}
            onClick={() => {
              if (window.confirm("Bu projeden ayrılmak istediğine emin misin?")) {
                run(() => leaveProjectAction(projectId));
              }
            }}
          >
            Projeden ayrıl
          </Button>
        </>
      ) : null}

      {viewerState === "closed" ? <p className="t-body text-ink-2">Bu proje yeni başvuru almıyor.</p> : null}

      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ApplySheetProps {
  projectId: string;
  roles: ProjectActionRole[];
  onClose: () => void;
}

/**
 * Başvuru paneli. Panel yalnız açıkken bağlanır; başarılı başvuruda sayfa yenilenir ve durum "bekleniyor"
 * olur, böylece panel kendiliğinden kapanır.
 */
function ApplySheet({ projectId, roles, onClose }: ApplySheetProps) {
  const [state, formAction, isPending] = useActionState(applyToProjectAction.bind(null, projectId), null);
  const [message, setMessage] = useState("");

  const openRoles = roles.filter((role) => !role.full);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const length = message.trim().length;

  return (
    <Sheet open onClose={onClose} title="Projeye katıl">
      <form action={formAction} className="flex flex-col gap-4 px-2 pt-2 pb-2">
        {state && !state.ok && !state.fieldErrors ? (
          <p role="alert" className="rounded-control bg-danger-soft p-3 t-body text-danger">
            {state.error}
          </p>
        ) : null}

        <Field id="apply-role" label="Rol" hint="İstersen bir rol seç. Rol fark etmezse boş bırak." error={fieldErrors.roleId}>
          <Select name="roleId" defaultValue="">
            <option value="">Rol fark etmez</option>
            {openRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="apply-message"
          label="Motivasyon mesajı"
          hint={
            length < MIN_MESSAGE
              ? `${length}/${MIN_MESSAGE} karakter. En az ${MIN_MESSAGE} karakter yaz.`
              : `${length} karakter. Kendini ve katkını anlat.`
          }
          error={fieldErrors.message}
        >
          <Textarea
            name="message"
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>

        <Button type="submit" loading={isPending} disabled={length < MIN_MESSAGE}>
          Başvuruyu gönder
        </Button>
      </form>
    </Sheet>
  );
}
