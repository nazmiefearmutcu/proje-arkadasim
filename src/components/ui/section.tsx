import type { ReactNode } from "react";

/** Bölüm: `.t-section` başlık ve içerik. Başlık yoksa yalnız içerik sarılır. */
export function Section({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 py-3">
      {title || right ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <h2 className="t-section text-ink">{title}</h2> : <span />}
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
