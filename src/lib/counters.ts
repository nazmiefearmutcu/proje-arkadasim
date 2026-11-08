import { db } from "@/lib/db";
import { blockedUserIds } from "@/lib/messaging/service";

export interface Counters {
  /** Okunmamış bildirim sayısı. */
  notifications: number;
  /** Okunmamış mesajı olan etkin sohbet sayısı (en fazla 50 sohbet taranır). */
  messages: number;
  /** Kullanıcının aldığı, henüz yanıtlanmamış mesaj istekleri. */
  requests: number;
  /** Bekleyen proje davetleri. */
  invites: number;
}

const MAX_CONVERSATIONS_SCANNED = 50;

/**
 * Üst bar ve alt menü rozetleri için sayılar.
 * - notifications: readAt boş bildirimler.
 * - invites: kullanıcıya gelen PENDING davetler.
 * - requests: REQUEST sohbetleri, kullanıcı alıcıysa (başlatan o değilse).
 * - messages: etkin sohbetlerden, karşı tarafın son okunma zamanından sonra mesajı olanlar.
 *   Okuma kaydı yoksa karşı tarafın her mesajı okunmamış sayılır.
 * Engel ilişkisi olan kişilerle sohbetler (iki yön) sayılmaz: rozet, `/mesajlar` listesinin gösterdiğini sayar.
 */
export async function getCounters(userId: string): Promise<Counters> {
  const blockedIds = await blockedUserIds(userId);
  const participant = {
    OR: [{ userAId: userId }, { userBId: userId }],
    userAId: { notIn: blockedIds },
    userBId: { notIn: blockedIds },
  };

  const [notifications, invites, requests, conversations] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.projectInvite.count({ where: { inviteeId: userId, status: "PENDING" } }),
    db.conversation.count({
      where: { status: "REQUEST", initiatorId: { not: userId }, ...participant },
    }),
    db.conversation.findMany({
      where: { status: "ACTIVE", ...participant },
      orderBy: { lastMessageAt: "desc" },
      take: MAX_CONVERSATIONS_SCANNED,
      select: {
        id: true,
        reads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
      },
    }),
  ]);

  const unreadFlags = await Promise.all(
    conversations.map(async (conversation) => {
      const lastReadAt = conversation.reads[0]?.lastReadAt ?? null;
      const unread = await db.message.findFirst({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
        select: { id: true },
      });
      return unread !== null;
    }),
  );

  return {
    notifications,
    messages: unreadFlags.filter(Boolean).length,
    requests,
    invites,
  };
}
