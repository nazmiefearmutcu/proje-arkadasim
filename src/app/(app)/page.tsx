import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Ana sayfa" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hesap?: string }>;
}) {
  const { hesap } = await searchParams;
  return (
    <>
      <PageHeader title="Ana sayfa" />
      {hesap === "silindi" ? (
        <p role="status" className="t-body rounded-control border border-line bg-surface px-4 py-3 text-ink">
          Hesabın ve verilerin kalıcı olarak silindi.
        </p>
      ) : null}
      <p className="t-body t-prose text-ink-2">Bu sayfa hazırlanıyor.</p>
    </>
  );
}
