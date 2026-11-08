import { cn } from "@/lib/cn";

/** Üç dikey çubuklu işaret: mini disiplin sırtı (yazılım, tasarım, elektronik renkleri). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)}>
      <rect x="5" y="8" width="6" height="16" rx="3" fill="var(--d-yazilim)" />
      <rect x="13" y="6" width="6" height="20" rx="3" fill="var(--d-tasarim)" />
      <rect x="21" y="10" width="6" height="12" rx="3" fill="var(--d-elektronik)" />
    </svg>
  );
}

/** Marka: işaret ve "Proje Arkadaşım" yazısı. Bağlantı gerekiyorsa çağıran taraf sarar. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark />
      <span className="text-[17px] leading-none font-[750] tracking-[-0.02em]">Proje Arkadaşım</span>
    </span>
  );
}
