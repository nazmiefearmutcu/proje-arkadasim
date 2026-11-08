import { db } from "@/lib/db";

export interface PersonName {
  firstName: string;
  lastName: string;
}

export interface Viewer {
  verificationStatus: string;
  role?: string;
}

/** Tam ad: "Ayşe Nur Kılıç". */
export function fullName(person: PersonName): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/**
 * Görüntüleyiciye göre ad. Doğrulanmış kullanıcılar ve yöneticiler tam adı görür; diğerleri
 * soyadın her parçasının baş harfini görür ("Ayşe Nur K. Ö.").
 */
export function displayName(person: PersonName, viewer: Viewer | null): string {
  const canSeeFull = viewer !== null && (viewer.verificationStatus === "VERIFIED" || viewer.role === "ADMIN");
  if (canSeeFull) return fullName(person);

  const initials = person.lastName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => `${(Array.from(part)[0] ?? "").toLocaleUpperCase("tr-TR")}.`);

  return [person.firstName.trim(), ...initials].filter((part) => part.length > 0).join(" ");
}

/** İki yönlü engel varsa true. */
export async function isBlockedEitherWay(aId: string, bId: string): Promise<boolean> {
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
    select: { blockerId: true },
  });
  return block !== null;
}

/** İki kullanıcı birbirini takip ediyorsa true. Aynı kullanıcı için false. */
export async function areMutualFollowers(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return false;
  const [ab, ba] = await Promise.all([
    db.follow.findUnique({
      where: { followerId_followingId: { followerId: aId, followingId: bId } },
      select: { followerId: true },
    }),
    db.follow.findUnique({
      where: { followerId_followingId: { followerId: bId, followingId: aId } },
      select: { followerId: true },
    }),
  ]);
  return ab !== null && ba !== null;
}

/** İki kullanıcı aynı projenin üyesiyse true. */
export async function shareAProject(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return false;
  const shared = await db.projectMember.findFirst({
    where: {
      userId: aId,
      project: { members: { some: { userId: bId } } },
    },
    select: { id: true },
  });
  return shared !== null;
}

/**
 * Doğrudan sohbet açılabilir mi: engel yoksa ve karşılıklı takip veya ortak proje varsa.
 * Aksi halde ilk mesaj istek olarak gider (spec §4.7).
 */
export async function canMessageDirectly(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return false;
  if (await isBlockedEitherWay(aId, bId)) return false;
  if (await areMutualFollowers(aId, bId)) return true;
  return shareAProject(aId, bId);
}
