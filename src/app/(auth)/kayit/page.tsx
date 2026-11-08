import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata = { title: "Kayıt ol" };

export default async function Page() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <PageHeader title="Kayıt ol" description="Hesabını oluştur, sonra belgeni doğrulayalım." />
      <RegisterForm />
      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
        <p className="t-meta text-ink-3">Zaten hesabın var mı?</p>
        <ButtonLink href="/giris" variant="secondary" className="w-full">
          Giriş yap
        </ButtonLink>
      </div>
    </>
  );
}
