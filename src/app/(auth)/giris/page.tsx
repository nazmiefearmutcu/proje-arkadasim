import { redirect } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { LoginForm } from "@/components/auth/login-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, safeNextPath } from "@/lib/auth/guards";

export const metadata = { title: "Giriş yap" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "");
  const passwordReset = params.sifre === "yenilendi";

  return (
    <>
      <PageHeader title="Giriş yap" description="E-postan ve şifrenle giriş yap." />
      <div className="flex flex-col gap-5">
        {passwordReset ? (
          <FormAlert tone="ok">Şifren yenilendi. Yeni şifrenle giriş yapabilirsin.</FormAlert>
        ) : null}
        <LoginForm next={next} />
      </div>
    </>
  );
}
