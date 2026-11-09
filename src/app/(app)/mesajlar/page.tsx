import { ConversationItem, RequestItem } from "@/components/messaging/conversation-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requireVerified } from "@/lib/auth/guards";
import { listConversations } from "@/lib/messaging/service";

export const metadata = { title: "Mesajlarım" };

export default async function Page({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const user = await requireVerified("/mesajlar");
  const { sekme } = await searchParams;
  const tab = sekme === "istekler" ? "istekler" : "sohbetler";

  const [chats, requests] = await Promise.all([
    listConversations(user.id, "chats"),
    listConversations(user.id, "requests"),
  ]);

  return (
    <div data-wide className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Mesajlarım" />
        <Tabs
          label="Mesaj sekmeleri"
          basePath="/mesajlar"
          active={tab}
          items={[
            { value: "sohbetler", label: "Sohbetler" },
            { value: "istekler", label: "İstekler", count: requests.length },
          ]}
        />

        {tab === "sohbetler" ? (
          chats.length === 0 ? (
            <EmptyState
              title="Henüz mesajın yok."
              text="Bir profile girip mesaj gönderebilirsin."
              action={<ButtonLink href="/network?sekme=tanistirmalar" variant="secondary">Kişileri keşfet</ButtonLink>}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line pt-2">
              {chats.map((row) => (
                <ConversationItem key={row.id} row={row} viewer={user} />
              ))}
            </ul>
          )
        ) : requests.length === 0 ? (
          <EmptyState title="Bekleyen mesaj isteğin yok." />
        ) : (
          <ul className="flex flex-col divide-y divide-line pt-2">
            {requests.map((row) => (
              <RequestItem key={row.id} row={row} viewer={user} />
            ))}
          </ul>
        )}
      </div>
      <div
        aria-hidden="true"
        className="sticky top-[84px] hidden h-[calc(100dvh-60px-72px)] items-center justify-center rounded-card border border-dashed border-line lg:flex"
      >
        <p className="t-body text-ink-3">Okumak için soldan bir sohbet seç.</p>
      </div>
    </div>
  );
}
