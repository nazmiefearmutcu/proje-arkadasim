import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Şifremi unuttum" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Şifremi unuttum"
        description="E-posta adresini yaz; şifreni sıfırlamak için bir bağlantı gönderelim."
      />
      <ForgotPasswordForm />
      <div className="mt-8 border-t border-line pt-6">
        <ButtonLink href="/giris" variant="ghost" className="w-full">
          Giriş sayfasına dön
        </ButtonLink>
      </div>
    </>
  );
}
