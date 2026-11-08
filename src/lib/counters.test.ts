import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getCounters } from "./counters";
import { createUser, resetDb } from "../../tests/helpers/db";

async function makeConversation(
  a: string,
  b: string,
  initiatorId: string,
  status = "ACTIVE",
) {
  return db.conversation.create({
    data: {
      userAId: a,
      userBId: b,
      initiatorId,
      status,
      lastMessageAt: new Date(),
    },
  });
}

describe("getCounters", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("counts unread notifications and pending invites", async () => {
    const me = await createUser();
    const other = await createUser();
    const project = await db.project.create({
      data: {
        ownerId: other.id,
        title: "Proje",
        summary: "Özet",
        description: "Açıklama",
        category: "YAZILIM",
        stage: "FIKIR",
        workMode: "UZAKTAN",
      },
    });
    const role = await db.projectRole.create({
      data: { projectId: project.id, title: "Geliştirici", disciplineGroup: "yazilim" },
    });

    await db.notification.create({ data: { userId: me.id, type: "FOLLOW", actorId: other.id } });
    await db.notification.create({
      data: { userId: me.id, type: "FOLLOW", actorId: other.id, readAt: new Date() },
    });
    await db.projectInvite.create({
      data: { projectId: project.id, inviterId: other.id, inviteeId: me.id, roleId: role.id, status: "PENDING" },
    });
    await db.projectInvite.create({
      data: { projectId: project.id, inviterId: other.id, inviteeId: me.id, roleId: role.id, status: "DECLINED" },
    });

    const counters = await getCounters(me.id);
    expect(counters.notifications).toBe(1);
    expect(counters.invites).toBe(1);
  });

  it("counts message requests the user received, not the ones they sent", async () => {
    const me = await createUser();
    const other = await createUser();
    const third = await createUser();

    await makeConversation(me.id, other.id, other.id, "REQUEST");
    await makeConversation(me.id, third.id, me.id, "REQUEST");

    const counters = await getCounters(me.id);
    expect(counters.requests).toBe(1);
  });

  it("counts an active conversation as unread when the other user wrote after lastReadAt", async () => {
    const me = await createUser();
    const other = await createUser();
    const conversation = await makeConversation(me.id, other.id, me.id);

    await db.conversationRead.create({
      data: { conversationId: conversation.id, userId: me.id, lastReadAt: new Date(Date.now() - 60_000) },
    });
    await db.message.create({
      data: { conversationId: conversation.id, senderId: other.id, body: "Merhaba" },
    });

    const counters = await getCounters(me.id);
    expect(counters.messages).toBe(1);
  });

  it("does not count the user's own messages", async () => {
    const me = await createUser();
    const other = await createUser();
    const conversation = await makeConversation(me.id, other.id, me.id);

    await db.message.create({
      data: { conversationId: conversation.id, senderId: me.id, body: "Kendi mesajım" },
    });

    const counters = await getCounters(me.id);
    expect(counters.messages).toBe(0);
  });

  it("treats a read row written after the last message as fully read", async () => {
    const me = await createUser();
    const other = await createUser();
    const conversation = await makeConversation(me.id, other.id, me.id);

    await db.message.create({
      data: { conversationId: conversation.id, senderId: other.id, body: "Merhaba" },
    });
    await db.conversationRead.create({
      data: { conversationId: conversation.id, userId: me.id, lastReadAt: new Date(Date.now() + 60_000) },
    });

    const counters = await getCounters(me.id);
    expect(counters.messages).toBe(0);
  });

  it("treats every message from the other user as unread when there is no read row", async () => {
    const me = await createUser();
    const other = await createUser();
    const conversation = await makeConversation(me.id, other.id, other.id);

    await db.message.create({
      data: { conversationId: conversation.id, senderId: other.id, body: "Bir" },
    });
    await db.message.create({
      data: { conversationId: conversation.id, senderId: other.id, body: "İki" },
    });

    const counters = await getCounters(me.id);
    expect(counters.messages).toBe(1);
  });
});
