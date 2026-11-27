import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PurgeButton } from "@/components/admin/purge-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { focusRing } from "@/components/ui/styles";
import { adminMetadata } from "@/lib/admin/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export function generateMetadata() {
  return adminMetadata("Editör paneli");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Editörün genel bakışı: bekleyen işler (kısayollu) ve son 24 saatin otomatik kararları. */
export default async function Page() {
  await requireAdmin();
  const since = new Date(Date.now() - DAY_MS);

  const [pendingProjects, reportedProjects, reviewQueue, openReports, autoApproved, autoRejected, students, verified] =
    await Promise.all([
      db.project.count({ where: { moderationStatus: "PENDING" } }),
      db.report.findMany({
        where: { targetType: "PROJECT", status: "OPEN" },
        distinct: ["targetId"],
        select: { targetId: true },
      }),
      db.verificationAttempt.count({ where: { status: "MANUAL_REVIEW" } }),
      db.report.count({ where: { status: "OPEN", targetType: { not: "PROJECT" } } }),
      db.verificationAttempt.count({ where: { source: "EDEVLET", status: "APPROVED", createdAt: { gte: since } } }),
      db.verificationAttempt.count({ where: { source: "EDEVLET", status: "REJECTED", createdAt: { gte: since } } }),
      db.user.count({ where: { role: "USER" } }),
      db.user.count({ where: { role: "USER", verificationStatus: "VERIFIED" } }),
    ]);

  const work = [
    { label: "Onay bekleyen ilan", value: pendingProjects, href: "/editor/icerik" },
    { label: "Şikayet edilen ilan", value: reportedProjects.length, href: "/editor/icerik?sekme=sikayet" },
    { label: "İncelenecek belge", value: reviewQueue, href: "/editor/belgeler" },
    { label: "Kişi ve mesaj şikayeti", value: openReports, href: "/editor/sikayetler" },
  ];
  const stats = [
    { label: "e-Devlet ile onaylanan (24 saat)", value: autoApproved },
    { label: "e-Devlet ile reddedilen (24 saat)", value: autoRejected },
    { label: "Öğrenci hesabı", value: students },
    { label: "Doğrulanmış", value: verified },
  ];

  return (
    <>
      <PageHeader title="Editör paneli" description="Bekleyen işler. Sıfır olan iş yok demektir." />

      <Section title="Bekleyen işler">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {work.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`group flex items-center justify-between gap-3 rounded-card border p-4 transition-colors ${
                  item.value > 0 ? "border-pen bg-surface hover:bg-surface-2" : "border-line bg-surface hover:bg-surface-2"
                } ${focusRing}`}
              >
                <span className="flex flex-col gap-1">
                  <span className="t-meta text-ink-3">{item.label}</span>
                  <span className="font-display text-[32px] leading-none font-[800] text-ink tabular-nums">{item.value}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Otomatik doğrulama">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
              <dt className="t-meta text-ink-3">{item.label}</dt>
              <dd className="t-card text-ink tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Bakım">
        <Card className="flex flex-col gap-3 p-4">
          <p className="t-body t-prose text-ink-2">
            İncelemeye düşen belgelerin maskeli metinleri saklama süresi dolunca silinir. Süresi dolanları
            buradan hemen temizleyebilirsin.
          </p>
          <PurgeButton />
        </Card>
      </Section>
    </>
  );
}
