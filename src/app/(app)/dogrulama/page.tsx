import Link from "next/link";
import { VerifiedStamp } from "@/components/common/verified-stamp";
import { ConsentPanel } from "@/components/verification/consent-panel";
import { Uploader } from "@/components/verification/uploader";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ACADEMIC_STATUSES, DEGREE_LEVELS, VERIFICATION_STATUSES, labelOf } from "@/config/taxonomy";
import { MASKED_TEXT_RETENTION_DAYS } from "@/config/legal";
import { requireUser } from "@/lib/auth/guards";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";

export const metadata = { title: "Belge doğrulama" };

/** 24 saatte en fazla bu kadar belge yüklenir (service.ts ile aynı sınır). */
const DAILY_ATTEMPT_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const DECISION_STATUSES = ["APPROVED", "REJECTED", "MANUAL_REVIEW"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hosgeldin?: string }>;
}) {
  const user = await requireUser("/dogrulama");
  const { hosgeldin } = await searchParams;

  const windowStart = new Date(Date.now() - DAY_MS);
  const [lastDecision, usedInWindow, aiConsent] = await Promise.all([
    db.verificationAttempt.findFirst({
      where: { userId: user.id, status: { in: [...DECISION_STATUSES] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { status: true, rejectReason: true, createdAt: true },
    }),
    db.verificationAttempt.count({
      where: { userId: user.id, status: { not: "ERROR" }, createdAt: { gte: windowStart } },
    }),
    hasActiveConsent(user.id, "CROSS_BORDER_AI"),
  ]);

  const remaining = Math.max(0, DAILY_ATTEMPT_LIMIT - usedInWindow);
  const status = user.verificationStatus;
  const showUploader = status !== "VERIFIED" && status !== "MANUAL_REVIEW" && status !== "PENDING";
  const showConsent = showUploader && !aiConsent;

  return (
    <>
      <PageHeader title="Belge doğrulama" />

      <div className="flex flex-col gap-4">
        {hosgeldin === "1" && showUploader ? (
          <Card className="bg-pen-soft p-4">
            <p className="t-body text-ink">
              Hesabın oluşturuldu. Son adım: öğrenci veya mezun belgeni yükle.
            </p>
          </Card>
        ) : null}

        {status === "VERIFIED" ? (
          <section className="flex flex-col gap-4 rounded-card bg-stamp-soft p-4">
            <VerifiedStamp size="lg" academicStatus={user.academicStatus} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 t-body">
              {user.university ? (
                <>
                  <dt className="text-ink-3">Üniversite</dt>
                  <dd className="text-ink">{user.university}</dd>
                </>
              ) : null}
              {user.faculty ? (
                <>
                  <dt className="text-ink-3">Fakülte</dt>
                  <dd className="text-ink">{user.faculty}</dd>
                </>
              ) : null}
              {user.department ? (
                <>
                  <dt className="text-ink-3">Bölüm</dt>
                  <dd className="text-ink">{user.department}</dd>
                </>
              ) : null}
              {user.degreeLevel ? (
                <>
                  <dt className="text-ink-3">Öğrenim düzeyi</dt>
                  <dd className="text-ink">{labelOf(DEGREE_LEVELS, user.degreeLevel)}</dd>
                </>
              ) : null}
              {user.academicStatus === "STUDENT" && user.classYear ? (
                <>
                  <dt className="text-ink-3">Sınıf</dt>
                  <dd className="text-ink">{user.classYear}. sınıf</dd>
                </>
              ) : null}
              {user.academicStatus === "GRADUATE" && user.graduationYear ? (
                <>
                  <dt className="text-ink-3">Mezuniyet yılı</dt>
                  <dd className="text-ink">{user.graduationYear}</dd>
                </>
              ) : null}
              {user.academicStatus ? (
                <>
                  <dt className="text-ink-3">Durum</dt>
                  <dd className="text-ink">{labelOf(ACADEMIC_STATUSES, user.academicStatus)}</dd>
                </>
              ) : null}
            </dl>
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink href="/">Ana sayfaya git</ButtonLink>
              <ButtonLink href="/ayarlar" variant="secondary">
                Bilgilerini düzenle
              </ButtonLink>
            </div>
          </section>
        ) : null}

        {status === "MANUAL_REVIEW" || status === "PENDING" ? (
          <section className="flex flex-col gap-2 rounded-card bg-warn-soft p-4">
            {/* MANUAL_REVIEW "Manuel incelemede", PENDING "İnceleniyor" (spec §4.2); sonuç kartıyla aynı ad. */}
            <p className="t-label text-warn">{labelOf(VERIFICATION_STATUSES, status)}</p>
            <p className="t-body text-ink">
              Belgen inceleniyor. En geç 24 saat içinde sonucu bildireceğiz.
            </p>
          </section>
        ) : null}

        {status === "REJECTED" ? (
          <section className="flex flex-col gap-3 rounded-card bg-danger-soft p-4">
            <p className="t-label text-danger">Belgen onaylanmadı</p>
            <p className="t-body text-ink">
              {lastDecision?.rejectReason ?? "Belgen doğrulanamadı. Daha net bir kopya yükleyebilirsin."}
            </p>
            {/* Deneme hakkı bittiyse yükleyici yerine sınır kartı görünür; bağlantı gösterilmez. */}
            {remaining > 0 ? (
              <ButtonLink href="#belge-yukle" variant="secondary" className="self-start">
                Yeni belge yükle
              </ButtonLink>
            ) : null}
          </section>
        ) : null}

        {status === "UNVERIFIED" ? (
          <Card className="flex flex-col gap-1 p-4">
            <p className="t-label text-ink">Belgen henüz doğrulanmadı</p>
            <p className="t-meta text-ink-3">
              Belgen doğrulandıktan sonra projeleri paylaşabilir ve projelere katılabilirsin.
            </p>
          </Card>
        ) : null}

        {showUploader ? (
          <>
            <Card className="flex flex-col gap-2 p-4">
              <h2 className="t-card text-ink">Kabul edilen belgeler</h2>
              <p className="t-body t-prose text-ink-2">
                En hızlı yol: e-Devlet&apos;te &quot;Öğrenci Belgesi Sorgulama&quot; (öğrenciler) veya
                &quot;YÖK Mezun Belgesi Sorgulama&quot; (mezunlar) hizmetinden PDF&apos;i indir ve buraya
                yükle. Fotoğraf da yükleyebilirsin.
              </p>
              <p className="t-meta t-prose text-ink-3">
                Belgen sunucumuzda yalnızca incelenirken bellekte tutulur. Ekibimizin incelemesi gereken
                belgelerde yalnızca kişisel verileri çıkarılmış metin en fazla {MASKED_TEXT_RETENTION_DAYS}{" "}
                gün saklanır.{" "}
                <Link href="/kvkk/aydinlatma" className="text-pen underline underline-offset-2">
                  Aydınlatma metni
                </Link>
              </p>
              <p className="t-meta text-ink-2">Bugün {remaining} deneme hakkın kaldı.</p>
            </Card>

            {/* Rıza kararı yüklemeden önce verilir; yükleyicinin adım listesi bu karara göre değişir. */}
            {showConsent ? <ConsentPanel /> : null}

            <Uploader aiConsent={aiConsent} remaining={remaining} />
          </>
        ) : null}

        {showUploader && aiConsent ? (
          <p className="t-meta text-ink-3">
            Hızlı inceleme açık. Rızanı Ayarlar&apos;dan geri alabilirsin.
          </p>
        ) : null}
      </div>
    </>
  );
}
