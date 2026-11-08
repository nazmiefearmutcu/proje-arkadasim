import type { ReactNode } from "react";

/** Boş durum: simge, başlık, açıklama ve bir eylem. Ortalanmış metin yalnız burada kullanılır. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      {icon ? (
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          {icon}
        </span>
      ) : null}
      <h2 className="t-card text-ink">{title}</h2>
      {text ? <p className="t-body max-w-[68ch] text-ink-2">{text}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
