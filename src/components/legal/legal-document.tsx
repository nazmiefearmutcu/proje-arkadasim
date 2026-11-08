import type { ReactNode } from "react";
import { LEGAL_VERSION, hasLegalPlaceholders } from "@/config/legal";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Zorunlu operatör bilgilerinden biri (unvan, adres, e-posta, KEP, barındırma ülkesi) hâlâ köşeli
 * parantez içindeyse (şablon) uyarı gösterir. Yalnız biri doldurulunca uyarı kaybolmaz.
 */
export function DraftNotice() {
  if (!hasLegalPlaceholders()) return null;
  return (
    <div role="note" className="rounded-control bg-warn-soft px-3.5 py-3 t-meta text-warn">
      Bu metin şablondur; yayımlanmadan önce hukuk danışmanınca gözden geçirilmelidir.
    </div>
  );
}

/** Yasal metin sayfası: başlık, şablon uyarısı, sürüm ve okunaklı gövde (en fazla 68 karakter genişlik). */
export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col gap-6">
        <DraftNotice />
        <p className="t-meta text-ink-3">Sürüm {LEGAL_VERSION}</p>
        <article className="t-body t-prose flex flex-col gap-8 text-ink-2">{children}</article>
      </div>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-section text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
