import { db } from "@/lib/db";
import { toSearchText } from "@/lib/tr";
import type { Prisma } from "@prisma/client";

/** Tüm tabloların satırlarını siler (yabancı anahtar sırasına göre). Her testten önce çağrılır. */
export async function resetDb(): Promise<void> {
  await db.$transaction([
    db.adminAuditLog.deleteMany(),
    db.report.deleteMany(),
    db.block.deleteMany(),
    db.notification.deleteMany(),
    db.conversationRead.deleteMany(),
    db.message.deleteMany(),
    db.conversation.deleteMany(),
    db.introduction.deleteMany(),
    db.follow.deleteMany(),
    db.projectInvite.deleteMany(),
    db.joinRequest.deleteMany(),
    db.projectMember.deleteMany(),
    db.projectRole.deleteMany(),
    db.project.deleteMany(),
    db.verificationAttempt.deleteMany(),
    db.consent.deleteMany(),
    db.loginEvent.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
}

let userCounter = 0;

/** Doğrulanmış bir kullanıcı üretir. E-posta ve kullanıcı adı her çağrıda benzersizdir. */
export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  userCounter += 1;
  const unique = `${Date.now().toString(36)}${userCounter}${Math.random().toString(36).slice(2, 7)}`;
  const firstName = overrides.firstName ?? "Ayşe";
  const lastName = overrides.lastName ?? "Nur";
  const username = overrides.username ?? `kullanici${unique}`;

  return db.user.create({
    data: {
      email: overrides.email ?? `kullanici-${unique}@test.local`,
      passwordHash: "test-hash",
      firstName,
      lastName,
      username,
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      academicStatus: "STUDENT",
      university: "Test Üniversitesi",
      department: "Bilgisayar Mühendisliği",
      disciplineGroup: "yazilim",
      ...overrides,
      searchText:
        overrides.searchText ?? toSearchText(firstName, lastName, username),
    },
  });
}
