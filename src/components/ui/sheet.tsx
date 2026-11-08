"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./button";
import { focusRing } from "./styles";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Alttan açılan panel. Yerel `<dialog>` kullanır: odak tuzağı, Escape ve modal arka plan tarayıcıdan gelir.
 * Arka plana dokunmak, Escape ve Kapat düğmesi `onClose` çağırır; açık durum çağıran tarafta tutulur.
 * Arka plan perdesi temadan bağımsız `--scrim` tokenıdır (`--ink` koyu temada açık renktir).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Yalnız arka plan (diyalog öğesinin kendisi) tıklamasında kapanır; içerik tıklamaları yayılmaz.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 m-0 mx-auto h-auto max-h-[85dvh] w-full max-w-[640px] overflow-y-auto rounded-t-sheet bg-surface p-0 text-ink shadow-sheet backdrop:bg-scrim",
      )}
    >
      <div className="flex flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-2">
          <h2 id={titleId} className="t-section text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className={buttonClasses("ghost", "md", "size-11 px-0")}
          >
            <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </button>
        </div>
        <div className={cn("px-2 pb-2", focusRing)}>{children}</div>
      </div>
    </dialog>
  );
}
