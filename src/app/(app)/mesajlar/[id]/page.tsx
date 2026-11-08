import { notFound } from "next/navigation";
import { Chat } from "@/components/messaging/chat";
import { requireVerified } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getConversationForUser, markRead } from "@/lib/messaging/service";
import { displayName } from "@/lib/permissions";

export const metadata = { title: "Sohbet" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVerified(`/mesajlar/${encodeURIComponent(id)}`);

  const detail = await getConversationForUser(user.id, id);
  if (!detail) notFound();

  await markRead(user.id, id);

  const ownBlock = await db.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: detail.other.id } },
    select: { blockerId: true },
  });

  return (
    <Chat
      conversationId={detail.id}
      other={{
        id: detail.other.id,
        username: detail.other.username,
        name: displayName(detail.other, user),
        avatarPath: detail.other.avatarPath,
        disciplineGroup: detail.other.disciplineGroup,
      }}
      initialStatus={detail.status}
      isInitiator={detail.isInitiator}
      blocked={detail.blocked}
      blockedByViewer={ownBlock !== null}
      initialMessages={detail.messages}
      renderedAt={new Date().toISOString()}
    />
  );
}
