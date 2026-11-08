import { cn } from "@/lib/cn";

export function Spinner({ className, label = "Yükleniyor" }: { className?: string; label?: string }) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={cn("size-5 shrink-0 animate-spin", className)}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
