import { ReviewForm } from "@/components/admin/review-form";
import type { ReviewDefaults } from "@/components/admin/review-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { documentReuseByAttempt } from "@/lib/admin/document-reuse";
import { requireAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { parseList, parseObject } from "@/lib/json-fields";
import { relativeTimeTr } from "@/lib/time";
import { adminMetadata } from "@/lib/admin/metadata";

export function generateMetadata() {
  return adminMetadata("Doğrulama kuyruğu");
}

const QUEUE_LIMIT = 50;

interface StoredProfile {
  university?: string | null;
  faculty?: string | null;
  department?: string | null;
  academicStatus?: string | null;
  degreeLevel?: string | null;
  classYear?: number | null;
  graduationYear?: number | null;
}

const SOURCE_LABEL: Record<string, string> = {
  PDF_TEXT: "PDF metni",
  OCR: "Fotoğraf (OCR)",
};

function toDefaults(profile: StoredProfile): ReviewDefaults {
  return {
    university: profile.university ?? "",
    faculty: profile.faculty ?? "",
    department: profile.department ?? "",
    academicStatus: profile.academicStatus ?? "",
    degreeLevel: profile.degreeLevel ?? "",
    classYear: profile.classYear != null ? String(profile.classYear) : "",
    graduationYear: profile.graduationYear != null ? String(profile.graduationYear) : "",
  };
}

/**
 * İncelemedeki belgeler, en eskisi önce. Sayfa her açılışta bir erişim kaydı yazar: maskeli metinler
 * sunucuda işlenip gösterildiği için görüntüleme, erişimin kendisidir (spec §6.2).
 */
export default async function Page() {
  const admin = await requireAdmin();

  const [items, total] = await Promise.all([
    db.verificationAttempt.findMany({
      where: { status: "MANUAL_REVIEW" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: QUEUE_LIMIT,
      select: {
        id: true,
        userId: true,
        docHash: true,
        source: true,
        nameMatch: true,
        aiUsed: true,
        aiModel: true,
        aiConfidence: true,
        aiSummary: true,
        redFlagsJson: true,
        extractedJson: true,
        maskedText: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, username: true, email: true } },
      },
    }),
    db.verificationAttempt.count({ where: { status: "MANUAL_REVIEW" } }),
    db.adminAuditLog.create({
      data: { adminId: admin.id, action: "VIEW_VERIFICATION_QUEUE" },
    }),
  ]);

  // Aynı belgeyi (aynı docHash) yükleyen başka hesaplar, tek sorguda. Özet değerin kendisi asla gösterilmez.
  const reuseByAttempt = await documentReuseByAttempt(items);

  const capped = items.length === QUEUE_LIMIT && total > items.length;
  const description =
    total === 0
      ? undefined
      : capped
        ? `${total} belge inceleme bekliyor. En eski ${items.length} tanesi gösteriliyor, en eskisi üstte.`
        : `${total} belge inceleme bekliyor. En eski olan üstte.`;

  return (
    <>
      <PageHeader title="Doğrulama kuyruğu" description={description} />

      {items.length === 0 ? (
        <EmptyState title="İncelenecek belge yok" text="Manuel incelemeye düşen belgeler burada görünür." />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const redFlags = parseList(item.redFlagsJson);
            const profile = parseObject<StoredProfile>(item.extractedJson, {});
            const name = `${item.user.firstName} ${item.user.lastName}`.trim();
            const reuse = reuseByAttempt.get(item.id);
            const ownDocument = item.userId === admin.id;
            return (
              <li key={item.id}>
                <Card className="flex flex-col gap-4 p-4">
                  <header className="flex flex-col gap-1">
                    <h2 className="t-card text-ink">{name}</h2>
                    <p className="t-meta text-ink-3">@{item.user.username}</p>
                    <p className="t-meta text-ink-3">{item.user.email}</p>
                    <p className="t-meta text-ink-3">{relativeTimeTr(item.createdAt)}</p>
                  </header>

                  {reuse ? (
                    <p
                      className={cn(
                        "rounded-control p-3 t-label",
                        reuse === "onaylı" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn",
                      )}
                    >
                      Bu belge başka bir hesapta da yüklendi: {reuse}
                    </p>
                  ) : null}

                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 t-body">
                    <dt className="text-ink-3">Kaynak</dt>
                    <dd className="text-ink">{SOURCE_LABEL[item.source] ?? item.source}</dd>
                    <dt className="text-ink-3">Ad soyad eşleşti</dt>
                    <dd className="text-ink">{item.nameMatch ? "Evet" : "Hayır"}</dd>
                    <dt className="text-ink-3">Yapay zeka</dt>
                    <dd className="text-ink">
                      {item.aiUsed
                        ? `Kullanıldı${item.aiModel ? ` (${item.aiModel})` : ""}${
                            item.aiConfidence != null
                              ? `, güven %${Math.round(item.aiConfidence * 100)}`
                              : ""
                          }`
                        : "Kullanılmadı"}
                    </dd>
                  </dl>

                  {item.aiSummary ? (
                    <p className="t-body t-prose text-ink-2">{item.aiSummary}</p>
                  ) : null}

                  {redFlags.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="t-label text-warn">Dikkat edilecekler</p>
                      <ul className="flex list-disc flex-col gap-1 pl-5 t-body text-ink-2">
                        {redFlags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <details className="rounded-control border border-line bg-surface-2 p-3">
                    <summary className="t-label min-h-11 cursor-pointer text-ink">Maskeli metni göster</summary>
                    {item.maskedText ? (
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans t-meta text-ink-2">
                        {item.maskedText}
                      </pre>
                    ) : (
                      <p className="mt-2 t-meta text-ink-3">
                        Maskeli metnin saklama süresi dolduğu için silinmiş.
                      </p>
                    )}
                  </details>

                  {ownDocument ? (
                    <p className="rounded-control bg-surface-2 p-3 t-body text-ink-2">
                      Bu belge senin. Başka bir yönetici incelemeli.
                    </p>
                  ) : (
                    <ReviewForm attemptId={item.id} defaults={toDefaults(profile)} />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
