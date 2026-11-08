"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES, getDisciplineGroup, labelOf } from "@/config/taxonomy";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import { personSummarySelect, toPersonSummary, type PersonSummary } from "@/lib/dto";
import { toListJson } from "@/lib/json-fields";
import { notify, notifyMany } from "@/lib/notify";
import { isBlockedEitherWay } from "@/lib/permissions";
import { searchTokens, toSearchText } from "@/lib/tr";
import {
  applySchema,
  inviteSchema,
  projectInputSchema,
  projectStatusSchema,
  type ProjectInput,
} from "./schemas";
import { isTransientTxError } from "./tx-errors";

// Proje eylemleri. Her eylem doğrulanmış kullanıcı ister; sahiplik kontrolleri ayrıca yapılır.
// Bu dosya yalnız async dışa aktarım içerir ('use server' kuralı).
// Başvuru ve davet durum değişiklikleri koşullu yazılır (`status: "PENDING"`): ön kontrol ile yazma
// arasında başka bir istek kaydı sonuçlandırdıysa yazma hiçbir satırı değiştirmez ve eylem hata döner.

const NOT_VERIFIED = "Bu işlem için belgeni doğrulaman gerekiyor.";
const NO_PERMISSION = "Bu işlem için yetkin yok.";
const PAYLOAD_ERROR = "Form verisi okunamadı. Sayfayı yenileyip tekrar dene.";
const FORM_ERROR = "Lütfen işaretli alanları düzelt.";
const REQUEST_SETTLED = "Bu başvuru zaten sonuçlandı.";
const INVITE_SETTLED = "Bu davet zaten sonuçlandı.";
const BUSY = "Şu an işlenemedi. Birazdan tekrar dene.";

type FormState = ActionResult | null;

/** Doğrulanmış oturum sahibi. Değilse null (çağıran `fail(NOT_VERIFIED)` döner). */
async function verifiedViewer(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.verificationStatus !== "VERIFIED") return null;
  return user;
}

function stringField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

/** Proje formu: JSON yükü `payload` alanında gelir. Hata varsa sonuç döner. */
function parseProjectForm(
  formData: FormData,
): { ok: true; data: ProjectInput } | { ok: false; result: ActionResult<never> } {
  const raw = stringField(formData, "payload");
  if (raw === undefined) return { ok: false, result: fail(PAYLOAD_ERROR) };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, result: fail(PAYLOAD_ERROR) };
  }
  if (typeof value !== "object" || value === null) return { ok: false, result: fail(PAYLOAD_ERROR) };

  const parsed = projectInputSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, result: fail(FORM_ERROR, zodFieldErrors(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

/** Proje arama metni: başlık, özet, açıklama, etiketler, rol adları ve disiplin adları, kategori, şehir. */
function projectSearchText(input: ProjectInput): string {
  return toSearchText(
    input.title,
    input.summary,
    input.description,
    input.tags,
    input.roles.map((role) => role.title),
    input.roles.map((role) => getDisciplineGroup(role.disciplineGroup)?.label ?? ""),
    labelOf(CATEGORIES, input.category),
    input.city ?? "",
  );
}

/**
 * Transaction içinde fırlatılan ret (rol kontenjanı, üyelik çakışması, zaten sonuçlanmış kayıt).
 * Fırlatılınca transaction geri alınır; eylem mesajı `fail` olarak döner.
 */
class TxRefusal extends Error {}

/** Transaction hatasını sonuca çevirir: ret mesajı ya da geçici çakışma. Diğer hatalar yeniden fırlatılır. */
function txFailure(error: unknown): ActionResult<never> {
  if (error instanceof TxRefusal) return fail(error.message);
  if (isTransientTxError(error)) return fail(BUSY);
  throw error;
}

/**
 * Üyeyi transaction içinde ekler. Rol varsa projeye ait olmalı ve kontenjanı dolmamış olmalı.
 * Kontrol ve yazma aynı transaction'da olduğu için iki kabul aynı kontenjanı geçemez.
 */
async function addMemberInTx(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  roleId: string | null,
): Promise<void> {
  const existing = await tx.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (existing) throw new TxRefusal("Bu kişi zaten ekipte.");

  if (roleId) {
    const role = await tx.projectRole.findUnique({
      where: { id: roleId },
      select: { projectId: true, slots: true, _count: { select: { members: true } } },
    });
    if (!role || role.projectId !== projectId) throw new TxRefusal("Seçilen rol bu projeye ait değil.");
    if (role._count.members >= role.slots) throw new TxRefusal("Bu rolün kontenjanı dolu.");
  }

  await tx.projectMember.create({ data: { projectId, userId, roleId } });
}

/**
 * Üyeliği transaction içinde bitirir ve kişinin bu projedeki bekleyen davetlerini iptal eder, bekleyen
 * başvurularını geri çeker; böylece eski bir davet çıkarılan kişiyi ekibe geri getiremez.
 * Üyelik bu arada silinmişse false döner.
 */
async function endMembershipInTx(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  memberId: string,
): Promise<boolean> {
  const deleted = await tx.projectMember.deleteMany({ where: { id: memberId } });
  if (deleted.count === 0) return false;

  const decidedAt = new Date();
  await tx.projectInvite.updateMany({
    where: { projectId, inviteeId: userId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt },
  });
  await tx.joinRequest.updateMany({
    where: { projectId, userId, status: "PENDING" },
    data: { status: "WITHDRAWN", decidedAt },
  });
  return true;
}

function revalidateProject(projectId: string): void {
  revalidatePath("/projeler");
  revalidatePath(`/projeler/${projectId}`);
}

// ---------------------------------------------------------------------------
// Proje yaşam döngüsü
// ---------------------------------------------------------------------------

/** Yeni proje: proje, roller ve sahip üyeliği tek transaction'da. Takipçilere bildirim gider. */
export async function createProjectAction(_prev: FormState, formData: FormData): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;

  const tags = toListJson(input.tags);
  const project = await db.$transaction(async (tx) =>
    tx.project.create({
      data: {
        ownerId: viewer.id,
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        stage: input.stage,
        workMode: input.workMode,
        city: input.city,
        tagsJson: tags,
        searchText: projectSearchText(input),
        roles: {
          create: input.roles.map((role) => ({
            title: role.title,
            disciplineGroup: role.disciplineGroup,
            description: role.description ? role.description : null,
            slots: role.slots,
          })),
        },
        members: { create: { userId: viewer.id, isOwner: true } },
      },
      select: { id: true },
    }),
  );

  const followers = await db.follow.findMany({
    where: { followingId: viewer.id },
    select: { followerId: true },
  });
  await notifyMany(
    followers.map((follow) => follow.followerId),
    { type: "NEW_PROJECT_FROM_FOLLOWING", actorId: viewer.id, projectId: project.id },
  );

  revalidatePath("/");
  revalidatePath("/projeler");
  redirect(`/projeler/${project.id}?yeni=1`);
}

/** Proje güncelleme (yalnız sahip). Rol silinemez; üyesi olan rolün kontenjanı üye sayısından az olamaz. */
export async function updateProjectAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      roles: { select: { id: true, _count: { select: { members: true } } } },
    },
  });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);

  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;

  const existing = new Map(project.roles.map((role) => [role.id, role._count.members]));
  const keptIds = new Set<string>();

  for (const [index, role] of input.roles.entries()) {
    if (!role.id) continue;
    const members = existing.get(role.id);
    if (members === undefined) {
      return fail("Rol bulunamadı. Sayfayı yenileyip tekrar dene.");
    }
    if (keptIds.has(role.id)) {
      return fail("Aynı rol iki kez gönderildi. Sayfayı yenileyip tekrar dene.");
    }
    if (role.slots < members) {
      return fail(FORM_ERROR, {
        [`roles.${index}.slots`]: `Kontenjan, bu roldeki üye sayısından (${members}) az olamaz.`,
      });
    }
    keptIds.add(role.id);
  }

  const removedIds = project.roles.map((role) => role.id).filter((id) => !keptIds.has(id));
  if (removedIds.some((id) => (existing.get(id) ?? 0) > 0)) {
    return fail("Üyesi olan bir rol silinemez.");
  }

  const tags = toListJson(input.tags);
  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        stage: input.stage,
        workMode: input.workMode,
        city: input.city,
        tagsJson: tags,
        searchText: projectSearchText(input),
      },
    });

    if (removedIds.length > 0) {
      await tx.projectRole.deleteMany({ where: { projectId, id: { in: removedIds } } });
    }

    for (const role of input.roles) {
      const fields = {
        title: role.title,
        disciplineGroup: role.disciplineGroup,
        description: role.description ? role.description : null,
        slots: role.slots,
      };
      if (role.id) {
        await tx.projectRole.update({ where: { id: role.id }, data: fields });
      } else {
        await tx.projectRole.create({ data: { ...fields, projectId } });
      }
    }
  });

  revalidateProject(projectId);
  revalidatePath(`/projeler/${projectId}/duzenle`);
  redirect(`/projeler/${projectId}`);
}

/** Projeyi açar ya da kapatır (yalnız sahip). Kapalı projeler keşifte gizlenir, sahip listesinde kalır. */
export async function setProjectStatusAction(
  projectId: string,
  status: "OPEN" | "CLOSED",
): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const parsedStatus = projectStatusSchema.safeParse(status);
  if (!parsedStatus.success) return fail(parsedStatus.error.issues[0]?.message ?? "Geçersiz proje durumu.");

  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);

  await db.project.update({ where: { id: projectId }, data: { status: parsedStatus.data } });
  revalidateProject(projectId);
  return ok();
}

/** Projeyi siler (yalnız sahip). Çağıran taraf onay ister. */
export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);

  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/projeler");
  revalidatePath(`/projeler/${projectId}`);
  redirect("/projeler?filtre=benim");
}

// ---------------------------------------------------------------------------
// Katılma başvuruları
// ---------------------------------------------------------------------------

/** Projeye başvuru. Açık projede, sahibi olmayan ve üye olmayan kullanıcı, tek bekleyen başvuruyla. */
export async function applyToProjectAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      status: true,
      roles: { select: { id: true, slots: true, _count: { select: { members: true } } } },
    },
  });
  if (!project) return fail("Proje bulunamadı.");
  if (project.ownerId === viewer.id) return fail("Bu projeye başvuramazsın.");
  if (await isBlockedEitherWay(viewer.id, project.ownerId)) return fail("Bu projeye başvuramazsın.");

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: viewer.id } },
    select: { id: true },
  });
  if (membership) return fail("Zaten bu projenin ekibindesin.");
  if (project.status !== "OPEN") return fail("Bu proje yeni başvuru almıyor.");

  const parsed = applySchema.safeParse({
    roleId: stringField(formData, "roleId"),
    message: stringField(formData, "message") ?? "",
  });
  if (!parsed.success) return fail(FORM_ERROR, zodFieldErrors(parsed.error));

  const pending = await db.joinRequest.findFirst({
    where: { projectId, userId: viewer.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return fail("Bu projeye zaten bir başvurun var.");

  // Aynı proje için bekleyen davet varken ikinci bir yol açılmaz; davet Network'te yanıtlanır.
  const pendingInvite = await db.projectInvite.findFirst({
    where: { projectId, inviteeId: viewer.id, status: "PENDING" },
    select: { id: true },
  });
  if (pendingInvite) return fail("Bu projeden bekleyen bir davetin var. Network > Davetler'den yanıtla.");

  const roleId = parsed.data.roleId;
  if (roleId) {
    const role = project.roles.find((candidate) => candidate.id === roleId);
    if (!role) return fail(FORM_ERROR, { roleId: "Seçilen rol bu projeye ait değil." });
    if (role._count.members >= role.slots) return fail(FORM_ERROR, { roleId: "Bu rolün kontenjanı dolu." });
  }

  await db.joinRequest.create({
    data: { projectId, userId: viewer.id, roleId, message: parsed.data.message },
  });
  await notify({ userId: project.ownerId, actorId: viewer.id, type: "JOIN_REQUEST", projectId });

  revalidatePath(`/projeler/${projectId}`);
  return ok();
}

/** Başvuruyu geri çeker (yalnız başvuran, yalnız bekleyen başvuru). */
export async function withdrawApplicationAction(requestId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const request = await db.joinRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, projectId: true, status: true },
  });
  if (!request || request.userId !== viewer.id) return fail(NO_PERMISSION);
  if (request.status !== "PENDING") return fail("Bu başvuru artık geri çekilemez.");

  const updated = await db.joinRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "WITHDRAWN", decidedAt: new Date() },
  });
  if (updated.count === 0) return fail(REQUEST_SETTLED);

  revalidatePath(`/projeler/${request.projectId}`);
  return ok();
}

/**
 * Başvuruyu kabul eder ya da reddeder (yalnız sahip). Kabulde durum değişikliği, üyelik ve kontenjan
 * kontrolü tek transaction'dadır; aynı kişiye bu projeden giden bekleyen davet iptal edilir.
 * Aralarında engel olan iki kişi aynı ekipte buluşmaz.
 */
export async function decideApplicationAction(
  requestId: string,
  decision: "ACCEPT" | "REJECT",
): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (decision !== "ACCEPT" && decision !== "REJECT") return fail("Geçersiz karar.");

  const request = await db.joinRequest.findUnique({
    where: { id: requestId },
    select: {
      userId: true,
      projectId: true,
      roleId: true,
      status: true,
      project: { select: { ownerId: true } },
    },
  });
  if (!request || request.project.ownerId !== viewer.id) return fail(NO_PERMISSION);
  if (request.status !== "PENDING") return fail(REQUEST_SETTLED);

  const { projectId, userId, roleId } = request;
  const decidedAt = new Date();

  if (decision === "REJECT") {
    const updated = await db.joinRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", decidedAt },
    });
    if (updated.count === 0) return fail(REQUEST_SETTLED);
    await notify({ userId, actorId: viewer.id, type: "JOIN_REJECTED", projectId });
    revalidatePath(`/projeler/${projectId}`);
    return ok();
  }

  if (await isBlockedEitherWay(viewer.id, userId)) return fail("Bu başvuru kabul edilemez.");

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.joinRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "ACCEPTED", decidedAt },
      });
      if (updated.count === 0) throw new TxRefusal(REQUEST_SETTLED);
      await addMemberInTx(tx, projectId, userId, roleId);
      await tx.projectInvite.updateMany({
        where: { projectId, inviteeId: userId, status: "PENDING" },
        data: { status: "CANCELLED", decidedAt },
      });
    });
  } catch (error) {
    return txFailure(error);
  }

  await notify({ userId, actorId: viewer.id, type: "JOIN_ACCEPTED", projectId });
  revalidatePath(`/projeler/${projectId}`);
  return ok();
}

// ---------------------------------------------------------------------------
// Davetler
// ---------------------------------------------------------------------------

/** Doğrulanmış bir kullanıcıyı projeye davet eder (yalnız sahip, yalnız açık proje). */
export async function inviteToProjectAction(_prev: FormState, formData: FormData): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const parsed = inviteSchema.safeParse({
    projectId: stringField(formData, "projectId") ?? "",
    username: stringField(formData, "username") ?? "",
    roleId: stringField(formData, "roleId"),
    message: stringField(formData, "message") ?? "",
  });
  if (!parsed.success) return fail(FORM_ERROR, zodFieldErrors(parsed.error));
  const input = parsed.data;

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: {
      ownerId: true,
      status: true,
      roles: { select: { id: true, slots: true, _count: { select: { members: true } } } },
    },
  });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);
  if (project.status !== "OPEN") return fail("Kapalı projeye davet gönderemezsin. Önce projeyi aç.");

  const invitee = await db.user.findUnique({
    where: { username: input.username },
    select: { id: true, verificationStatus: true },
  });
  if (!invitee) {
    return fail(FORM_ERROR, { username: "Bu kullanıcı adıyla bir kişi bulunamadı." });
  }
  if (invitee.id === viewer.id) return fail(FORM_ERROR, { username: "Kendini davet edemezsin." });
  if (invitee.verificationStatus !== "VERIFIED") {
    return fail(FORM_ERROR, { username: "Yalnızca doğrulanmış kullanıcılar davet edilebilir." });
  }
  if (await isBlockedEitherWay(viewer.id, invitee.id)) {
    return fail(FORM_ERROR, { username: "Bu kişiye davet gönderemezsin." });
  }

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: invitee.id } },
    select: { id: true },
  });
  if (membership) return fail(FORM_ERROR, { username: "Bu kişi zaten ekipte." });

  const pending = await db.projectInvite.findFirst({
    where: { projectId: input.projectId, inviteeId: invitee.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return fail(FORM_ERROR, { username: "Bu kişiye zaten bekleyen bir davet var." });

  // Kişinin bu projeye bekleyen başvurusu varsa davet yerine başvuru yanıtlanır (iki açık yol olmaz).
  const pendingRequest = await db.joinRequest.findFirst({
    where: { projectId: input.projectId, userId: invitee.id, status: "PENDING" },
    select: { id: true },
  });
  if (pendingRequest) {
    return fail(FORM_ERROR, { username: "Bu kişinin bekleyen bir başvurusu var. Önce başvuruyu yanıtla." });
  }

  if (input.roleId) {
    const role = project.roles.find((candidate) => candidate.id === input.roleId);
    if (!role) return fail(FORM_ERROR, { roleId: "Seçilen rol bu projeye ait değil." });
    if (role._count.members >= role.slots) return fail(FORM_ERROR, { roleId: "Bu rolün kontenjanı dolu." });
  }

  await db.projectInvite.create({
    data: {
      projectId: input.projectId,
      inviterId: viewer.id,
      inviteeId: invitee.id,
      roleId: input.roleId,
      message: input.message ? input.message : null,
    },
  });
  await notify({ userId: invitee.id, actorId: viewer.id, type: "INVITE", projectId: input.projectId });

  revalidateProject(input.projectId);
  revalidatePath("/network");
  return ok();
}

/** Bekleyen daveti geri alır (yalnız davet eden proje sahibi). */
export async function cancelInviteAction(inviteId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const invite = await db.projectInvite.findUnique({
    where: { id: inviteId },
    select: { projectId: true, status: true, project: { select: { ownerId: true } } },
  });
  if (!invite || invite.project.ownerId !== viewer.id) return fail(NO_PERMISSION);
  if (invite.status !== "PENDING") return fail("Bu davet artık geri alınamaz.");

  const updated = await db.projectInvite.updateMany({
    where: { id: inviteId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (updated.count === 0) return fail(INVITE_SETTLED);

  revalidateProject(invite.projectId);
  revalidatePath("/network");
  return ok();
}

/**
 * Daveti kabul eder ya da reddeder (yalnız davetli, yalnız bekleyen davet). Kabulde durum değişikliği,
 * üyelik ve kontenjan kontrolü tek transaction'dadır; davetlinin bu projeye bekleyen başvurusu geri çekilir.
 */
export async function respondToInviteAction(
  inviteId: string,
  response: "ACCEPT" | "DECLINE",
): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);
  if (response !== "ACCEPT" && response !== "DECLINE") return fail("Geçersiz yanıt.");

  const invite = await db.projectInvite.findUnique({
    where: { id: inviteId },
    select: {
      projectId: true,
      inviterId: true,
      inviteeId: true,
      roleId: true,
      status: true,
      project: { select: { status: true } },
    },
  });
  if (!invite || invite.inviteeId !== viewer.id) return fail(NO_PERMISSION);
  if (invite.status !== "PENDING") return fail("Bu davet artık geçerli değil.");

  const { projectId, inviterId, roleId } = invite;
  const decidedAt = new Date();

  if (response === "DECLINE") {
    const updated = await db.projectInvite.updateMany({
      where: { id: inviteId, status: "PENDING" },
      data: { status: "DECLINED", decidedAt },
    });
    if (updated.count === 0) return fail(INVITE_SETTLED);
    await notify({ userId: inviterId, actorId: viewer.id, type: "INVITE_DECLINED", projectId });
    revalidatePath("/network");
    revalidatePath(`/projeler/${projectId}`);
    return ok();
  }

  if (invite.project.status !== "OPEN") return fail("Bu proje artık yeni üye almıyor.");
  // Davetten sonra engel oluştuysa kabul edilmez; mesaj engeli ele vermez.
  if (await isBlockedEitherWay(viewer.id, inviterId)) return fail("Bu davet artık geçerli değil.");

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.projectInvite.updateMany({
        where: { id: inviteId, status: "PENDING" },
        data: { status: "ACCEPTED", decidedAt },
      });
      if (updated.count === 0) throw new TxRefusal(INVITE_SETTLED);
      await addMemberInTx(tx, projectId, viewer.id, roleId);
      await tx.joinRequest.updateMany({
        where: { projectId, userId: viewer.id, status: "PENDING" },
        data: { status: "WITHDRAWN", decidedAt },
      });
    });
  } catch (error) {
    return txFailure(error);
  }

  await notify({ userId: inviterId, actorId: viewer.id, type: "INVITE_ACCEPTED", projectId });
  revalidatePath("/network");
  revalidatePath(`/projeler/${projectId}`);
  return ok();
}

// ---------------------------------------------------------------------------
// Ekip yönetimi
// ---------------------------------------------------------------------------

/** Üye projeden ayrılır. Sahip ayrılamaz. */
export async function leaveProjectAction(projectId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: viewer.id } },
    select: { id: true, isOwner: true },
  });
  if (!member) return fail(NO_PERMISSION);
  if (member.isOwner) return fail("Proje sahibi projeden ayrılamaz. Projeyi silebilir ya da kapatabilirsin.");

  const left = await db.$transaction((tx) => endMembershipInTx(tx, projectId, viewer.id, member.id));
  if (!left) return fail(NO_PERMISSION);

  revalidateProject(projectId);
  return ok();
}

/**
 * Üyeyi ekipten çıkarır (yalnız sahip). Sahip kendini çıkaramaz. Aynı transaction'da kişinin bu projedeki
 * bekleyen davetleri iptal edilir ve başvuruları geri çekilir.
 */
export async function removeMemberAction(projectId: string, userId: string): Promise<ActionResult> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);
  if (userId === viewer.id) return fail("Kendini ekipten çıkaramazsın.");

  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, isOwner: true },
  });
  if (!member) return fail("Bu kişi ekipte değil.");
  if (member.isOwner) return fail("Proje sahibi ekipten çıkarılamaz.");

  const removed = await db.$transaction((tx) => endMembershipInTx(tx, projectId, userId, member.id));
  if (!removed) return fail("Bu kişi ekipte değil.");

  revalidateProject(projectId);
  return ok();
}

/**
 * Davet için doğrulanmış kişi araması (yalnız sahip). En fazla 8 kişi. Üyeler, engellenenler,
 * bekleyen davetliler, bekleyen başvurusu olanlar ve sahibin kendisi dışarıda kalır.
 */
export async function searchInvitableUsersAction(
  projectId: string,
  query: string,
): Promise<ActionResult<PersonSummary[]>> {
  const viewer = await verifiedViewer();
  if (!viewer) return fail(NOT_VERIFIED);

  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project || project.ownerId !== viewer.id) return fail(NO_PERMISSION);

  const tokens = searchTokens(query);
  if (tokens.length === 0) return ok<PersonSummary[]>([]);

  const [members, blocks, pendingInvites, pendingRequests] = await Promise.all([
    db.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    db.block.findMany({
      where: { OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }] },
      select: { blockerId: true, blockedId: true },
    }),
    db.projectInvite.findMany({
      where: { projectId, status: "PENDING" },
      select: { inviteeId: true },
    }),
    db.joinRequest.findMany({
      where: { projectId, status: "PENDING" },
      select: { userId: true },
    }),
  ]);

  const excluded = new Set<string>([
    viewer.id,
    ...members.map((member) => member.userId),
    ...pendingInvites.map((invite) => invite.inviteeId),
    ...pendingRequests.map((request) => request.userId),
    ...blocks.map((block) => (block.blockerId === viewer.id ? block.blockedId : block.blockerId)),
  ]);

  const users = await db.user.findMany({
    where: {
      AND: [
        { verificationStatus: "VERIFIED" },
        { id: { notIn: [...excluded] } },
        ...tokens.map((token) => ({ searchText: { contains: token } })),
      ],
    },
    select: personSummarySelect,
    orderBy: [{ firstName: "asc" }, { id: "asc" }],
    take: 8,
  });

  return ok(users.map(toPersonSummary));
}
