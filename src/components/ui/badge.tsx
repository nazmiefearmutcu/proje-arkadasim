import { cn } from "@/lib/cn";

/** Sayı rozeti. Sayı 0 veya daha azsa hiçbir şey çizmez. 99'dan büyükse "99+" gösterir. */
export function Badge({ count, className, label }: { count: number; className?: string; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip bg-pen px-1 text-[12px] leading-none font-[650] text-pen-ink",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
