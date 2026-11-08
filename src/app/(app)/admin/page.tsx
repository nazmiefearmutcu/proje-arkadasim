import { PurgeButton } from "@/components/admin/purge-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { adminMetadata } from "@/lib/admin/metadata";

export function generateMetadata() {
  return adminMetadata("Yönetim paneli");
}

export default async function Page() {
  await requireAdmin();

  const [users, verified, reviewQueue, openReports, openProjects] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { verificationStatus: "VERIFIED" } }),
    db.verificationAttempt.count({ where: { status: "MANUAL_REVIEW" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.project.count({ where: { status: "OPEN" } }),
  ]);

  const counts = [
    { label: "Kullanıcı", value: users },
    { label: "Doğrulanmış", value: verified },
    { label: "İncelemede belge", value: reviewQueue },
    { label: "Açık şikayet", value: openReports },
    { label: "Açık proje", value: openProjects },
  ];

  return (
    <>
      <PageHeader title="Yönetim paneli" />

      <Section title="Özet">
        <dl className="grid grid-cols-2 gap-3">
          {counts.map((item) => (
            <div
              key={item.label}
              className="relative flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
            >
              <dt className="t-meta text-ink-3">{item.label}</dt>
              <dd className="t-card text-ink tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Bakım">
        <Card className="flex flex-col gap-3 p-4">
          <p className="t-body t-prose text-ink-2">
            Maskeli metinler, saklama süresi dolunca otomatik olarak silinmelidir. Süresi dolanları buradan
            hemen temizleyebilirsin.
          </p>
          <PurgeButton />
        </Card>
      </Section>
    </>
  );
}
