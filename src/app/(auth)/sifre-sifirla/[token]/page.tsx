import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { findUsableResetToken } from "@/lib/auth/reset-token";

export const metadata = { title: "Yeni şifre" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await findUsableResetToken(token);

  if (!record) {
    return (
      <>
        <PageHeader
          title="Bağlantı geçersiz"
          description="Bu bağlantı kullanılmış, süresi dolmuş ya da hiç var olmamış."
        />
        <ButtonLink href="/sifremi-unuttum" variant="secondary" className="w-full">
          Yeni bağlantı iste
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Yeni şifre"
        description="Yeni şifreni belirle. Kaydettiğinde tüm oturumların kapanır."
      />
      <ResetPasswordForm token={token} />
    </>
  );
}
