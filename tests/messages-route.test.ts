import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "./helpers/db";

// Oturum okuması test içinde kontrol edilir; gerçek çerez ve oturum tablosu kullanılmaz.
const currentUser = vi.hoisted(() => ({ value: null as null | { id: string; verificationStatus: string } }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => currentUser.value,
  isVerified: (user: { verificationStatus: string }) => user.verificationStatus === "VERIFIED",
}));

const { GET } = await import("@/app/api/conversations/[id]/messages/route");

function request(conversationId: string, after: string | null): [Request, { params: Promise<{ id: string }> }] {
  const url = new URL(`http://localhost/api/conversations/${conversationId}/messages`);
  if (after !== null) url.searchParams.set("after", after);
  return [new Request(url), { params: Promise.resolve({ id: conversationId }) }];
}

async function activeConversation(a: string, b: string): Promise<string> {
  const [userAId, userBId] = a < b ? [a, b] : [b, a];
  const conversation = await db.conversation.create({
    data: { userAId, userBId, initiatorId: a, status: "ACTIVE", lastMessageAt: new Date() },
  });
  return conversation.id;
}

describe("GET /api/conversations/[id]/messages", () => {
  beforeEach(async () => {
    await resetDb();
    currentUser.value = null;
  });

  it("returns 401 for guests", async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await activeConversation(a.id, b.id);

    const response = await GET(...request(id, new Date(0).toISOString()));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a user who is not a participant", async () => {
    const a = await createUser();
    const b = await createUser();
    const outsider = await createUser();
    const id = await activeConversation(a.id, b.id);
    currentUser.value = { id: outsider.id, verificationStatus: "VERIFIED" };

    const response = await GET(...request(id, new Date(0).toISOString()));
    expect(response.status).toBe(404);
  });

  it("returns 400 when the after value is missing or not a date", async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await activeConversation(a.id, b.id);
    currentUser.value = { id: a.id, verificationStatus: "VERIFIED" };

    expect((await GET(...request(id, null))).status).toBe(400);
    expect((await GET(...request(id, "bozuk-tarih"))).status).toBe(400);
  });

  it("returns messages and status to a participant, with the mine flag and no-store caching", async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await activeConversation(a.id, b.id);
    const cursor = new Date(Date.now() - 60_000).toISOString();
    await db.message.create({ data: { conversationId: id, senderId: a.id, body: "Merhaba" } });
    await db.message.create({ data: { conversationId: id, senderId: b.id, body: "Selam" } });
    currentUser.value = { id: b.id, verificationStatus: "VERIFIED" };

    const response = await GET(...request(id, cursor));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as {
      status: string;
      messages: { body: string; mine: boolean; createdAt: string; senderId?: string }[];
    };
    expect(body.status).toBe("ACTIVE");
    expect(body.messages.map((message) => message.body)).toEqual(["Merhaba", "Selam"]);
    expect(body.messages.map((message) => message.mine)).toEqual([false, true]);
    expect(body.messages[0].senderId).toBeUndefined();
  });

  it("treats the after value as inclusive so a message at the cursor's millisecond is not lost", async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await activeConversation(a.id, b.id);
    const earlier = new Date(Date.now() - 60_000);
    const cursor = new Date(Date.now() - 30_000);
    await db.message.create({ data: { conversationId: id, senderId: a.id, body: "Önce", createdAt: earlier } });
    await db.message.create({ data: { conversationId: id, senderId: a.id, body: "İmleçte", createdAt: cursor } });
    await db.message.create({ data: { conversationId: id, senderId: b.id, body: "İmleçte de", createdAt: cursor } });
    currentUser.value = { id: b.id, verificationStatus: "VERIFIED" };

    const response = await GET(...request(id, cursor.toISOString()));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { messages: { body: string; createdAt: string }[] };
    expect(body.messages.map((message) => message.body).sort()).toEqual(["İmleçte", "İmleçte de"]);
    expect(body.messages.every((message) => message.createdAt === cursor.toISOString())).toBe(true);
  });

  it("does not reveal a declined request to the initiator", async () => {
    const a = await createUser();
    const b = await createUser();
    const [userAId, userBId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const conversation = await db.conversation.create({
      data: { userAId, userBId, initiatorId: a.id, status: "DECLINED", lastMessageAt: new Date() },
    });
    currentUser.value = { id: a.id, verificationStatus: "VERIFIED" };

    const response = await GET(...request(conversation.id, new Date(0).toISOString()));
    const text = await response.text();
    expect((JSON.parse(text) as { status: string }).status).toBe("REQUEST");
    expect(text).not.toContain("DECLINED");
  });
});
