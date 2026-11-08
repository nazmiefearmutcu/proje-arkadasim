import { BadgeCheck, FolderOpen, Handshake, Mail, MessageSquare, UserCheck, UserPlus, UserX, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { focusRing } from "@/components/ui/styles";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { markAllReadAction } from "@/lib/notifications/actions";
import { formatNotification, type NotificationIcon } from "@/lib/notifications/format";
import { groupNotifications } from "@/lib/notifications/group";
import { relativeTimeTr } from "@/lib/time";

export const metadata = { title: "Bildirimler" };

const PAGE_SIZE = 30;

const ICONS: Record<NotificationIcon, LucideIcon> = {
  follow: UserPlus,
  request: Users,
  accepted: UserCheck,
  rejected: UserX,
  invite: Mail,
  message: MessageSquare,
  verification: BadgeCheck,
  intro: Handshake,
  project: FolderOpen,
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1;
}

function parseData(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/bildirimler");
  const page = parsePage((await searchParams).sayfa);

  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      type: true,
      dataJson: true,
      conversationId: true,
      readAt: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true, username: true } },
      project: { select: { id: true, title: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const now = new Date();
  const items = rows.slice(0, PAGE_SIZE).map((row) => {
    const formatted = formatNotification({
      type: row.type,
      data: parseData(row.dataJson),
      actor: row.actor,
      project: row.project,
      conversationId: row.conversationId,
    });
    return {
      id: row.id,
      unread: row.readAt === null,
      createdAt: row.createdAt,
      ...formatted,
    };
  });
  const groups = groupNotifications(items, now);

  return (
    <>
      <PageHeader
        title="Bildirimler"
        right={
          <form
            action={async () => {
              "use server";
              await markAllReadAction();
            }}
          >
            <Button type="submit" variant="ghost" size="md">
              Tümünü okundu yap
            </Button>
          </form>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Henüz bildirimin yok."
          text="Takip ettiğin kişiler proje paylaştığında burada göreceksin."
          action={
            <ButtonLink href="/projeler" variant="secondary">
              Projelere göz at
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="flex flex-col gap-1">
              <h2 className="t-meta pb-1 text-ink-3">{group.label}</h2>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const verification = item.icon === "verification";
                  return (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <Link
                        href={`/bildirimler/git/${item.id}`}
                        className={cn("flex min-h-14 items-center gap-3 rounded-control py-3", focusRing)}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                            verification ? "bg-stamp-soft text-stamp" : "bg-pen-soft text-pen",
                          )}
                        >
                          <Icon strokeWidth={1.75} className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={cn("t-body", item.unread ? "font-semibold text-ink" : "text-ink-2")}>
                            {item.unread ? <span className="sr-only">Okunmadı: </span> : null}
                            {item.text}
                          </span>
                          <span className="t-meta text-ink-3">{relativeTimeTr(item.createdAt, now)}</span>
                        </span>
                        {item.unread ? (
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-pen" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore ? (
        <ButtonLink href={`/bildirimler?sayfa=${page + 1}`} variant="secondary" className="mt-4 w-full">
          Daha fazla göster
        </ButtonLink>
      ) : null}
    </>
  );
}
