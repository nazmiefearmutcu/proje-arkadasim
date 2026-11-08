import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { displayName, type Viewer } from "@/lib/permissions";
import type { ConversationRow } from "@/lib/messaging/service";
import { relativeTimeTr } from "@/lib/time";
import { RequestActions } from "./request-actions";

/** Sohbet satırı: avatar, ad, önizleme, zaman. Okunmamışsa ad kalın ve tükenmez noktası görünür. */
export function ConversationItem({ row, viewer }: { row: ConversationRow; viewer: Viewer }) {
  const name = displayName(row.other, viewer);
  const pendingRequest = row.status !== "ACTIVE" && row.isInitiator;

  return (
    <li>
      <Link
        href={`/mesajlar/${row.id}`}
        className={cn("flex min-h-16 items-center gap-3 py-3 rounded-card", focusRing)}
      >
        <Avatar
          size={48}
          name={name}
          seed={row.other.username}
          avatarPath={row.other.avatarPath}
          disciplineGroup={row.other.disciplineGroup}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("t-label min-w-0 truncate text-ink", row.unread && "font-[700]")}>{name}</span>
            {row.unread ? (
              <span aria-label="Okunmamış mesaj" className="size-2.5 shrink-0 rounded-full bg-pen" />
            ) : null}
          </div>
          {row.preview ? <p className="t-meta truncate text-ink-2">{row.preview}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.lastMessageAt ? (
            <time dateTime={row.lastMessageAt.toISOString()} className="t-meta text-ink-3">
              {relativeTimeTr(row.lastMessageAt)}
            </time>
          ) : null}
          {pendingRequest ? <Chip>İstek gönderildi</Chip> : null}
        </div>
      </Link>
    </li>
  );
}

/** Gelen istek satırı: ilk mesajın tamamı (en çok üç satır) ve Kabul / Reddet. */
export function RequestItem({ row, viewer }: { row: ConversationRow; viewer: Viewer }) {
  const name = displayName(row.other, viewer);

  return (
    <li className="flex flex-col gap-3 py-4">
      <Link href={`/mesajlar/${row.id}`} className={cn("flex min-w-0 items-center gap-3 rounded-card", focusRing)}>
        <Avatar
          size={48}
          name={name}
          seed={row.other.username}
          avatarPath={row.other.avatarPath}
          disciplineGroup={row.other.disciplineGroup}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="t-label truncate text-ink">{name}</span>
          {row.lastMessageAt ? (
            <time dateTime={row.lastMessageAt.toISOString()} className="t-meta text-ink-3">
              {relativeTimeTr(row.lastMessageAt)}
            </time>
          ) : null}
        </div>
      </Link>
      {row.latestBody ? <p className="t-body line-clamp-3 whitespace-pre-line text-ink-2">{row.latestBody}</p> : null}
      <RequestActions conversationId={row.id} />
    </li>
  );
}
