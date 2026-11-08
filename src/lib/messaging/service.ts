import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { canMessageDirectly, isBlockedEitherWay } from "@/lib/permissions";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { personSummarySelect, toPersonSummary, type PersonSummary } from "@/lib/dto";
import {
  MESSAGES_PER_PAGE,
  MESSAGES_PER_POLL,
  normalizeBody,
  previewText,
  type ConversationKind,
  type ConversationStatus,
  type MessageDTO,
} from "./types";

export const MSG_BLOCKED = "Bu kişiye mesaj gönderemezsin.";
export const MSG_NOT_FOUND = "Kullanıcı bulunamadı.";
export const MSG_SELF = "Kendine mesaj gönderemezsin.";
export const MSG_BODY = "Mesaj 1 ile 2000 karakter arasında olmalı.";
export const MSG_CONVERSATION_NOT_FOUND = "Sohbet bulunamadı.";
export const MSG_PENDING = "İsteğin kabul edilene kadar yeni mesaj gönderemezsin.";
export const MSG_MUST_ACCEPT = "Önce mesaj isteğini kabul et.";
export const MSG_DECLINED_BY_YOU = "Bu isteği reddettin.";
export const MSG_RATE_LIMIT = "Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene.";

/** Kullanıcı kimliklerini sıralı çift olarak döner: `userAId < userBId`. */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** İki kullanıcı arasındaki sohbet (sıra bağımsız). Yoksa null. */
export async function findConversation(a: string, b: string) {
  const [userAId, userBId] = pairKey(a, b);
  return db.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
}

function toMessageDTO(row: { id: string; body: string; createdAt: Date; senderId: string }, viewerId: string): MessageDTO {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    mine: row.senderId === viewerId,
  };
}

const participantSelect = {
  id: true,
  userAId: true,
  userBId: true,
  initiatorId: true,
  status: true,
} as const;

/** Kullanıcı sohbetin katılımcısıysa sohbet satırını döner; değilse null. */
async function participantConversation(userId: string, conversationId: string) {
  return db.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: participantSelect,
  });
}

function otherParticipantId(conversation: { userAId: string; userBId: string }, userId: string): string {
  return conversation.userAId === userId ? conversation.userBId : conversation.userAId;
}

/** Ortak yazma: mesajı ekler, sohbetin son mesaj zamanını ve gönderenin okuma kaydını günceller. */
async function writeMessage(
  conversationId: string,
  senderId: string,
  body: string,
  now: Date,
): Promise<MessageDTO> {
  const row = await db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId, body, createdAt: now },
      select: { id: true, body: true, createdAt: true, senderId: true },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      create: { conversationId, userId: senderId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return message;
  });
  return toMessageDTO(row, senderId);
}

/**
 * Yeni sohbet açar ya da var olan sohbete mesaj gönderir.
 * Karşılıklı takip veya ortak proje varsa sohbet ACTIVE olur; aksi halde REQUEST ve alıcıya bildirim.
 */
export async function startConversation(
  senderId: string,
  recipientUsername: string,
  body: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const text = normalizeBody(body);
  if (text === null) return fail(MSG_BODY);

  const limit = rateLimit(`message:${senderId}`, LIMITS.message[0], LIMITS.message[1]);
  if (!limit.ok) return fail(MSG_RATE_LIMIT);

  const recipient = await db.user.findUnique({
    where: { username: recipientUsername },
    select: { id: true, verificationStatus: true },
  });
  if (!recipient || recipient.verificationStatus !== "VERIFIED") return fail(MSG_NOT_FOUND);
  if (recipient.id === senderId) return fail(MSG_SELF);
  if (await isBlockedEitherWay(senderId, recipient.id)) return fail(MSG_BLOCKED);

  const existing = await findConversation(senderId, recipient.id);
  if (existing) {
    const sent = await deliver(senderId, existing.id, text);
    if (!sent.ok) return sent;
    return ok({ conversationId: existing.id });
  }

  const direct = await canMessageDirectly(senderId, recipient.id);
  const status: ConversationStatus = direct ? "ACTIVE" : "REQUEST";
  const [userAId, userBId] = pairKey(senderId, recipient.id);
  const now = new Date();

  let conversationId: string;
  try {
    const conversation = await db.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          userAId,
          userBId,
          initiatorId: senderId,
          status,
          lastMessageAt: now,
          createdAt: now,
        },
        select: { id: true },
      });
      await tx.message.create({
        data: { conversationId: created.id, senderId, body: text, createdAt: now },
      });
      await tx.conversationRead.create({
        data: { conversationId: created.id, userId: senderId, lastReadAt: now },
      });
      return created;
    });
    conversationId = conversation.id;
  } catch (error) {
    // Aynı çift aynı anda iki kez açılırsa ikinci istek var olan sohbete mesaj olarak düşer.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await findConversation(senderId, recipient.id);
      if (raced) {
        const sent = await deliver(senderId, raced.id, text);
        if (!sent.ok) return sent;
        return ok({ conversationId: raced.id });
      }
    }
    throw error;
  }

  if (status === "REQUEST") {
    await notify({
      userId: recipient.id,
      type: "MESSAGE_REQUEST",
      actorId: senderId,
      conversationId,
    });
  }

  return ok({ conversationId });
}

/**
 * Sohbete mesaj gönderir (hız sınırı dahil). REQUEST/DECLINED sohbet, karşılıklı takip ya da ortak
 * proje oluştuysa önce ACTIVE'e yükseltilir. Kuralların ayrıntısı spec §4.7'dedir.
 */
export async function sendMessage(
  senderId: string,
  conversationId: string,
  body: string,
): Promise<ActionResult<MessageDTO>> {
  const text = normalizeBody(body);
  if (text === null) return fail(MSG_BODY);

  const limit = rateLimit(`message:${senderId}`, LIMITS.message[0], LIMITS.message[1]);
  if (!limit.ok) return fail(MSG_RATE_LIMIT);

  return deliver(senderId, conversationId, text);
}

/** Hız sınırı olmayan gönderim. `startConversation` ve `sendMessage` buradan geçer. */
async function deliver(senderId: string, conversationId: string, text: string): Promise<ActionResult<MessageDTO>> {
  const conversation = await participantConversation(senderId, conversationId);
  if (!conversation) return fail(MSG_CONVERSATION_NOT_FOUND);

  const otherId = otherParticipantId(conversation, senderId);
  if (await isBlockedEitherWay(senderId, otherId)) return fail(MSG_BLOCKED);

  let status = conversation.status as ConversationStatus;
  if ((status === "REQUEST" || status === "DECLINED") && (await canMessageDirectly(senderId, otherId))) {
    await db.conversation.update({ where: { id: conversation.id }, data: { status: "ACTIVE" } });
    status = "ACTIVE";
  }

  const isInitiator = conversation.initiatorId === senderId;
  if (status === "REQUEST") {
    if (isInitiator) return fail(MSG_PENDING);
    return fail(MSG_MUST_ACCEPT);
  }
  if (status === "DECLINED") {
    // Reddi gönderene göstermemek için başlatan, alıcıyla aynı "bekliyor" mesajını alır.
    if (isInitiator) return fail(MSG_PENDING);
    return fail(MSG_DECLINED_BY_YOU);
  }

  const message = await writeMessage(conversation.id, senderId, text, new Date());
  return ok(message);
}

/**
 * Alıcı isteği kabul eder: REQUEST → ACTIVE. Başlatana bildirim gider.
 * Engel varsa kabul edilemez; reddetme engelden bağımsız çalışır.
 */
export async function acceptRequest(userId: string, conversationId: string): Promise<ActionResult> {
  const conversation = await participantConversation(userId, conversationId);
  if (!conversation) return fail(MSG_CONVERSATION_NOT_FOUND);
  if (conversation.status !== "REQUEST" || conversation.initiatorId === userId) {
    return fail("Bu istek artık kabul edilemez.");
  }

  const otherId = otherParticipantId(conversation, userId);
  if (await isBlockedEitherWay(userId, otherId)) return fail(MSG_BLOCKED);

  const updated = await db.conversation.updateMany({
    where: { id: conversation.id, status: "REQUEST" },
    data: { status: "ACTIVE" },
  });
  if (updated.count === 0) return fail("Bu istek artık kabul edilemez.");

  await notify({
    userId: conversation.initiatorId,
    type: "MESSAGE_REQUEST_ACCEPTED",
    actorId: userId,
    conversationId: conversation.id,
  });
  return ok();
}

/** Alıcı isteği reddeder: REQUEST → DECLINED. Bildirim gitmez; gönderen durumu görmeye devam eder. */
export async function declineRequest(userId: string, conversationId: string): Promise<ActionResult> {
  const conversation = await participantConversation(userId, conversationId);
  if (!conversation) return fail(MSG_CONVERSATION_NOT_FOUND);
  if (conversation.status !== "REQUEST" || conversation.initiatorId === userId) {
    return fail("Bu istek artık reddedilemez.");
  }

  const updated = await db.conversation.updateMany({
    where: { id: conversation.id, status: "REQUEST" },
    data: { status: "DECLINED" },
  });
  if (updated.count === 0) return fail("Bu istek artık reddedilemez.");
  return ok();
}

export interface ConversationRow {
  id: string;
  other: PersonSummary;
  status: ConversationStatus;
  isInitiator: boolean;
  /** Önizleme: kırpılmış, kendi mesajıysa "Sen: " önekli. Mesaj yoksa null. */
  preview: string | null;
  /** Son mesajın tam metni (istek sekmesinde ilk mesaj olarak gösterilir). */
  latestBody: string | null;
  lastMessageAt: Date | null;
  unread: boolean;
}

async function blockedUserIds(userId: string): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(blocks.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId)))];
}

/**
 * Sohbet listesi.
 * - chats: ACTIVE sohbetler ve kullanıcının başlattığı REQUEST/DECLINED sohbetler.
 * - requests: kullanıcının alıcı olduğu REQUEST sohbetleri.
 * Engelli kişilerle olan sohbetler çıkmaz. Okunmamış: ACTIVE ve karşı tarafın mesajı okuma zamanından sonra.
 */
export async function listConversations(userId: string, kind: ConversationKind): Promise<ConversationRow[]> {
  const blockedIds = await blockedUserIds(userId);
  const kindFilter =
    kind === "requests"
      ? { status: "REQUEST", initiatorId: { not: userId } }
      : {
          OR: [
            { status: "ACTIVE" },
            { status: { in: ["REQUEST", "DECLINED"] }, initiatorId: userId },
          ],
        };

  const rows = await db.conversation.findMany({
    where: {
      AND: [
        { OR: [{ userAId: userId }, { userBId: userId }] },
        kindFilter,
        { userAId: { notIn: blockedIds } },
        { userBId: { notIn: blockedIds } },
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      status: true,
      initiatorId: true,
      lastMessageAt: true,
      userAId: true,
      userBId: true,
      userA: { select: personSummarySelect },
      userB: { select: personSummarySelect },
      reads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true },
      },
    },
  });

  const ids = rows.map((row) => row.id);
  const latestFromOther =
    ids.length === 0
      ? []
      : await db.message.findMany({
          where: { conversationId: { in: ids }, senderId: { not: userId } },
          orderBy: { createdAt: "desc" },
          distinct: ["conversationId"],
          select: { conversationId: true, createdAt: true },
        });
  const otherAt = new Map(latestFromOther.map((row) => [row.conversationId, row.createdAt]));

  return rows.map((row) => {
    const otherRow = row.userAId === userId ? row.userB : row.userA;
    const last = row.messages[0];
    const lastReadAt = row.reads[0]?.lastReadAt ?? null;
    const otherMessageAt = otherAt.get(row.id) ?? null;
    const unread =
      row.status === "ACTIVE" &&
      otherMessageAt !== null &&
      (lastReadAt === null || otherMessageAt.getTime() > lastReadAt.getTime());

    return {
      id: row.id,
      other: toPersonSummary(otherRow),
      status: row.status as ConversationStatus,
      isInitiator: row.initiatorId === userId,
      preview: last ? previewText(last.body, last.senderId === userId) : null,
      latestBody: last ? last.body : null,
      lastMessageAt: row.lastMessageAt,
      unread,
    };
  });
}

export interface ConversationDetail {
  id: string;
  status: ConversationStatus;
  isInitiator: boolean;
  blocked: boolean;
  other: PersonSummary;
  /** Son 50 mesaj, eskiden yeniye. */
  messages: MessageDTO[];
}

/** Katılımcı için sohbet ayrıntısı. Değilse null. Okundu işaretlemez (bkz. `markRead`). */
export async function getConversationForUser(userId: string, conversationId: string): Promise<ConversationDetail | null> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    select: {
      id: true,
      status: true,
      initiatorId: true,
      userAId: true,
      userBId: true,
      userA: { select: personSummarySelect },
      userB: { select: personSummarySelect },
    },
  });
  if (!conversation) return null;

  const otherRow = conversation.userAId === userId ? conversation.userB : conversation.userA;
  const recent = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PER_PAGE,
    select: { id: true, body: true, createdAt: true, senderId: true },
  });

  return {
    id: conversation.id,
    status: conversation.status as ConversationStatus,
    isInitiator: conversation.initiatorId === userId,
    blocked: await isBlockedEitherWay(userId, otherRow.id),
    other: toPersonSummary(otherRow),
    messages: recent.reverse().map((row) => toMessageDTO(row, userId)),
  };
}

/**
 * `afterIso` sonrasındaki mesajlar (en çok 100, eskiden yeniye) ve sohbetin durumu.
 * Katılımcı değilse null. Çağrı, katılımcının okuma zamanını şimdiye çeker.
 */
export async function getMessagesAfter(
  userId: string,
  conversationId: string,
  after: Date,
): Promise<{ messages: MessageDTO[]; status: ConversationStatus } | null> {
  const conversation = await participantConversation(userId, conversationId);
  if (!conversation) return null;

  const rows = await db.message.findMany({
    where: { conversationId, createdAt: { gt: after } },
    orderBy: { createdAt: "asc" },
    take: MESSAGES_PER_POLL,
    select: { id: true, body: true, createdAt: true, senderId: true },
  });

  await markRead(userId, conversationId);

  return {
    messages: rows.map((row) => toMessageDTO(row, userId)),
    status: conversation.status as ConversationStatus,
  };
}

/** Kullanıcının okuma zamanını şimdiye çeker. Katılımcı değilse hiçbir şey yapmaz. */
export async function markRead(userId: string, conversationId: string): Promise<void> {
  const conversation = await participantConversation(userId, conversationId);
  if (!conversation) return;

  const now = new Date();
  await db.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}
