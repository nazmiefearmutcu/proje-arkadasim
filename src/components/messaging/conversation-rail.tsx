import Link from "next/link";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { Viewer } from "@/lib/permissions";
import { listConversations } from "@/lib/messaging/service";
import { ConversationItem } from "./conversation-list";

/**
 * Masaüstü (lg) mesaj sayfalarının sol paneli: sohbet listesi ve istekler bağlantısı.
 * Telefonda gösterilmez; orada liste /mesajlar sayfasının kendisidir.
 */
export async function ConversationRail({ viewer, activeId }: { viewer: Viewer & { id: string }; activeId?: string }) {
  const [chats, requests] = await Promise.all([
    listConversations(viewer.id, "chats"),
    listConversations(viewer.id, "requests"),
  ]);

  return (
    <aside
      aria-label="Sohbetler"
      className="sticky top-[84px] hidden h-[calc(100dvh-60px-72px)] flex-col overflow-hidden rounded-card border border-line bg-surface lg:flex"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="t-section text-ink">Sohbetler</h2>
        <Link
          href="/mesajlar?sekme=istekler"
          className={cn("rounded-control px-2 py-1 t-meta text-ink-2 hover:text-ink", focusRing)}
        >
          İstekler{requests.length > 0 ? ` (${requests.length})` : ""}
        </Link>
      </div>
      {chats.length === 0 ? (
        <p className="p-4 t-body text-ink-2">Henüz sohbetin yok.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {chats.map((row) => (
            <ConversationItem key={row.id} row={row} viewer={viewer} active={row.id === activeId} compact />
          ))}
        </ul>
      )}
    </aside>
  );
}
