import Link from "next/link";
import { CloseProjectButton } from "@/components/admin/close-project-button";
import { ResolveReportButton } from "@/components/admin/resolve-report-button";
import { RevokeVerificationForm } from "@/components/admin/revoke-verification-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { relativeTimeTr } from "@/lib/time";
import { adminMetadata } from "@/lib/admin/metadata";

export function generateMetadata() {
  return adminMetadata("Şikayetler");
}

const OPEN_LIMIT = 100;
const RESOLVED_LIMIT = 20;
const EXCERPT_LENGTH = 200;

type TargetInfo =
  | { kind: "USER"; username: string | null }
  | { kind: "PROJECT"; id: string; title: string | null }
  | { kind: "MESSAGE"; excerpt: string | null; participants: string[] | null };

function excerpt(body: string): string {
  return body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH)}…` : body;
}

/**
 * Açık şikayetler en yenisi üstte, son çözülenler daraltılmış olarak. Her açılış bir erişim kaydı yazar;
 * mesaj içerikleri yalnızca bu sayfada, yöneticiye gösterilir. Açık şikayette yönetici, doğrulanmış bir
 * hesabın doğrulamasını geri alabilir ya da açık bir projeyi kapatabilir (spec §5.3).
 */
export default async function Page() {
  const admin = await requireAdmin();

  const [openReports, resolvedReports, openTotal] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: OPEN_LIMIT,
    }),
    db.report.findMany({
      where: { status: "RESOLVED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RESOLVED_LIMIT,
    }),
    db.report.count({ where: { status: "OPEN" } }),
  ]);
  const openCapped = openReports.length === OPEN_LIMIT && openTotal > openReports.length;
  await db.adminAuditLog.create({ data: { adminId: admin.id, action: "VIEW_REPORTS" } });

  const all = [...openReports, ...resolvedReports];
  const userIds = new Set<string>();
  const projectIds = new Set<string>();
  const messageIds = new Set<string>();
  for (const report of all) {
    if (report.reporterId) userIds.add(report.reporterId);
    if (report.targetType === "USER") userIds.add(report.targetId);
    if (report.targetType === "PROJECT") projectIds.add(report.targetId);
    if (report.targetType === "MESSAGE") messageIds.add(report.targetId);
  }

  const [users, projects, messages] = await Promise.all([
    userIds.size
      ? db.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, username: true, firstName: true, lastName: true, verificationStatus: true },
        })
      : Promise.resolve([]),
    projectIds.size
      ? db.project.findMany({
          where: { id: { in: [...projectIds] } },
          select: { id: true, title: true, status: true },
        })
      : Promise.resolve([]),
    messageIds.size
      ? db.message.findMany({
          where: { id: { in: [...messageIds] } },
          select: {
            id: true,
            body: true,
            conversation: {
              select: {
                userA: { select: { username: true } },
                userB: { select: { username: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const messageById = new Map(messages.map((message) => [message.id, message]));

  function targetInfo(type: string, id: string): TargetInfo | null {
    if (type === "USER") {
      return { kind: "USER", username: userById.get(id)?.username ?? null };
    }
    if (type === "PROJECT") {
      const project = projectById.get(id);
      return { kind: "PROJECT", id, title: project?.title ?? null };
    }
    if (type === "MESSAGE") {
      const message = messageById.get(id);
      if (!message) return { kind: "MESSAGE", excerpt: null, participants: null };
      return {
        kind: "MESSAGE",
        excerpt: excerpt(message.body),
        participants: [
          message.conversation.userA.username,
          message.conversation.userB.username,
        ],
      };
    }
    return null;
  }

  function renderTarget(type: string, id: string) {
    const info = targetInfo(type, id);
    if (!info) return <p className="t-body text-ink-2">Bilinmeyen hedef</p>;

    if (info.kind === "USER") {
      const user = userById.get(id);
      if (!user) return <p className="t-body text-ink-3">Hesap silinmiş</p>;
      return (
        <Link href={`/u/${user.username}`} className="t-label text-pen underline underline-offset-2">
          @{user.username}
        </Link>
      );
    }

    if (info.kind === "PROJECT") {
      if (!info.title) return <p className="t-body text-ink-3">Proje silinmiş</p>;
      return (
        <Link href={`/projeler/${info.id}`} className="t-label text-pen underline underline-offset-2">
          {info.title}
        </Link>
      );
    }

    if (!info.excerpt || !info.participants) {
      return <p className="t-body text-ink-3">Mesaj silinmiş</p>;
    }
    return (
      <div className="flex flex-col gap-1.5">
        <p className="t-meta text-ink-3">
          @{info.participants[0]} ve @{info.participants[1]} arasındaki mesaj
        </p>
        <blockquote className="rounded-control bg-surface-2 p-3 t-body text-ink-2 break-words">
          {info.excerpt}
        </blockquote>
      </div>
    );
  }

  /** Açık şikayetteki yönetim eylemi: doğrulanmış hesapta geri alma, açık projede kapatma. */
  function renderModeration(type: string, id: string) {
    if (type === "USER") {
      const user = userById.get(id);
      // Yönetici kendi doğrulamasını geri alamaz; eylem sunucuda da reddedilir.
      if (!user || user.verificationStatus !== "VERIFIED" || user.id === admin.id) return null;
      return <RevokeVerificationForm userId={user.id} username={user.username} />;
    }
    if (type === "PROJECT") {
      const project = projectById.get(id);
      if (!project || project.status !== "OPEN") return null;
      return <CloseProjectButton projectId={project.id} />;
    }
    return null;
  }

  function renderReporter(reporterId: string | null) {
    if (!reporterId) return "Hesap silinmiş";
    const reporter = userById.get(reporterId);
    return reporter ? `@${reporter.username}` : "Hesap silinmiş";
  }

  const targetTypeLabel: Record<string, string> = {
    USER: "Kullanıcı",
    PROJECT: "Proje",
    MESSAGE: "Mesaj",
  };

  return (
    <>
      <PageHeader title="Şikayetler" />

      <Section title={`Açık şikayetler (${openTotal})`}>
        {openCapped ? (
          <p className="t-meta text-ink-3">En yeni {openReports.length} şikayet gösteriliyor.</p>
        ) : null}
        {openReports.length === 0 ? (
          <EmptyState title="Açık şikayet yok" text="Yeni bir şikayet geldiğinde burada görünür." />
        ) : (
          <ul className="flex flex-col gap-4">
            {openReports.map((report) => (
              <li key={report.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-control bg-surface-2 px-2 py-0.5 t-meta text-ink-2">
                      {targetTypeLabel[report.targetType] ?? report.targetType}
                    </span>
                    <span className="rounded-control bg-surface-2 px-2 py-0.5 t-meta text-ink-3">
                      {relativeTimeTr(report.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="t-meta text-ink-3">Hedef</p>
                    {renderTarget(report.targetType, report.targetId)}
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 t-body">
                    <dt className="text-ink-3">Bildiren</dt>
                    <dd className="text-ink">{renderReporter(report.reporterId)}</dd>
                    <dt className="text-ink-3">Neden</dt>
                    <dd className="text-ink">{report.reason}</dd>
                  </dl>
                  {report.details ? (
                    <p className="t-body t-prose whitespace-pre-line text-ink-2">{report.details}</p>
                  ) : null}
                  {renderModeration(report.targetType, report.targetId)}
                  <ResolveReportButton reportId={report.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {resolvedReports.length > 0 ? (
        <Section>
          <details className="rounded-card border border-line bg-surface p-4">
            <summary className="t-label min-h-11 cursor-pointer text-ink">
              Çözülen şikayetler (son {resolvedReports.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {resolvedReports.map((report) => (
                <li key={report.id} className="flex flex-col gap-1 border-t border-line pt-3">
                  <p className="t-meta text-ink-2">{targetTypeLabel[report.targetType] ?? report.targetType}</p>
                  <p className="t-meta text-ink-3">{relativeTimeTr(report.createdAt)}</p>
                  {renderTarget(report.targetType, report.targetId)}
                  <p className="t-body text-ink-2">{report.reason}</p>
                </li>
              ))}
            </ul>
          </details>
        </Section>
      ) : null}
    </>
  );
}
