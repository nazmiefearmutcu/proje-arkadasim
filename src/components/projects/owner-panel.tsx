"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  cancelInviteAction,
  decideApplicationAction,
  deleteProjectAction,
  inviteToProjectAction,
  removeMemberAction,
  searchInvitableUsersAction,
  setProjectStatusAction,
} from "@/lib/projects/actions";
import type { PersonSummary } from "@/lib/dto";
import { UserRow } from "@/components/common/user-row";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "./use-run-action";

export interface OwnerPanelPerson {
  person: PersonSummary;
  /** Görüntüleyiciye göre ad (sahip doğrulanmış olduğundan tam ad). */
  name: string;
}

export interface OwnerPanelProps {
  projectId: string;
  status: "OPEN" | "CLOSED";
  roles: Array<{ id: string; title: string; full: boolean }>;
  requests: Array<OwnerPanelPerson & { id: string; roleTitle: string | null; message: string }>;
  invites: Array<OwnerPanelPerson & { id: string; roleTitle: string | null }>;
  members: Array<OwnerPanelPerson & { userId: string; roleTitle: string | null }>;
}

/**
 * Proje sahibinin paneli: başvurular, davetler, bekleyen davetler, ekip ve proje işlemleri. Her eylem
 * sunucuda yetki kontrolünden geçer; başarılı eylemler sayfayı yeniler.
 */
export function OwnerPanel({ projectId, status, roles, requests, invites, members }: OwnerPanelProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { isPending, error, run } = useRunAction();
  const closed = status === "CLOSED";

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      {error ? (
        <p role="alert" className="rounded-control bg-danger-soft p-3 t-body text-danger">
          {error}
        </p>
      ) : null}

      {/* JOIN_REQUEST bildirimi #basvurular çapasına gelir; boşluk yapışkan üst barın altında kalmasın diye. */}
      <div id="basvurular" className="scroll-mt-20">
        <Section title="Başvurular">
          {requests.length === 0 ? (
            <p className="t-body text-ink-2">Bekleyen başvuru yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-2 py-2">
                  <UserRow person={request.person} name={request.name} />
                  <div className="flex flex-wrap items-center gap-2">
                    {request.roleTitle ? <Chip>{request.roleTitle}</Chip> : <Chip>Rol fark etmez</Chip>}
                  </div>
                  <p className="t-body whitespace-pre-line text-ink-2">{request.message}</p>
                  <div className="flex gap-2">
                    <Button
                      loading={isPending}
                      onClick={() => run(() => decideApplicationAction(request.id, "ACCEPT"))}
                      className="flex-1"
                    >
                      Kabul et
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => run(() => decideApplicationAction(request.id, "REJECT"))}
                      className="flex-1"
                    >
                      Reddet
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Davetler"
        right={
          <Button variant="secondary" disabled={closed} onClick={() => setInviteOpen(true)}>
            Kişi davet et
          </Button>
        }
      >
        {closed ? <p className="t-meta text-ink-3">Davet göndermek için projeyi yeniden aç.</p> : null}
        {invites.length === 0 ? (
          <p className="t-body text-ink-2">Bekleyen davet yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-1">
                <UserRow
                  person={invite.person}
                  name={invite.name}
                  reason={invite.roleTitle ? `Rol: ${invite.roleTitle}` : "Rol fark etmez"}
                  action={
                    <Button
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => run(() => cancelInviteAction(invite.id))}
                    >
                      Daveti geri al
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ekip">
        {members.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="t-body text-ink-2">Henüz ekip üyesi yok.</p>
            {closed ? <p className="t-meta text-ink-3">Davet göndermek için projeyi yeniden aç.</p> : null}
            <Button variant="secondary" disabled={closed} onClick={() => setInviteOpen(true)}>
              Kişi davet et
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {members.map((member) => (
              <li key={member.userId}>
                <UserRow
                  person={member.person}
                  name={member.name}
                  reason={member.roleTitle ?? "Ekip üyesi"}
                  action={
                    <Button
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        if (window.confirm(`${member.name} ekipten çıkarılsın mı?`)) {
                          run(() => removeMemberAction(projectId, member.userId));
                        }
                      }}
                    >
                      Ekipten çıkar
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Proje işlemleri">
        <div className="flex flex-col gap-2">
          <ButtonLink href={`/projeler/${projectId}/duzenle`} variant="secondary">
            Düzenle
          </ButtonLink>
          <Button
            variant="secondary"
            loading={isPending}
            onClick={() => run(() => setProjectStatusAction(projectId, closed ? "OPEN" : "CLOSED"))}
          >
            {closed ? "Başvurulara aç" : "Başvurulara kapat"}
          </Button>
          <Button
            variant="danger"
            disabled={isPending}
            onClick={() => {
              if (window.confirm("Bu proje kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?")) {
                run(() => deleteProjectAction(projectId));
              }
            }}
          >
            Projeyi sil
          </Button>
        </div>
      </Section>

      {/* Panel bağlı kalır; kapanınca dialog.close() odağı açan düğmeye geri verir. İçerik yalnız açıkken
          bağlanır, bu yüzden her açılış temiz başlar. */}
      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Kişi davet et">
        {inviteOpen ? <InvitePanel projectId={projectId} roles={roles} onClose={() => setInviteOpen(false)} /> : null}
      </Sheet>
    </div>
  );
}

interface InvitePanelProps {
  projectId: string;
  roles: Array<{ id: string; title: string; full: boolean }>;
  onClose: () => void;
}

interface SearchHit {
  person: PersonSummary;
  name: string;
}

const SEARCH_DELAY_MS = 300;

/**
 * Davet paneli içeriği. Önce kişi aranır (300 ms gecikmeli), seçilince rol ve mesaj formu açılır.
 * İçerik her açılışta yeniden kurulur; bu yüzden eski seçim kalmaz. Rol ve mesaj state'te tutulur:
 * React 19 form eyleminden sonra denetimsiz alanları sıfırlar, başarısız gönderimde yazılanlar kaybolmamalı.
 */
function InvitePanel({ projectId, roles, onClose }: InvitePanelProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [roleId, setRoleId] = useState("");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);

  const [inviteState, inviteAction, invitePending] = useActionState(inviteToProjectAction, null);

  // Panel kapanınca bekleyen gecikmeli arama çalışmasın.
  useEffect(() => {
    const pending = timer;
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  async function search(value: string): Promise<void> {
    const current = ++sequence.current;
    setSearching(true);
    setSearchError(null);
    const result = await searchInvitableUsersAction(projectId, value);
    if (current !== sequence.current) return;
    setSearching(false);
    if (result.ok) {
      setHits((result.data ?? []).map((person) => ({ person, name: `${person.firstName} ${person.lastName}` })));
    } else {
      setHits([]);
      setSearchError(result.error);
    }
  }

  function onQueryChange(value: string): void {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      sequence.current += 1;
      setHits([]);
      setSearching(false);
      return;
    }
    timer.current = setTimeout(() => {
      void search(value);
    }, SEARCH_DELAY_MS);
  }

  const fieldErrors = inviteState && !inviteState.ok ? (inviteState.fieldErrors ?? {}) : {};

  return (
    <div className="flex flex-col gap-4 px-2 pt-2 pb-2">
      {inviteState?.ok ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="rounded-control bg-ok-soft p-3 t-body text-ok">
            Davet gönderildi. Kişi bildirimlerinde görecek.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>
      ) : selected ? (
        <form action={inviteAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId} readOnly />
          <input type="hidden" name="username" value={selected.person.username} readOnly />
          <div className="flex items-center justify-between gap-2 rounded-card border border-line p-3">
            <span className="t-label text-ink">{selected.name}</span>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Değiştir
            </Button>
          </div>
          {inviteState && !inviteState.ok && !inviteState.fieldErrors ? (
            <p role="alert" className="t-body text-danger">
              {inviteState.error}
            </p>
          ) : null}
          {fieldErrors.username ? <p className="t-meta text-danger">{fieldErrors.username}</p> : null}
          <Field id="invite-role" label="Rol" error={fieldErrors.roleId}>
            <Select name="roleId" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">Rol fark etmez</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id} disabled={role.full}>
                  {role.full ? `${role.title} (dolu)` : role.title}
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
          <Button type="submit" loading={invitePending}>
            Davet gönder
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Field id="invite-search" label="Kullanıcı ara" hint="Ad, soyad ya da kullanıcı adı. En az 2 karakter.">
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              autoComplete="off"
              type="search"
            />
          </Field>
          {/* Arama durumu ve sonuçlar ekran okuyucuya duyurulur. */}
          <div aria-live="polite" className="flex flex-col gap-3">
            {searchError ? <p className="t-meta text-danger">{searchError}</p> : null}
            {searching ? <p className="t-meta text-ink-3">Aranıyor…</p> : null}
            {!searching && query.trim().length >= 2 && hits.length === 0 && !searchError ? (
              <EmptyState
                title="Kişi bulunamadı"
                text="Doğrulanmış, ekipte olmayan ve bekleyen daveti ya da başvurusu olmayan kişiler listelenir. Kullanıcı adının doğru olduğunu kontrol et."
              />
            ) : null}
            {hits.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line">
                {hits.map((hit) => (
                  <li key={hit.person.id}>
                    <UserRow
                      person={hit.person}
                      name={hit.name}
                      action={
                        <Button variant="secondary" onClick={() => setSelected(hit)}>
                          Seç
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
