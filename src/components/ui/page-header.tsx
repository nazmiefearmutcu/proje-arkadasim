import type { ReactNode } from "react";

/** Sayfa başlığı: `.t-page` başlık, isteğe bağlı açıklama ve sağda eylem alanı. */
export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pt-2 pb-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="t-page text-ink">{title}</h1>
        {description ? <p className="t-body t-prose text-ink-2">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
