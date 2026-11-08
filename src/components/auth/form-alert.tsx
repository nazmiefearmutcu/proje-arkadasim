import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
} as const;

/** Form düzeyi bildirim: hata (role="alert") ya da başarı (role="status"). */
export function FormAlert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-control px-3.5 py-3 t-body", tones[tone])}
    >
      {children}
    </div>
  );
}
