import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface VerifiedStampProps {
  size?: "sm" | "lg";
  /** `lg` boyutunda metin: GRADUATE "mezun", STUDENT "öğrenci", diğerleri genel ifade. */
  academicStatus?: string | null;
  className?: string;
}

function stampLabel(academicStatus?: string | null): string {
  return academicStatus === "GRADUATE"
    ? "Doğrulanmış mezun"
    : academicStatus === "STUDENT"
      ? "Doğrulanmış öğrenci"
      : "Doğrulanmış kullanıcı";
}

/**
 * Belge doğrulama mührü. Çağıran taraf yalnız doğrulanmış kullanıcılar için render eder. Yeşil yalnız bu
 * anlamda kullanılır. `sm`: 16 px dolu yeşil kare ve beyaz onay işareti. `lg`: mühür ve yazı.
 */
export function VerifiedStamp({ size = "sm", academicStatus, className }: VerifiedStampProps) {
  const ring = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-chip bg-stamp text-surface",
        size === "sm" ? "size-4" : "size-5",
      )}
    >
      <Check strokeWidth={3} className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" />
    </span>
  );

  if (size === "sm") {
    return (
      <span role="img" aria-label="Belgesi doğrulandı" title="Belgesi doğrulandı" className={cn("inline-flex", className)}>
        {ring}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-chip border border-stamp/25 bg-stamp-soft py-1 pr-3 pl-1.5 t-label text-stamp",
        className,
      )}
    >
      {ring}
      {stampLabel(academicStatus)}
    </span>
  );
}

/** Kartlardaki yeşil "Öğrenci belgesi doğrulandı" satırı (tik ve yazı). */
export function VerifiedLine({ academicStatus, className }: { academicStatus?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-[550] text-stamp", className)}>
      <Check aria-hidden="true" strokeWidth={2.4} className="size-3.5" />
      {academicStatus === "GRADUATE" ? "Mezun belgesi doğrulandı" : "Öğrenci belgesi doğrulandı"}
    </span>
  );
}
