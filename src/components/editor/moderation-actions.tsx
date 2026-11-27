"use client";

import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { approveProjectAction, removeProjectAction } from "@/lib/moderation/actions";
import { REMOVAL_REASONS } from "@/lib/moderation/reasons";
import type { RemovalReason } from "@/lib/moderation/reasons";

/**
 * İlan kartının karar alanı. "Onayla" tek tıktır. "Sil" önce nedeni sorar (dört hazır neden ve isteğe
 * bağlı not), sonra kaldırır. Başarıda liste yenilenir ve kart kalkar.
 */
export function ModerationActions({
  projectId,
  approveLabel = "Onayla",
  suggestedReason,
}: {
  projectId: string;
  approveLabel?: string;
  suggestedReason?: RemovalReason;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "remove" | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState<RemovalReason | null>(suggestedReason ?? null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

  function approve() {
    setError(null);
    setBusy("approve");
    startTransition(async () => {
      const result = await approveProjectAction(projectId);
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    if (!reason) {
      setError("Kaldırma nedenini seç.");
      return;
    }
    setBusy("remove");
    startTransition(async () => {
      const result = await removeProjectAction({ projectId, reason, note });
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {!removing ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} loading={pending && busy === "approve"} disabled={pending} className="gap-2">
            <Check aria-hidden="true" strokeWidth={2} className="size-4" />
            {approveLabel}
          </Button>
          <Button variant="secondary" onClick={() => setRemoving(true)} disabled={pending} className="gap-2">
            <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Sil
          </Button>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="t-label text-ink">Neden kaldırılıyor?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {(Object.keys(REMOVAL_REASONS) as RemovalReason[]).map((key) => (
              <label
                key={key}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 t-label has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pen",
                  reason === key ? "border-pen bg-pen text-pen-ink" : "border-line bg-surface text-ink-2 hover:border-ink-3",
                )}
              >
                <input
                  type="radio"
                  name={`reason-${projectId}`}
                  value={key}
                  checked={reason === key}
                  onChange={() => setReason(key)}
                  className="sr-only"
                />
                {REMOVAL_REASONS[key]}
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteId} className="t-meta text-ink-3">
              İlan sahibine not (isteğe bağlı)
            </label>
            <Textarea
              id={noteId}
              value={note}
              maxLength={300}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Örn. İletişim bilgisi paylaşmak yerine ProBuddy mesajlarını kullan."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={remove} loading={pending && busy === "remove"} disabled={pending} className="gap-2">
              <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
              İlanı kaldır
            </Button>
            <Button variant="ghost" onClick={() => setRemoving(false)} disabled={pending}>
              Vazgeç
            </Button>
          </div>
        </fieldset>
      )}
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
