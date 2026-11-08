import { db } from "@/lib/db";
import { isBlockedEitherWay } from "@/lib/permissions";

export type NotificationType =
  | "FOLLOW"
  | "JOIN_REQUEST"
  | "JOIN_ACCEPTED"
  | "JOIN_REJECTED"
  | "INVITE"
  | "INVITE_ACCEPTED"
  | "INVITE_DECLINED"
  | "MESSAGE_REQUEST"
  | "MESSAGE_REQUEST_ACCEPTED"
  | "VERIFICATION_RESULT"
  | "INTRODUCTION"
  | "NEW_PROJECT_FROM_FOLLOWING";

export interface NotifyPayload {
  type: NotificationType;
  actorId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  data?: Record<string, unknown>;
}

export interface NotifyInput extends NotifyPayload {
  userId: string;
}

function rowFor(userId: string, payload: NotifyPayload) {
  return {
    userId,
    type: payload.type,
    actorId: payload.actorId ?? null,
    projectId: payload.projectId ?? null,
    conversationId: payload.conversationId ?? null,
    dataJson: JSON.stringify(payload.data ?? {}),
  };
}

/**
 * Tek bildirim oluşturur. Kendine bildirim atılmaz; aktör varsa ve taraflardan biri
 * diğerini engellemişse bildirim atılmaz.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const { userId, ...payload } = input;
  if (payload.actorId && payload.actorId === userId) return;
  if (payload.actorId && (await isBlockedEitherWay(userId, payload.actorId))) return;

  await db.notification.create({ data: rowFor(userId, payload) });
}

/**
 * Birden çok kullanıcıya tek seferde bildirim yazar. Tekrarları, aktörü ve aktörle
 * engel ilişkisi olanları eler.
 */
export async function notifyMany(userIds: string[], input: NotifyPayload): Promise<void> {
  const unique = [...new Set(userIds)].filter((id) => id !== input.actorId);
  if (unique.length === 0) return;

  let recipients = unique;
  if (input.actorId) {
    const actorId = input.actorId;
    const blocks = await db.block.findMany({
      where: {
        OR: [
          { blockerId: actorId, blockedId: { in: unique } },
          { blockedId: actorId, blockerId: { in: unique } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });
    const blocked = new Set(
      blocks.map((block) => (block.blockerId === actorId ? block.blockedId : block.blockerId)),
    );
    recipients = unique.filter((id) => !blocked.has(id));
  }

  if (recipients.length === 0) return;

  await db.notification.createMany({
    data: recipients.map((id) => rowFor(id, input)),
  });
}
