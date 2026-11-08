import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface VerifiedStampProps {
  size?: "sm" | "lg";
  /** `lg` boyutunda metin: GRADUATE "mezun", STUDENT "öğrenci", diğerleri genel ifade. */
  academicStatus?: string | null;
  className?: string;
}

/**
 * Belge doğrulama mührü. Çağıran taraf yalnız doğrulanmış kullanıcılar için render eder.
 * `sm`: 18 px halka ve onay işareti. `lg`: mühür ve "Doğrulanmış öğrenci/mezun" yazısı.
 */
export function VerifiedStamp({ size = "sm", academicStatus, className }: VerifiedStampProps) {
  const label =
    academicStatus === "GRADUATE"
      ? "Doğrulanmış mezun"
      : academicStatus === "STUDENT"
        ? "Doğrulanmış öğrenci"
        : "Doğrulanmış kullanıcı";

  const ring = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-stamp text-stamp rotate-[-8deg]",
        size === "sm" ? "size-[18px]" : "size-6",
      )}
    >
      <Check strokeWidth={2.5} className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" />
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
        "inline-flex items-center gap-2 rounded-chip bg-stamp-soft py-1 pr-3 pl-1.5 t-label text-stamp",
        className,
      )}
    >
      {ring}
      {label}
    </span>
  );
}
