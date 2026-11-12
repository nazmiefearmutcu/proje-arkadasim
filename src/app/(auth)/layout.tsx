import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { focusRing } from "@/components/ui/styles";

/** Kimlik akışları için sade kabuk: marka bağlantısı ve ortalanmış dar kolon, alt menü yok. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-8 px-4 pt-8 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <Link href="/" className={`self-start rounded-control py-2 ${focusRing}`}>
        <Logo onLight className="text-ink" />
      </Link>
      <main className="flex flex-col">{children}</main>
    </div>
  );
}
