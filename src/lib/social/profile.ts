import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import { projectCardInclude, toProjectCardData, type ProjectCardData } from "@/lib/dto";
import { parseList } from "@/lib/json-fields";
import { getViewerOpenProjectsForInvite, type OpenProjectForInvite } from "@/lib/projects/queries";
import { getFollowCounts, getFollowState, type FollowCounts, type FollowState } from "./follow-queries";

// Profil sayfası verisi. Sayfa yalnız bu sonucu çizer.

const PROJECT_LIMIT = 50;

export interface ProfilePerson {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  bio: string | null;
  city: string | null;
  university: string | null;
  faculty: string | null;
  department: string | null;
  disciplineGroup: string | null;
  academicStatus: string | null;
  degreeLevel: string | null;
  classYear: number | null;
  graduationYear: number | null;
  lookingForProject: boolean;
  verificationStatus: string;
  skills: string[];
  interests: string[];
}

export type ProfileLookup =
  | { kind: "missing" }
  | {
      kind: "blocked";
      targetId: string;
      username: string;
      /** Görüntüleyen hedefi engellemişse true; bu durumda "Engeli kaldır" gösterilir. */
      blockedByViewer: boolean;
    }
  | {
      kind: "ok";
      person: ProfilePerson;
      isSelf: boolean;
      follow: FollowState;
      counts: FollowCounts;
      ownedProjects: ProjectCardData[];
      memberProjects: ProjectCardData[];
      /** Yalnız başkasının profilinde dolu: görüntüleyenin açık projeleri. */
      openProjectsForInvite: OpenProjectForInvite[];
    };

/** Açık projeler önce, sonra kapalılar; her grupta en yeni önce. */
function openFirst(items: ProjectCardData[]): ProjectCardData[] {
  return [...items].sort((a, b) => {
    const rank = (status: string) => (status === "OPEN" ? 0 : 1);
    return rank(a.status) - rank(b.status);
  });
}

/**
 * Kullanıcı adına göre profil. Hedef yoksa ya da doğrulanmamışsa (görüntüleyen kendisi değilse)
 * "missing" döner. İki yönlü engel varsa yalnız engel bilgisi döner.
 */
export async function loadProfile(username: string, viewer: CurrentUser): Promise<ProfileLookup> {
  const user = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return { kind: "missing" };

  const isSelf = user.id === viewer.id;
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarPath: true,
      bio: true,
      city: true,
      university: true,
      faculty: true,
      department: true,
      disciplineGroup: true,
      academicStatus: true,
      degreeLevel: true,
      classYear: true,
      graduationYear: true,
      lookingForProject: true,
      verificationStatus: true,
      skillsJson: true,
      interestsJson: true,
    },
  });
  if (!row) return { kind: "missing" };
  if (!isSelf && row.verificationStatus !== "VERIFIED") return { kind: "missing" };

  if (!isSelf) {
    const blocks = await db.block.findMany({
      where: {
        OR: [
          { blockerId: viewer.id, blockedId: row.id },
          { blockerId: row.id, blockedId: viewer.id },
        ],
      },
      select: { blockerId: true },
    });
    if (blocks.length > 0) {
      return {
        kind: "blocked",
        targetId: row.id,
        username: row.username,
        blockedByViewer: blocks.some((block) => block.blockerId === viewer.id),
      };
    }
  }

  const [follow, counts, owned, member, openProjectsForInvite] = await Promise.all([
    getFollowState(viewer.id, row.id),
    getFollowCounts(row.id),
    db.project.findMany({
      where: { ownerId: row.id },
      include: projectCardInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PROJECT_LIMIT,
    }),
    db.project.findMany({
      where: { ownerId: { not: row.id }, members: { some: { userId: row.id, isOwner: false } } },
      include: projectCardInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PROJECT_LIMIT,
    }),
    isSelf ? Promise.resolve([] as OpenProjectForInvite[]) : getViewerOpenProjectsForInvite(viewer.id),
  ]);

  return {
    kind: "ok",
    person: {
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarPath: row.avatarPath,
      bio: row.bio,
      city: row.city,
      university: row.university,
      faculty: row.faculty,
      department: row.department,
      disciplineGroup: row.disciplineGroup,
      academicStatus: row.academicStatus,
      degreeLevel: row.degreeLevel,
      classYear: row.classYear,
      graduationYear: row.graduationYear,
      lookingForProject: row.lookingForProject,
      verificationStatus: row.verificationStatus,
      skills: parseList(row.skillsJson),
      interests: parseList(row.interestsJson),
    },
    isSelf,
    follow,
    counts,
    ownedProjects: openFirst(owned.map(toProjectCardData)),
    memberProjects: member.map(toProjectCardData),
    openProjectsForInvite,
  };
}
