import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getCounters } from "@/lib/counters";
import type { ActionResult } from "@/lib/action-result";
import { createUser, resetDb } from "../../../tests/helpers/db";
import {
  MSG_BLOCKED,
  MSG_CONVERSATION_NOT_FOUND,
  MSG_DECLINED_BY_YOU,
  MSG_MUST_ACCEPT,
  MSG_NOT_FOUND,
  MSG_PENDING,
  acceptRequest,
  declineRequest,
  getConversationForUser,
  getMessagesAfter,
  listConversations,
  pairKey,
  sendMessage,
  startConversation,
  visibleStatus,
} from "./service";

function errorOf(result: ActionResult<unknown>): string {
  return result.ok ? "" : result.error;
}

function dataOf<T>(result: ActionResult<T>): T {
  if (!result.ok || result.data === undefined) throw new Error(`beklenmeyen hata: ${errorOf(result)}`);
  return result.data;
}

async function follow(a: string, b: string): Promise<void> {
  await db.follow.create({ data: { followerId: a, followingId: b } });
}

async function sharedProject(...memberIds: string[]): Promise<void> {
  const [ownerId, ...rest] = memberIds;
  const project = await db.project.create({
    data: {
      ownerId,
      title: "Ortak proje",
      summary: "Özet",
      description: "Açıklama",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
    },
  });
  for (const userId of [ownerId, ...rest]) {
    await db.projectMember.create({ data: { projectId: project.id, userId, isOwner: userId === ownerId } });
  }
}

describe("pairKey", () => {
  it("sorts the two ids so the smaller one comes first", () => {
    expect(pairKey("b", "a")).toEqual(["a", "b"]);
    expect(pairKey("a", "b")).toEqual(["a", "b"]);
  });
});

describe("startConversation and sendMessage rules", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("opens an ACTIVE conversation for mutual followers", async () => {
    const a = await createUser();
    const b = await createUser();
    await follow(a.id, b.id);
    await follow(b.id, a.id);

    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));
    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("ACTIVE");
    expect(conversation.initiatorId).toBe(a.id);
  });

  it("opens an ACTIVE conversation for people in the same project", async () => {
    const a = await createUser();
    const b = await createUser();
    await sharedProject(a.id, b.id);

    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));
    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("ACTIVE");
  });

  it("opens a REQUEST for a stranger and notifies the recipient", async () => {
    const a = await createUser();
    const b = await createUser();

    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Projene katılmak isterim."));
    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("REQUEST");
    expect(conversation.initiatorId).toBe(a.id);

    const notification = await db.notification.findFirst({ where: { userId: b.id, type: "MESSAGE_REQUEST" } });
    expect(notification?.actorId).toBe(a.id);
    expect(notification?.conversationId).toBe(conversationId);
  });

  it("blocks the initiator's second message while the request is pending", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "İlk mesaj"));

    const second = await sendMessage(a.id, conversationId, "İkinci mesaj");
    expect(errorOf(second)).toBe(MSG_PENDING);
  });

  it("does not let the recipient send before accepting", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    const reply = await sendMessage(b.id, conversationId, "Yanıt");
    expect(errorOf(reply)).toBe(MSG_MUST_ACCEPT);
  });

  it("activates on accept, notifies the initiator, and lets both send", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    expect((await acceptRequest(b.id, conversationId)).ok).toBe(true);

    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("ACTIVE");
    const notification = await db.notification.findFirst({
      where: { userId: a.id, type: "MESSAGE_REQUEST_ACCEPTED" },
    });
    expect(notification?.actorId).toBe(b.id);

    expect((await sendMessage(b.id, conversationId, "Selam")).ok).toBe(true);
    expect((await sendMessage(a.id, conversationId, "Selam, teşekkürler")).ok).toBe(true);
  });

  it("hides the decline from the initiator but tells the recipient", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    expect((await declineRequest(b.id, conversationId)).ok).toBe(true);

    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("DECLINED");
    expect(await db.notification.count({ where: { userId: a.id } })).toBe(0);

    expect(errorOf(await sendMessage(a.id, conversationId, "Tekrar"))).toBe(MSG_PENDING);
    expect(errorOf(await sendMessage(b.id, conversationId, "Yanıt"))).toBe(MSG_DECLINED_BY_YOU);
  });

  it("promotes a REQUEST to ACTIVE on send once the users become mutual followers", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    await follow(a.id, b.id);
    await follow(b.id, a.id);

    expect((await sendMessage(a.id, conversationId, "Artık takibe düştük")).ok).toBe(true);
    const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.status).toBe("ACTIVE");
  });

  it("refuses to open or continue a conversation when either side blocked the other", async () => {
    const a = await createUser();
    const b = await createUser();
    await sharedProject(a.id, b.id);
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    await db.block.create({ data: { blockerId: b.id, blockedId: a.id } });

    expect(errorOf(await startConversation(a.id, b.username, "Yeniden"))).toBe(MSG_BLOCKED);
    expect(errorOf(await sendMessage(a.id, conversationId, "Yeniden"))).toBe(MSG_BLOCKED);
    expect(errorOf(await sendMessage(b.id, conversationId, "Yeniden"))).toBe(MSG_BLOCKED);
  });

  it("does not reveal unverified or unknown recipients and rejects self messages", async () => {
    const a = await createUser();
    const unverified = await createUser({ verificationStatus: "UNVERIFIED" });

    expect(errorOf(await startConversation(a.id, unverified.username, "Merhaba"))).toBe(MSG_NOT_FOUND);
    expect(errorOf(await startConversation(a.id, "yok-boyle-biri", "Merhaba"))).toBe(MSG_NOT_FOUND);
    expect(errorOf(await startConversation(a.id, a.username, "Merhaba"))).toBe("Kendine mesaj gönderemezsin.");
  });

  it("rejects empty and over-long bodies", async () => {
    const a = await createUser();
    const b = await createUser();

    expect(errorOf(await startConversation(a.id, b.username, "   "))).toBe("Mesaj 1 ile 2000 karakter arasında olmalı.");
    expect(errorOf(await startConversation(a.id, b.username, "x".repeat(2001)))).toBe(
      "Mesaj 1 ile 2000 karakter arasında olmalı.",
    );
  });

  it("keeps one conversation per pair: a second start from the other side goes through sendMessage", async () => {
    const a = await createUser();
    const b = await createUser();
    const first = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    // Alıcı, bekleyen isteğe yeniden "başlat" dediğinde yeni sohbet açılmaz; kabul gerekir.
    expect(errorOf(await startConversation(b.id, a.username, "Ben de yazayım"))).toBe(MSG_MUST_ACCEPT);
    expect(await db.conversation.count()).toBe(1);

    // Gönderen tarafından ikinci başlatma da var olan sohbete düşer ve bekleme hatası verir.
    expect(errorOf(await startConversation(a.id, b.username, "Yine ben"))).toBe(MSG_PENDING);
    expect(await db.conversation.count()).toBe(1);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: first.conversationId } })).status).toBe("REQUEST");
  });
});

describe("participants and reads", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("hides conversations and messages from non-participants", async () => {
    const a = await createUser();
    const b = await createUser();
    const outsider = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    expect(await getConversationForUser(outsider.id, conversationId)).toBeNull();
    expect(await getMessagesAfter(outsider.id, conversationId, new Date(0))).toBeNull();
    expect(errorOf(await sendMessage(outsider.id, conversationId, "Selam"))).toBe(MSG_CONVERSATION_NOT_FOUND);
  });

  it("lists chats and requests by kind, with the initiator flag", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));

    const sentByA = await listConversations(a.id, "chats");
    expect(sentByA).toHaveLength(1);
    expect(sentByA[0].id).toBe(conversationId);
    expect(sentByA[0].isInitiator).toBe(true);
    expect(sentByA[0].status).toBe("REQUEST");

    expect(await listConversations(b.id, "chats")).toHaveLength(0);
    const receivedByB = await listConversations(b.id, "requests");
    expect(receivedByB).toHaveLength(1);
    expect(receivedByB[0].isInitiator).toBe(false);
    expect(receivedByB[0].latestBody).toBe("Merhaba");
    expect(await listConversations(a.id, "requests")).toHaveLength(0);
  });

  it("flags an active conversation as unread until the viewer reads it", async () => {
    const c = await createUser();
    const d = await createUser();
    await sharedProject(c.id, d.id);
    const { conversationId } = dataOf(await startConversation(c.id, d.username, "Selam"));

    const forD = await listConversations(d.id, "chats");
    expect(forD[0].unread).toBe(true);
    expect(forD[0].preview).toBe("Selam");

    const forC = await listConversations(c.id, "chats");
    expect(forC[0].unread).toBe(false);
    expect(forC[0].preview).toBe("Sen: Selam");

    const polled = await getMessagesAfter(d.id, conversationId, new Date(0));
    expect(polled?.messages).toHaveLength(1);
    expect(polled?.messages[0].mine).toBe(false);

    const afterRead = await listConversations(d.id, "chats");
    expect(afterRead[0].unread).toBe(false);
  });

  it("marks the conversation read on poll so the counter drops to zero", async () => {
    const c = await createUser();
    const d = await createUser();
    await sharedProject(c.id, d.id);
    const { conversationId } = dataOf(await startConversation(c.id, d.username, "Selam"));
    await sendMessage(c.id, conversationId, "Başka bir mesaj");

    expect((await getCounters(d.id)).messages).toBe(1);
    await getMessagesAfter(d.id, conversationId, new Date(0));
    expect((await getCounters(d.id)).messages).toBe(0);
  });

  it("returns only messages after the cursor, oldest first", async () => {
    const c = await createUser();
    const d = await createUser();
    await sharedProject(c.id, d.id);
    const { conversationId } = dataOf(await startConversation(c.id, d.username, "Birinci"));
    const cursor = new Date();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await sendMessage(d.id, conversationId, "İkinci");
    await sendMessage(c.id, conversationId, "Üçüncü");

    const polled = await getMessagesAfter(d.id, conversationId, cursor);
    expect(polled?.messages.map((message) => message.body)).toEqual(["İkinci", "Üçüncü"]);
    // Görüntüleyen d: "İkinci" d'nin, "Üçüncü" c'nin mesajı.
    expect(polled?.messages[0].mine).toBe(true);
    expect(polled?.messages[1].mine).toBe(false);
  });

  it("uses an inclusive cursor: two messages with the same createdAt are both returned", async () => {
    const c = await createUser();
    const d = await createUser();
    await sharedProject(c.id, d.id);
    const { conversationId } = dataOf(await startConversation(c.id, d.username, "Önceki"));
    const sameMs = new Date(Date.now() + 1000);
    // İki taraf aynı milisaniyede yazar. İstemci birini görüp imleci onun zamanına taşımış olabilir.
    await db.message.create({ data: { conversationId, senderId: c.id, body: "Aynı an 1", createdAt: sameMs } });
    await db.message.create({ data: { conversationId, senderId: d.id, body: "Aynı an 2", createdAt: sameMs } });

    const polled = await getMessagesAfter(d.id, conversationId, sameMs);
    expect(polled?.messages.map((message) => message.body).sort()).toEqual(["Aynı an 1", "Aynı an 2"]);
    expect(polled?.messages.every((message) => message.createdAt === sameMs.toISOString())).toBe(true);
  });

  it("returns the last 50 messages for the detail view, oldest first", async () => {
    const c = await createUser();
    const d = await createUser();
    await sharedProject(c.id, d.id);
    const { conversationId } = dataOf(await startConversation(c.id, d.username, "Mesaj 0"));
    await db.message.createMany({
      data: Array.from({ length: 54 }, (_, index) => ({
        conversationId,
        senderId: c.id,
        body: `Mesaj ${index + 1}`,
        createdAt: new Date(Date.now() + index + 1000),
      })),
    });

    const detail = await getConversationForUser(d.id, conversationId);
    expect(detail?.messages).toHaveLength(50);
    expect(detail?.messages[0].body).toBe("Mesaj 5");
    expect(detail?.messages[49].body).toBe("Mesaj 54");
  });
});

describe("declined requests stay hidden from the initiator (spec §4.7)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("visibleStatus turns DECLINED into REQUEST only for the initiator", () => {
    expect(visibleStatus("DECLINED", "a", "a")).toBe("REQUEST");
    expect(visibleStatus("DECLINED", "a", "b")).toBe("DECLINED");
    expect(visibleStatus("REQUEST", "a", "a")).toBe("REQUEST");
    expect(visibleStatus("ACTIVE", "a", "b")).toBe("ACTIVE");
  });

  it("never returns DECLINED to the initiator from the detail, the poll or the list", async () => {
    const a = await createUser();
    const b = await createUser();
    const { conversationId } = dataOf(await startConversation(a.id, b.username, "Merhaba"));
    expect((await declineRequest(b.id, conversationId)).ok).toBe(true);

    expect((await getConversationForUser(a.id, conversationId))?.status).toBe("REQUEST");
    expect((await getMessagesAfter(a.id, conversationId, new Date(0)))?.status).toBe("REQUEST");
    expect((await listConversations(a.id, "chats"))[0]?.status).toBe("REQUEST");

    // Alıcı kendi kararını görmeye devam eder.
    expect((await getConversationForUser(b.id, conversationId))?.status).toBe("DECLINED");
    expect((await getMessagesAfter(b.id, conversationId, new Date(0)))?.status).toBe("DECLINED");
  });
});

describe("listConversations unread flag", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("uses the other side's latest message per conversation", async () => {
    const me = await createUser();
    const x = await createUser();
    const y = await createUser();
    await sharedProject(me.id, x.id, y.id);
    const withX = dataOf(await startConversation(x.id, me.username, "X'ten")).conversationId;
    const withY = dataOf(await startConversation(y.id, me.username, "Y'den")).conversationId;

    // X sohbeti okundu, sonra yalnız ben yazdım; Y sohbetinde okunduktan sonra Y yeniden yazdı.
    await getMessagesAfter(me.id, withX, new Date(0));
    await getMessagesAfter(me.id, withY, new Date(0));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await sendMessage(me.id, withX, "Benden");
    await sendMessage(y.id, withY, "Y'den yeni");

    const rows = await listConversations(me.id, "chats");
    const unread = Object.fromEntries(rows.map((row) => [row.id, row.unread]));
    expect(unread[withX]).toBe(false);
    expect(unread[withY]).toBe(true);
  });
});
