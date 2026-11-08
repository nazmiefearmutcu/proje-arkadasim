import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { LEGAL } from "@/config/legal";
import { isVerified, requireUser } from "@/lib/auth/guards";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { AiConsentPanel } from "./ai-consent-panel";
import { AvatarField } from "./avatar-field";
import { DeleteAccountForm } from "./delete-account-form";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Ayarlar" };

const SECTIONS = [
  { href: "#profil", label: "Profil" },
  { href: "#sifre", label: "Şifre" },
  { href: "#kvkk", label: "Gizlilik ve KVKK" },
  { href: "#hesap-sil", label: "Hesabı sil" },
];

/** Ayarlar: profil, şifre, KVKK hakları ve hesap silme. Her bölüm kendi formunu ve durum mesajını taşır. */
export default async function Page() {
  const viewer = await requireUser("/ayarlar");
  const [details, aiActive] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { bio: true } }),
    hasActiveConsent(viewer.id, "CROSS_BORDER_AI"),
  ]);
  const verified = isVerified(viewer);
  const displayName = `${viewer.firstName} ${viewer.lastName}`;

  return (
    <>
      <PageHeader title="Ayarlar" description="Profilini, şifreni ve verilerini buradan yönetirsin." />

      <nav aria-label="Ayarlar bölümleri" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <Chip href={section.href}>{section.label}</Chip>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-4">
        <Card id="profil" className="scroll-mt-20 flex flex-col gap-5 p-4">
          <h2 className="t-section text-ink">Profil</h2>
          <AvatarField
            displayName={displayName}
            seed={viewer.username}
            avatarPath={viewer.avatarPath}
            disciplineGroup={viewer.disciplineGroup}
          />
          <ProfileForm
            firstName={viewer.firstName}
            lastName={viewer.lastName}
            verified={verified}
            academicStatus={viewer.academicStatus}
            university={viewer.university}
            bio={details.bio ?? ""}
            city={viewer.city ?? ""}
            skills={parseList(viewer.skillsJson)}
            interests={parseList(viewer.interestsJson)}
            lookingForProject={viewer.lookingForProject}
            faculty={viewer.faculty ?? ""}
            department={viewer.department ?? ""}
            degreeLevel={viewer.degreeLevel ?? ""}
            classYear={viewer.classYear}
            graduationYear={viewer.graduationYear}
          />
        </Card>

        <Card id="sifre" className="scroll-mt-20 flex flex-col gap-5 p-4">
          <h2 className="t-section text-ink">Şifre</h2>
          <PasswordForm />
        </Card>

        <Card id="kvkk" className="scroll-mt-20 flex flex-col gap-5 p-4">
          <h2 className="t-section text-ink">Gizlilik ve KVKK</h2>

          <section aria-labelledby="ai-rizasi" className="flex flex-col gap-3">
            <h3 id="ai-rizasi" className="t-label text-ink">
              Yapay zeka ile hızlı inceleme
            </h3>
            <AiConsentPanel active={aiActive} />
          </section>

          <section aria-labelledby="verilerim" className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 id="verilerim" className="t-label text-ink">
              Verilerin
            </h3>
            <p className="t-meta text-ink-3">
              Hesabındaki kişisel verilerin JSON dosyası olarak iner. Yüklediğin belge dosyası hiçbir
              zaman saklanmadığı için dosyada yer almaz.
            </p>
            <div>
              <a
                href="/api/me/export"
                download
                className="inline-flex h-11 items-center justify-center rounded-control border border-line bg-surface px-4 text-[14px] font-[550] text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
              >
                Verilerimi indir
              </a>
            </div>
          </section>

          <section aria-labelledby="yasal-metinler" className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 id="yasal-metinler" className="t-label text-ink">
              Yasal metinler
            </h3>
            <ul className="flex flex-col">
              <LegalLink href="/kvkk/aydinlatma" label="Aydınlatma metni" />
              <LegalLink href="/kvkk/acik-riza" label="Açık rıza metni" />
              <LegalLink href="/cerezler" label="Çerez politikası" />
              <LegalLink href={`mailto:${LEGAL.email}`} label="KVKK başvurusu" />
            </ul>
          </section>
        </Card>

        <Card id="hesap-sil" className="scroll-mt-20 flex flex-col gap-5 border-danger-soft bg-danger-soft/40 p-4">
          <h2 className="t-section text-ink">Hesabı sil</h2>
          <p className="t-body text-ink-2">
            Hesabını silersen profilin, projelerin, başvuruların, davetlerin, takiplerin, mesajların,
            bildirimlerin, doğrulama kayıtların ve profil fotoğrafın kalıcı olarak silinir. Bu işlem geri
            alınamaz.
          </p>
          <DeleteAccountForm username={viewer.username} />
        </Card>
      </div>
    </>
  );
}

function LegalLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a
        href={href}
        className="flex min-h-11 items-center text-[15px] text-pen underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
      >
        {label}
      </a>
    </li>
  );
}
