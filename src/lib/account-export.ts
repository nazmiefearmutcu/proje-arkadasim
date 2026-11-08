import { db } from "@/lib/db";
import { parseList, parseObject } from "@/lib/json-fields";

// KVKK m.11 "bilgi talep etme" hakkı: kullanıcının kendi verisinin dökümü (spec §6.2).
// Belge dosyası hiçbir zaman saklanmadığı için dışa aktarılamaz; doğrulama kaydının içinde
// yalnız belgeden çıkarılan eğitim alanları ve sonuç yer alır. docHash, maskedText, oturum
// jetonu/özeti ve başka kullanıcıların kimlikleri (ör. şikayet hedefi) ASLA yazılmaz.
// Giriş kayıtları sınırsız aktarılır: saklama süresinden (LOGIN_LOG_RETENTION_DAYS) eskiler
// temizlikte silindiği için tutulan her kayıt bu döküme girer.

export const EXPORT_NOTES =
  "Bu dosya hesabındaki kişisel verilerinin dökümüdür. Yüklediğin belgenin kendisi hiçbir zaman " +
  "saklanmaz; doğrulama kaydında yalnızca belgeden çıkarılan eğitim alanları ve sonuç bulunur. " +
  "Saklama süresi içindeki bütün giriş kayıtların, sohbetlerin, engellediğin kişiler, gönderdiğin " +
  "şikayetler, açık oturumların ve tanıştırma önerilerin de dosyadadır. " +
  "Parola özeti, oturum jetonları, belge parmak izi ve maskeli belge metni güvenlik nedeniyle " +
  "dışa aktarılmaz; şikayetlerinde başka kullanıcılara ait kimlikler yer almaz. " +
  "Soruların için ayarlardaki KVKK başvuru adresini kullanabilirsin.";

export interface AccountExport {
  exportedAt: string;
  notes: string;
  profile: Record<string, unknown>;
  consents: unknown[];
  verificationAttempts: unknown[];
  loginEvents: unknown[];
  projectsOwned: unknown[];
  projectMemberships: unknown[];
  joinRequests: unknown[];
  invitesSent: unknown[];
  invitesReceived: unknown[];
  followers: unknown[];
  following: unknown[];
  messagesSent: unknown[];
  notifications: unknown[];
  conversations: unknown[];
  blocksGiven: unknown[];
  reportsFiled: unknown[];
  sessions: unknown[];
  introductions: unknown[];
}

/** Kullanıcının tüm kişisel verisini (parola özeti ve belge parmak izi hariç) tek nesnede toplar. */
export async function buildAccountExport(userId: string, now: Date = new Date()): Promise<AccountExport> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      avatarPath: true,
      bio: true,
      city: true,
      skillsJson: true,
      interestsJson: true,
      lookingForProject: true,
      role: true,
      verificationStatus: true,
      academicStatus: true,
      university: true,
      faculty: true,
      department: true,
      disciplineGroup: true,
      degreeLevel: true,
      classYear: true,
      graduationYear: true,
      verifiedAt: true,
      searchText: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const [
    consents,
    attempts,
    loginEvents,
    ownedProjects,
    memberships,
    joinRequests,
    invitesSent,
    invitesReceived,
    followers,
    following,
    messages,
    notifications,
    conversations,
    blocksGiven,
    reportsFiled,
    sessions,
    introductions,
  ] = await Promise.all([
    db.consent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, version: true, granted: true, createdAt: true },
    }),
    db.verificationAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        source: true,
        documentType: true,
        nameMatch: true,
        aiUsed: true,
        aiModel: true,
        aiConfidence: true,
        aiSummary: true,
        redFlagsJson: true,
        extractedJson: true,
        rejectReason: true,
        processingMs: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    db.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { ip: true, userAgent: true, success: true, createdAt: true },
    }),
    db.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        summary: true,
        description: true,
        category: true,
        stage: true,
        workMode: true,
        city: true,
        tagsJson: true,
        status: true,
        createdAt: true,
        roles: { select: { title: true, disciplineGroup: true, description: true, slots: true } },
      },
    }),
    db.projectMember.findMany({
      where: { userId, isOwner: false },
      select: {
        joinedAt: true,
        project: { select: { title: true } },
        role: { select: { title: true } },
      },
    }),
    db.joinRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        message: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        project: { select: { title: true } },
        role: { select: { title: true } },
      },
    }),
    db.projectInvite.findMany({
      where: { inviterId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        message: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        project: { select: { title: true } },
        invitee: { select: { username: true } },
      },
    }),
    db.projectInvite.findMany({
      where: { inviteeId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        message: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        project: { select: { title: true } },
        inviter: { select: { username: true } },
      },
    }),
    db.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, follower: { select: { username: true } } },
    }),
    db.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, following: { select: { username: true } } },
    }),
    db.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "asc" },
      select: { body: true, createdAt: true, conversationId: true },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, dataJson: true, readAt: true, createdAt: true },
    }),
    db.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        initiatorId: true,
        createdAt: true,
        lastMessageAt: true,
        userAId: true,
        userA: { select: { username: true } },
        userB: { select: { username: true } },
      },
    }),
    db.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, blocked: { select: { username: true } } },
    }),
    db.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "asc" },
      // targetId bilerek seçilmez: başka bir kullanıcının, projenin ya da mesajın kimliğidir.
      select: { targetType: true, reason: true, details: true, status: true, createdAt: true },
    }),
    db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      // tokenHash bilerek seçilmez: oturum jetonunun özeti bir kimlik doğrulama sırrıdır.
      select: { userAgent: true, createdAt: true, expiresAt: true },
    }),
    db.introduction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        reason: true,
        dismissed: true,
        createdAt: true,
        suggestedUser: { select: { username: true } },
      },
    }),
  ]);

  return {
    exportedAt: now.toISOString(),
    notes: EXPORT_NOTES,
    profile: {
      ...user,
      skills: parseList(user.skillsJson),
      interests: parseList(user.interestsJson),
      skillsJson: undefined,
      interestsJson: undefined,
    },
    consents,
    verificationAttempts: attempts.map((attempt) => ({
      ...attempt,
      redFlagsJson: undefined,
      extractedJson: undefined,
      redFlags: parseList(attempt.redFlagsJson),
      extractedFields: parseObject<Record<string, unknown>>(attempt.extractedJson, {}),
    })),
    loginEvents,
    projectsOwned: ownedProjects.map((project) => ({
      ...project,
      tagsJson: undefined,
      tags: parseList(project.tagsJson),
    })),
    projectMemberships: memberships.map((membership) => ({
      joinedAt: membership.joinedAt,
      projectTitle: membership.project.title,
      roleTitle: membership.role?.title ?? null,
    })),
    joinRequests: joinRequests.map((request) => ({
      message: request.message,
      status: request.status,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
      projectTitle: request.project.title,
      roleTitle: request.role?.title ?? null,
    })),
    invitesSent: invitesSent.map((invite) => ({
      message: invite.message,
      status: invite.status,
      createdAt: invite.createdAt,
      decidedAt: invite.decidedAt,
      projectTitle: invite.project.title,
      inviteeUsername: invite.invitee.username,
    })),
    invitesReceived: invitesReceived.map((invite) => ({
      message: invite.message,
      status: invite.status,
      createdAt: invite.createdAt,
      decidedAt: invite.decidedAt,
      projectTitle: invite.project.title,
      inviterUsername: invite.inviter.username,
    })),
    followers: followers.map((follow) => ({
      createdAt: follow.createdAt,
      username: follow.follower.username,
    })),
    following: following.map((follow) => ({
      createdAt: follow.createdAt,
      username: follow.following.username,
    })),
    messagesSent: messages,
    notifications: notifications.map((notification) => ({
      type: notification.type,
      data: parseObject<Record<string, unknown>>(notification.dataJson, {}),
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })),
    conversations: conversations.map((conversation) => ({
      partnerUsername:
        conversation.userAId === userId ? conversation.userB.username : conversation.userA.username,
      status: conversation.status,
      initiatedByMe: conversation.initiatorId === userId,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    })),
    blocksGiven: blocksGiven.map((block) => ({
      createdAt: block.createdAt,
      blockedUsername: block.blocked.username,
    })),
    reportsFiled,
    sessions,
    introductions: introductions.map((introduction) => ({
      suggestedUsername: introduction.suggestedUser.username,
      reason: introduction.reason,
      dismissed: introduction.dismissed,
      createdAt: introduction.createdAt,
    })),
  };
}
