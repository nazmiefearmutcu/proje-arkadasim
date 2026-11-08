import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-4 py-10">
      <EmptyState
        title="Sayfa bulunamadı"
        text="Adres değişmiş ya da sayfa kaldırılmış olabilir."
        action={<ButtonLink href="/">Ana sayfaya dön</ButtonLink>}
      />
    </main>
  );
}
