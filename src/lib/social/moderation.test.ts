import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/rate-limit";
import { toSearchText } from "@/lib/tr";
import { createUser, resetDb } from "../../../tests/helpers/db";

const mocks = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => mocks.viewer,
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { getCounters } from "@/lib/counters";
import {
  MSG_BLOCKED,
  MSG_DECLINED_BY_YOU,
  MSG_PENDING,
  acceptRequest,
  getConversationForUser,
  listConversations,
  sendMessage,
} from "@/lib/messaging/service";
import { blockUserAction, reportAction, unblockUserAction } from "./moderation";
import { REPORT_OK_MESSAGE } from "./report-reasons";

type User = Awaited<ReturnType<typeof createUser>>;

async function asViewer(user: User): Promise<void> {
  mocks.viewer = user;
}

function reportForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

async function seedProject(ownerId: string) {
  const title = "Test projesi başlığı";
  return db.project.create({
    data: {
      ownerId,
      title,
      summary: "Öğrencilerin birlikte geliştirdiği bir proje özeti burada yazılıdır.",
      description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
      searchText: toSearchText(title),
      members: { create: [{ userId: ownerId, isOwner: true }] },
    },
  });
}

describe("blockUserAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("takipleri iki yönde kaldırır, engellenenin bekleyen isteğini reddeder ve bekleyen davetleri iptal eder", async () => {
    const viewer = await createUser();
    const target = await createUser();
    const other = await createUser();
    await asViewer(viewer);

    await db.follow.create({ data: { followerId: viewer.id, followingId: target.id } });
    await db.follow.create({ data: { followerId: target.id, followingId: viewer.id } });
    await db.follow.create({ data: { followerId: viewer.id, followingId: other.id } });

    const request = await db.conversation.create({
      data: { userAId: target.id, userBId: viewer.id, initiatorId: target.id, status: "REQUEST" },
    });
    const active = await db.conversation.create({
      data: { userAId: other.id, userBId: viewer.id, initiatorId: other.id, status: "ACTIVE" },
    });

    const project = await seedProject(viewer.id);
    const invite = await db.projectInvite.create({
      data: { projectId: project.id, inviterId: viewer.id, inviteeId: target.id, status: "PENDING" },
    });

    expect(await blockUserAction(target.id)).toEqual({ ok: true });

    expect(await db.block.count({ where: { blockerId: viewer.id, blockedId: target.id } })).toBe(1);
    expect(await db.follow.count({ where: { followerId: viewer.id, followingId: target.id } })).toBe(0);
    expect(await db.follow.count({ where: { followerId: target.id, followingId: viewer.id } })).toBe(0);
    // Engelleyenin başka kişilere takibi kalır.
    expect(await db.follow.count({ where: { followerId: viewer.id, followingId: other.id } })).toBe(1);

    expect((await db.conversation.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("DECLINED");
    expect((await db.conversation.findUniqueOrThrow({ where: { id: active.id } })).status).toBe("ACTIVE");

    expect((await db.projectInvite.findUniqueOrThrow({ where: { id: invite.id } })).status).toBe("CANCELLED");
  });

  it("iki yönde bekleyen başvuruları geri çeker; başka projelerin başvurularına dokunmaz", async () => {
    const viewer = await createUser();
    const target = await createUser();
    const other = await createUser();
    await asViewer(viewer);

    const viewerProject = await seedProject(viewer.id);
    const targetProject = await seedProject(target.id);
    const otherProject = await seedProject(other.id);
    // Engellenen kişinin, engelleyenin projesine başvurusu.
    const intoViewers = await db.joinRequest.create({
      data: { projectId: viewerProject.id, userId: target.id, message: "Katılmak isterim." },
    });
    // Engelleyenin, engellenenin projesine başvurusu.
    const intoTargets = await db.joinRequest.create({
      data: { projectId: targetProject.id, userId: viewer.id, message: "Katılmak isterim." },
    });
    // İlgisiz: engellenenin üçüncü kişinin projesine başvurusu ve önceden karara bağlanmış başvuru.
    const unrelated = await db.joinRequest.create({
      data: { projectId: otherProject.id, userId: target.id, message: "Katılmak isterim." },
    });
    const decided = await db.joinRequest.create({
      data: { projectId: viewerProject.id, userId: target.id, message: "Eski", status: "REJECTED" },
    });

    expect(await blockUserAction(target.id)).toEqual({ ok: true });

    for (const id of [intoViewers.id, intoTargets.id]) {
      const row = await db.joinRequest.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("WITHDRAWN");
      expect(row.decidedAt).not.toBeNull();
    }
    expect((await db.joinRequest.findUniqueOrThrow({ where: { id: unrelated.id } })).status).toBe("PENDING");
    expect((await db.joinRequest.findUniqueOrThrow({ where: { id: decided.id } })).status).toBe("REJECTED");
  });

  it("engelleyenin başlattığı istek REQUEST kalır, engel sürerken görünmez ve engel kalkınca kabul edilebilir", async () => {
    const viewer = await createUser();
    const target = await createUser();
    const [userAId, userBId] = viewer.id < target.id ? [viewer.id, target.id] : [target.id, viewer.id];
    const request = await db.conversation.create({
      data: { userAId, userBId, initiatorId: viewer.id, status: "REQUEST", lastMessageAt: new Date() },
    });
    await db.message.create({ data: { conversationId: request.id, senderId: viewer.id, body: "Merhaba" } });
    await asViewer(viewer);

    expect(await blockUserAction(target.id)).toEqual({ ok: true });
    expect((await db.conversation.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("REQUEST");
    expect(await listConversations(target.id, "requests")).toHaveLength(0);
    expect((await getCounters(target.id)).requests).toBe(0);
    expect(await acceptRequest(target.id, request.id)).toEqual({ ok: false, error: MSG_BLOCKED });

    expect(await unblockUserAction(target.id)).toEqual({ ok: true });
    expect(await listConversations(target.id, "requests")).toHaveLength(1);
    expect((await getCounters(target.id)).requests).toBe(1);
    expect((await acceptRequest(target.id, request.id)).ok).toBe(true);
    expect((await sendMessage(target.id, request.id, "Selam")).ok).toBe(true);
  });

  it("engellenenin başlattığı istek reddedilir; engel kalkınca başlatan yine 'bekliyor' görür", async () => {
    const viewer = await createUser();
    const target = await createUser();
    const [userAId, userBId] = viewer.id < target.id ? [viewer.id, target.id] : [target.id, viewer.id];
    const request = await db.conversation.create({
      data: { userAId, userBId, initiatorId: target.id, status: "REQUEST", lastMessageAt: new Date() },
    });
    await asViewer(viewer);

    expect(await blockUserAction(target.id)).toEqual({ ok: true });
    expect(await unblockUserAction(target.id)).toEqual({ ok: true });

    expect((await db.conversation.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("DECLINED");
    // Ret, başlatana gösterilmez (spec §4.7); engelleyen isteği reddetmiş sayılır.
    expect((await getConversationForUser(target.id, request.id))?.status).toBe("REQUEST");
    expect((await getConversationForUser(viewer.id, request.id))?.status).toBe("DECLINED");
    expect(await sendMessage(target.id, request.id, "Tekrar")).toEqual({ ok: false, error: MSG_PENDING });
    expect(await sendMessage(viewer.id, request.id, "Yanıt")).toEqual({ ok: false, error: MSG_DECLINED_BY_YOU });
  });

  it("kendini engelleyemez", async () => {
    const viewer = await createUser();
    await asViewer(viewer);

    expect((await blockUserAction(viewer.id)).ok).toBe(false);
    expect(await db.block.count()).toBe(0);
  });

  it("unblockUserAction engel satırını siler", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await db.block.create({ data: { blockerId: viewer.id, blockedId: target.id } });
    await asViewer(viewer);

    expect(await unblockUserAction(target.id)).toEqual({ ok: true });
    expect(await db.block.count()).toBe(0);
  });
});

describe("reportAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("geçerli şikayeti kaydeder ve onay mesajı döner", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await asViewer(viewer);

    const result = await reportAction(
      null,
      reportForm({ targetType: "USER", targetId: target.id, reason: "Spam veya reklam", details: "  Tekrar tekrar mesaj atıyor  " }),
    );

    expect(result).toEqual({ ok: true, data: REPORT_OK_MESSAGE });
    const rows = await db.report.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reporterId).toBe(viewer.id);
    expect(rows[0]?.targetType).toBe("USER");
    expect(rows[0]?.details).toBe("Tekrar tekrar mesaj atıyor");
  });

  it("neden listede yoksa ya da kendini şikayet ediyorsa reddeder", async () => {
    const viewer = await createUser();
    await asViewer(viewer);

    const badReason = await reportAction(
      null,
      reportForm({ targetType: "USER", targetId: viewer.id, reason: "Bilinmeyen" }),
    );
    expect(badReason.ok).toBe(false);

    const self = await reportAction(
      null,
      reportForm({ targetType: "USER", targetId: viewer.id, reason: "Diğer" }),
    );
    expect(self.ok).toBe(false);
    expect(await db.report.count()).toBe(0);
  });

  it("mesaj şikayetinde yalnız sohbetin tarafı şikayet edebilir", async () => {
    const sender = await createUser();
    const receiver = await createUser();
    const outsider = await createUser();
    const conversation = await db.conversation.create({
      data: { userAId: sender.id, userBId: receiver.id, initiatorId: sender.id, status: "ACTIVE" },
    });
    const message = await db.message.create({
      data: { conversationId: conversation.id, senderId: sender.id, body: "Merhaba" },
    });
    const form = () =>
      reportForm({ targetType: "MESSAGE", targetId: message.id, reason: "Taciz veya hakaret" });

    await asViewer(outsider);
    expect((await reportAction(null, form())).ok).toBe(false);

    await asViewer(receiver);
    expect((await reportAction(null, form())).ok).toBe(true);
  });

  it("kullanıcı başına saatte en çok 10 şikayet gönderir", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await asViewer(viewer);

    const limit = LIMITS.report[0];
    for (let i = 0; i < limit; i += 1) {
      const result = await reportAction(
        null,
        reportForm({ targetType: "USER", targetId: target.id, reason: "Diğer" }),
      );
      expect(result.ok).toBe(true);
    }

    const blocked = await reportAction(
      null,
      reportForm({ targetType: "USER", targetId: target.id, reason: "Diğer" }),
    );
    expect(blocked.ok).toBe(false);
    expect(await db.report.count({ where: { reporterId: viewer.id } })).toBe(limit);
  });
});
