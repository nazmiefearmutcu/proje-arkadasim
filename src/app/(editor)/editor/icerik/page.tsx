import { ShieldCheck } from "lucide-react";
import { ModerationActions } from "@/components/editor/moderation-actions";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORIES, labelOf } from "@/config/taxonomy";
import { adminMetadata } from "@/lib/admin/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { FLAG_LABELS } from "@/lib/moderation/assess";
import type { FlagCode } from "@/lib/moderation/assess";
import type { RemovalReason } from "@/lib/moderation/reasons";
import { REPORTED_LABEL } from "@/lib/moderation/review";
import { relativeTimeTr } from "@/lib/time";

export function generateMetadata() {
  return adminMetadata("İçerik denetimi");
}

type Tab = "bekleyen" | "sikayet" | "son";
const LIMIT = 50;

function flagLabel(code: string): string {
  if (code === "REPORTED") return REPORTED_LABEL;
  return FLAG_LABELS[code as FlagCode] ?? code;
}

/** İşaretlere göre önerilen kaldırma nedeni; editör değiştirebilir. */
function suggestedReason(flags: string[]): RemovalReason | undefined {
  if (flags.includes("PROFANITY")) return "INAPPROPRIATE";
  if (flags.includes("PAID_WORK")) return "RULES";
  if (flags.includes("ADVERTISING") || flags.includes("LINK") || flags.includes("PHONE") || flags.includes("EMAIL")) {
    return "ADVERTISING";
  }
  if (flags.includes("DUPLICATE") || flags.includes("BURST") || flags.includes("REPEATED_CHARS")) return "SPAM";
  return undefined;
}

const projectSelect = {
  id: true,
  title: true,
  summary: true,
  description: true,
  category: true,
  tagsJson: true,
  status: true,
  moderationStatus: true,
  moderationFlagsJson: true,
  moderatedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { username: true, firstName: true, lastName: true, university: true, createdAt: true },
  },
  roles: { orderBy: { id: "asc" as const }, select: { id: true, title: true, description: true, slots: true } },
};

/**
 * İçerik denetimi (spec 2026-11-27 §3). Üç sekme: otomatik denetimin ya da şikayetlerin beklettiği
 * ilanlar, yayında olup şikayet alan ilanlar ve göz gezdirmek için son ilanlar. Editör ilanı burada
 * okur ve tek tıkla onaylar ya da gerekçeyle siler.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const tab: Tab = params.sekme === "sikayet" || params.sekme === "son" ? params.sekme : "bekleyen";

  const openProjectReports = await db.report.findMany({
    where: { targetType: "PROJECT", status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, reason: true, details: true, createdAt: true },
  });
  const reportsByProject = new Map<string, typeof openProjectReports>();
  for (const report of openProjectReports) {
    const list = reportsByProject.get(report.targetId) ?? [];
    list.push(report);
    reportsByProject.set(report.targetId, list);
  }

  const [pendingCount, reportedCount] = await Promise.all([
    db.project.count({ where: { moderationStatus: "PENDING" } }),
    db.project.count({ where: { moderationStatus: "APPROVED", id: { in: [...reportsByProject.keys()] } } }),
  ]);

  const projects =
    tab === "bekleyen"
      ? await db.project.findMany({
          where: { moderationStatus: "PENDING" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: LIMIT,
          select: projectSelect,
        })
      : tab === "sikayet"
        ? await db.project.findMany({
            where: { moderationStatus: "APPROVED", id: { in: [...reportsByProject.keys()] } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: LIMIT,
            select: projectSelect,
          })
        : await db.project.findMany({
            where: { moderationStatus: "APPROVED" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: LIMIT,
            select: projectSelect,
          });

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "bekleyen", label: "Onay bekleyen", count: pendingCount },
    { id: "sikayet", label: "Şikayet edilen", count: reportedCount },
    { id: "son", label: "Son ilanlar" },
  ];

  const empty = {
    bekleyen: { title: "Onay bekleyen ilan yok", text: "Otomatik denetimin ya da şikayetlerin beklettiği ilanlar burada görünür." },
    sikayet: { title: "Şikayet edilen ilan yok", text: "Yayındaki bir ilan şikayet aldığında burada görünür." },
    son: { title: "Henüz ilan yok", text: "Yayınlanan ilanlar burada en yenisi üstte listelenir." },
  }[tab];

  return (
    <>
      <PageHeader
        title="İçerik denetimi"
        description="Şüpheli, spam, reklam ya da kurallara aykırı ilanları onayla veya kaldır."
      />

      <nav aria-label="İlan listeleri" className="flex flex-wrap gap-2 pb-4">
        {tabs.map((item) => (
          <Chip key={item.id} href={item.id === "bekleyen" ? "/editor/icerik" : `/editor/icerik?sekme=${item.id}`} selected={tab === item.id}>
            {item.label}
            {item.count ? <span className="font-mono text-[12px] tabular-nums">{item.count}</span> : null}
          </Chip>
        ))}
      </nav>

      {projects.length === 0 ? (
        <EmptyState icon={<ShieldCheck aria-hidden="true" className="size-6" />} title={empty.title} text={empty.text} />
      ) : (
        <ul className="flex flex-col gap-4">
          {projects.map((project) => {
            const flags = parseList(project.moderationFlagsJson);
            const reports = reportsByProject.get(project.id) ?? [];
            const tags = parseList(project.tagsJson);
            const owner = project.owner;
            return (
              <li key={project.id}>
                <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 t-meta text-ink-3">
                    <span>
                      @{owner.username} · {owner.firstName} {owner.lastName}
                      {owner.university ? ` · ${owner.university}` : ""}
                    </span>
                    <span className="font-mono">{relativeTimeTr(project.createdAt)}</span>
                    {project.updatedAt.getTime() - project.createdAt.getTime() > 60_000 ? (
                      <span>düzenlendi {relativeTimeTr(project.updatedAt)}</span>
                    ) : null}
                    <span>hesap {relativeTimeTr(owner.createdAt)} açıldı</span>
                  </div>

                  <h2 className="t-card text-ink">{project.title}</h2>

                  {flags.length > 0 || reports.length > 0 ? (
                    <ul aria-label="Denetim işaretleri" className="flex flex-wrap gap-1.5">
                      {flags.map((flag) => (
                        <li key={flag} className="rounded-chip border border-danger/30 bg-danger/[0.06] px-2 py-1 t-meta font-[600] text-danger">
                          {flagLabel(flag)}
                        </li>
                      ))}
                      {reports.length > 0 ? (
                        <li className="rounded-chip border border-line bg-surface-2 px-2 py-1 t-meta font-[600] text-ink-2">
                          {reports.length} açık şikayet
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  <p className="t-body t-prose text-ink-2">{project.summary}</p>

                  <details className="group rounded-control border border-line bg-surface-2">
                    <summary className="min-h-11 cursor-pointer px-3 py-2.5 t-label text-ink">İlanın tamamını oku</summary>
                    <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
                      <p className="t-meta text-ink-3">{labelOf(CATEGORIES, project.category) ?? project.category}</p>
                      <p className="t-body t-prose whitespace-pre-line break-words text-ink">{project.description}</p>
                      {project.roles.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="t-meta text-ink-3">Aranan beceriler</p>
                          <ul className="flex flex-col gap-1">
                            {project.roles.map((role) => (
                              <li key={role.id} className="t-body text-ink-2">
                                <span className="font-[600] text-ink">{role.title}</span>
                                {role.description ? ` — ${role.description}` : ""} ({role.slots} kişi)
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {tags.length > 0 ? <p className="t-meta text-ink-3">Etiketler: {tags.join(", ")}</p> : null}
                    </div>
                  </details>

                  {reports.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="t-meta text-ink-3">Şikayetler</p>
                      <ul className="flex flex-col gap-1.5">
                        {reports.slice(0, 5).map((report, index) => (
                          <li key={index} className="t-body text-ink-2">
                            <span className="font-[600] text-ink">{report.reason}</span>
                            {report.details ? ` — ${report.details}` : ""}
                            <span className="font-mono t-meta text-ink-3"> · {relativeTimeTr(report.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ModerationActions
                    projectId={project.id}
                    approveLabel={project.moderationStatus === "PENDING" ? "Onayla ve yayınla" : reports.length > 0 ? "Sorun yok" : "Onayla"}
                    suggestedReason={suggestedReason(flags)}
                  />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
