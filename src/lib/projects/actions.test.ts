import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { toSearchText } from "@/lib/tr";

const mocks = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => mocks.viewer,
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import {
  applyToProjectAction,
  createProjectAction,
  decideApplicationAction,
  deleteProjectAction,
  inviteToProjectAction,
  removeMemberAction,
  respondToInviteAction,
  searchInvitableUsersAction,
  updateProjectAction,
  withdrawApplicationAction,
} from "./actions";

type User = Awaited<ReturnType<typeof createUser>>;

const MESSAGE = "Bu projede gerçekten katkı sunabilirim, benzer işlerde deneyimim var.";

function formWith(payload: unknown): FormData {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  return formData;
}

function projectPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Akıllı sera sulama sistemi",
    summary: "Toprak nemini ölçen ve sulamayı otomatik yöneten düşük maliyetli bir prototip.",
    description:
      "Bu projede toprak nemini ölçen sensörler ve sulama vanasını yöneten bir mikrodenetleyici kullanacağız. Ekip arkadaşlarından destek bekliyoruz.",
    category: "DONANIM",
    stage: "PROTOTIP",
    workMode: "UZAKTAN",
    city: null,
    tags: ["arduino"],
    roles: [{ title: "Gömülü yazılımcı", disciplineGroup: "elektronik", slots: 1, description: "" }],
    ...overrides,
  };
}

/** Başvuru formu: roleId ve message ayrı alanlar olarak gelir. */
function applyForm(message: string, roleId = ""): FormData {
  const formData = new FormData();
  formData.set("roleId", roleId);
  formData.set("message", message);
  return formData;
}

async function asViewer(user: User): Promise<void> {
  mocks.viewer = user;
}

/** Doğrudan veritabanında proje kurar. Sahip üyeliği ve rolleri ekler. */
async function seedProject(ownerId: string, slots = 1, title = "Test projesi başlığı") {
  const project = await db.project.create({
    data: {
      ownerId,
      title,
      summary: "Öğrencilerin birlikte geliştirdiği bir proje özeti burada yazılıdır.",
      description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
      searchText: toSearchText(title),
      roles: { create: [{ title: "Geliştirici", disciplineGroup: "yazilim", slots }] },
      members: { create: [{ userId: ownerId, isOwner: true }] },
    },
    include: { roles: true },
  });
  return { project, role: project.roles[0] };
}

describe("createProjectAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("proje, rol ve sahip üyeliğini oluşturur, takipçilere bildirim yazar ve yönlendirir", async () => {
    const owner = await createUser();
    const follower = await createUser();
    await db.follow.create({ data: { followerId: follower.id, followingId: owner.id } });
    await asViewer(owner);

    await expect(createProjectAction(null, formWith(projectPayload()))).rejects.toThrow(/NEXT_REDIRECT:\/projeler\/.+\?yeni=1/);

    const project = await db.project.findFirstOrThrow({
      where: { ownerId: owner.id },
      include: { roles: true, members: true },
    });
    expect(project.roles).toHaveLength(1);
    expect(project.members.some((member) => member.userId === owner.id && member.isOwner)).toBe(true);
    expect(project.searchText).toContain("akilli");
    expect(project.searchText).toContain("elektronik");

    const notes = await db.notification.findMany({ where: { userId: follower.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.type).toBe("NEW_PROJECT_FROM_FOLLOWING");
  });

  it("doğrulanmamış kullanıcı için hata döner ve proje oluşturmaz", async () => {
    const user = await createUser({ verificationStatus: "UNVERIFIED" });
    await asViewer(user);

    const result = await createProjectAction(null, formWith(projectPayload()));
    expect(result).toEqual({ ok: false, error: "Bu işlem için belgeni doğrulaman gerekiyor." });
    expect(await db.project.count()).toBe(0);
  });

  it("yüz yüze projede şehir eksikse alan hatası döner", async () => {
    const owner = await createUser();
    await asViewer(owner);

    const result = await createProjectAction(null, formWith(projectPayload({ workMode: "YUZ_YUZE", city: null })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.city).toBeTruthy();
    expect(await db.project.count()).toBe(0);
  });
});

describe("updateProjectAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("üyesi olan bir rolü silmeye izin vermez", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await db.project.create({
      data: {
        ownerId: owner.id,
        title: "Rol silme testi projesi",
        summary: "Öğrencilerin birlikte geliştirdiği bir proje özeti burada yazılıdır.",
        description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
        category: "YAZILIM",
        stage: "FIKIR",
        workMode: "UZAKTAN",
        searchText: "rol silme",
        roles: {
          create: [
            { title: "Tasarımcı", disciplineGroup: "tasarim", slots: 1 },
            { title: "Geliştirici", disciplineGroup: "yazilim", slots: 1 },
          ],
        },
        members: { create: [{ userId: owner.id, isOwner: true }] },
      },
      include: { roles: true },
    });
    const held = project.roles.find((role) => role.title === "Tasarımcı");
    await db.projectMember.create({ data: { projectId: project.id, userId: member.id, roleId: held?.id } });
    await asViewer(owner);

    const payload = projectPayload({
      roles: [{ id: project.roles.find((role) => role.title === "Geliştirici")?.id, title: "Geliştirici", disciplineGroup: "yazilim", slots: 1, description: "" }],
    });
    const result = await updateProjectAction(project.id, null, formWith(payload));
    expect(result).toEqual({ ok: false, error: "Üyesi olan bir rol silinemez." });
    expect(await db.projectRole.count({ where: { projectId: project.id } })).toBe(2);
  });
});

describe("applyToProjectAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("başvuru oluşturur ve sahibe JOIN_REQUEST bildirimi yazar", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    await asViewer(applicant);

    const result = await applyToProjectAction(project.id, null, applyForm(MESSAGE));
    expect(result).toEqual({ ok: true });

    const request = await db.joinRequest.findFirstOrThrow({ where: { projectId: project.id, userId: applicant.id } });
    expect(request.status).toBe("PENDING");
    const notes = await db.notification.findMany({ where: { userId: owner.id, type: "JOIN_REQUEST" } });
    expect(notes).toHaveLength(1);
  });

  it("aynı projeye ikinci bekleyen başvuruyu reddeder", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    await asViewer(applicant);
    await applyToProjectAction(project.id, null, applyForm(MESSAGE));

    const second = await applyToProjectAction(project.id, null, applyForm(MESSAGE));
    expect(second.ok).toBe(false);
    expect(await db.joinRequest.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("engellenen kullanıcı başvuramaz", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    await db.block.create({ data: { blockerId: owner.id, blockedId: applicant.id } });
    await asViewer(applicant);

    const result = await applyToProjectAction(project.id, null, applyForm(MESSAGE));
    expect(result).toEqual({ ok: false, error: "Bu projeye başvuramazsın." });
  });

  it("proje sahibi kendi projesine başvuramaz", async () => {
    const owner = await createUser();
    const { project } = await seedProject(owner.id);
    await asViewer(owner);

    const result = await applyToProjectAction(project.id, null, applyForm(MESSAGE));
    expect(result).toEqual({ ok: false, error: "Bu projeye başvuramazsın." });
  });
});

describe("decideApplicationAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("kontenjanı 1 olan rolde ikinci kabul başarısız olur", async () => {
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    const { project, role } = await seedProject(owner.id, 1);
    const firstRequest = await db.joinRequest.create({
      data: { projectId: project.id, userId: first.id, roleId: role?.id, message: MESSAGE },
    });
    const secondRequest = await db.joinRequest.create({
      data: { projectId: project.id, userId: second.id, roleId: role?.id, message: MESSAGE },
    });
    await asViewer(owner);

    expect(await decideApplicationAction(firstRequest.id, "ACCEPT")).toEqual({ ok: true });
    expect(await decideApplicationAction(secondRequest.id, "ACCEPT")).toEqual({
      ok: false,
      error: "Bu rolün kontenjanı dolu.",
    });
    expect(await db.projectMember.count({ where: { projectId: project.id, roleId: role?.id } })).toBe(1);
  });

  it("reddetme başvuruyu REJECTED yapar ve JOIN_REJECTED bildirimi yazar", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    const request = await db.joinRequest.create({
      data: { projectId: project.id, userId: applicant.id, message: MESSAGE },
    });
    await asViewer(owner);

    expect(await decideApplicationAction(request.id, "REJECT")).toEqual({ ok: true });
    const refreshed = await db.joinRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(refreshed.status).toBe("REJECTED");
    expect(await db.notification.count({ where: { userId: applicant.id, type: "JOIN_REJECTED" } })).toBe(1);
  });

  it("kabul edilen başvuru üye oluşturur ve JOIN_ACCEPTED bildirimi yazar", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    const request = await db.joinRequest.create({
      data: { projectId: project.id, userId: applicant.id, message: MESSAGE },
    });
    await asViewer(owner);

    expect(await decideApplicationAction(request.id, "ACCEPT")).toEqual({ ok: true });
    expect(await db.projectMember.count({ where: { projectId: project.id, userId: applicant.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: applicant.id, type: "JOIN_ACCEPTED" } })).toBe(1);
  });

  it("proje sahibi olmayan kişi karar veremez", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const stranger = await createUser();
    const { project } = await seedProject(owner.id);
    const request = await db.joinRequest.create({
      data: { projectId: project.id, userId: applicant.id, message: MESSAGE },
    });
    await asViewer(stranger);

    expect(await decideApplicationAction(request.id, "ACCEPT")).toEqual({
      ok: false,
      error: "Bu işlem için yetkin yok.",
    });
  });
});

describe("withdrawApplicationAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("yalnız başvuran kendi bekleyen başvurusunu geri çeker", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const { project } = await seedProject(owner.id);
    const request = await db.joinRequest.create({
      data: { projectId: project.id, userId: applicant.id, message: MESSAGE },
    });
    await asViewer(applicant);

    expect(await withdrawApplicationAction(request.id)).toEqual({ ok: true });
    expect((await db.joinRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("WITHDRAWN");
  });
});

describe("invites", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("davet INVITE bildirimi yazar ve davetli kabul edince üye olur", async () => {
    const owner = await createUser();
    const invitee = await createUser({ username: "davetli-kullanici" });
    const { project, role } = await seedProject(owner.id, 2);
    await asViewer(owner);

    const inviteForm = new FormData();
    inviteForm.set("projectId", project.id);
    inviteForm.set("username", "davetli-kullanici");
    inviteForm.set("roleId", role?.id ?? "");
    inviteForm.set("message", "");
    const invited = await inviteToProjectAction(null, inviteForm);
    expect(invited).toEqual({ ok: true });
    const invite = await db.projectInvite.findFirstOrThrow({ where: { inviteeId: invitee.id } });
    expect(invite.status).toBe("PENDING");
    expect(await db.notification.count({ where: { userId: invitee.id, type: "INVITE" } })).toBe(1);

    await asViewer(invitee);
    expect(await respondToInviteAction(invite.id, "ACCEPT")).toEqual({ ok: true });
    expect(await db.projectMember.count({ where: { projectId: project.id, userId: invitee.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id, type: "INVITE_ACCEPTED" } })).toBe(1);
  });

  it("aynı kişiye ikinci bekleyen davet gönderilemez", async () => {
    const owner = await createUser();
    await createUser({ username: "tekrar-davetli" });
    const { project } = await seedProject(owner.id, 2);
    await asViewer(owner);

    const build = () => {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("username", "tekrar-davetli");
      return formData;
    };
    expect((await inviteToProjectAction(null, build())).ok).toBe(true);
    const second = await inviteToProjectAction(null, build());
    expect(second.ok).toBe(false);
  });

  it("doğrulanmamış kullanıcı davet edilemez", async () => {
    const owner = await createUser();
    await createUser({ username: "dogrulanmamis-kisi", verificationStatus: "UNVERIFIED" });
    const { project } = await seedProject(owner.id, 2);
    await asViewer(owner);

    const formData = new FormData();
    formData.set("projectId", project.id);
    formData.set("username", "dogrulanmamis-kisi");
    const result = await inviteToProjectAction(null, formData);
    expect(result.ok).toBe(false);
    expect(await db.projectInvite.count()).toBe(0);
  });

  it("kabul, rol kontenjanı dolmuşsa başarısız olur", async () => {
    const owner = await createUser();
    const invitee = await createUser();
    const { project, role } = await seedProject(owner.id, 1);
    const invite = await db.projectInvite.create({
      data: { projectId: project.id, inviterId: owner.id, inviteeId: invitee.id, roleId: role?.id },
    });
    await db.projectMember.create({ data: { projectId: project.id, userId: (await createUser()).id, roleId: role?.id } });
    await asViewer(invitee);

    expect(await respondToInviteAction(invite.id, "ACCEPT")).toEqual({ ok: false, error: "Bu rolün kontenjanı dolu." });
  });
});

describe("team management", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sahip üyeyi çıkarabilir, kendini çıkaramaz", async () => {
    const owner = await createUser();
    const member = await createUser();
    const { project } = await seedProject(owner.id, 2);
    await db.projectMember.create({ data: { projectId: project.id, userId: member.id } });
    await asViewer(owner);

    expect(await removeMemberAction(project.id, owner.id)).toEqual({
      ok: false,
      error: "Kendini ekipten çıkaramazsın.",
    });
    expect(await removeMemberAction(project.id, member.id)).toEqual({ ok: true });
    expect(await db.projectMember.count({ where: { projectId: project.id, userId: member.id } })).toBe(0);
  });

  it("davet araması doğrulanmış, üye olmayan ve engellenmemiş kişileri döner", async () => {
    const owner = await createUser();
    const candidate = await createUser({ firstName: "Elif", lastName: "Kaya", username: "elif-kaya" });
    const blocked = await createUser({ firstName: "Elif", lastName: "Arslan", username: "elif-arslan" });
    await createUser({ firstName: "Elif", lastName: "Yıldız", username: "elif-yildiz", verificationStatus: "UNVERIFIED" });
    const { project } = await seedProject(owner.id, 2);
    await db.block.create({ data: { blockerId: owner.id, blockedId: blocked.id } });
    await asViewer(owner);

    const result = await searchInvitableUsersAction(project.id, "elif");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.map((person) => person.id)).toEqual([candidate.id]);
  });

  it("proje silme yalnız sahip için çalışır", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const { project } = await seedProject(owner.id);
    await asViewer(stranger);

    expect(await deleteProjectAction(project.id)).toEqual({ ok: false, error: "Bu işlem için yetkin yok." });
    expect(await db.project.count({ where: { id: project.id } })).toBe(1);
  });
});
