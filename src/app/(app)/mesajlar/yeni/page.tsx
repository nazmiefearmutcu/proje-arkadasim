import { notFound, redirect } from "next/navigation";
import { StartForm } from "@/components/messaging/start-form";
import { UserRow } from "@/components/common/user-row";
import { PageHeader } from "@/components/ui/page-header";
import { requireVerified } from "@/lib/auth/guards";
import { toPersonSummary, personSummarySelect } from "@/lib/dto";
import { db } from "@/lib/db";
import { canMessageDirectly, displayName, isBlockedEitherWay } from "@/lib/permissions";
import { findConversation } from "@/lib/messaging/service";

export const metadata = { title: "Yeni mesaj" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kime?: string }> }) {
  const { kime } = await searchParams;
  const username = (kime ?? "").trim();
  const next = username ? `/mesajlar/yeni?kime=${encodeURIComponent(username)}` : "/mesajlar";
  const user = await requireVerified(next);
  if (!username) redirect("/mesajlar");

  const recipient = await db.user.findUnique({
    where: { username },
    select: personSummarySelect,
  });
  if (!recipient || recipient.verificationStatus !== "VERIFIED") notFound();
  if (recipient.id === user.id) redirect("/mesajlar");

  const existing = await findConversation(user.id, recipient.id);
  if (existing) redirect(`/mesajlar/${existing.id}`);

  const blocked = await isBlockedEitherWay(user.id, recipient.id);
  const direct = !blocked && (await canMessageDirectly(user.id, recipient.id));
  const person = toPersonSummary(recipient);

  return (
    <>
      <PageHeader title="Yeni mesaj" />
      <UserRow person={person} name={displayName(recipient, user)} />

      {blocked ? (
        <p className="t-body t-prose pt-4 text-ink-2">Bu kişiye mesaj gönderemezsin.</p>
      ) : (
        <div className="flex flex-col gap-4 pt-4">
          {direct ? null : (
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="t-body t-prose text-ink-2">
                Bu kişiyi karşılıklı takip etmediğin ve aynı projede olmadığın için mesajın istek olarak gidecek. Kabul
                edilene kadar tek mesaj gönderebilirsin; kendini ve projeni kısaca anlat.
              </p>
            </div>
          )}
          <StartForm recipientUsername={recipient.username} />
        </div>
      )}
    </>
  );
}
