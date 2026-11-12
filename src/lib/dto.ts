import type { Prisma } from "@prisma/client";

/** Herkese açık kişi özeti. Ad, görüntüleyiciye göre `displayName` ile gösterilir. */
export type PersonSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  university: string | null;
  department: string | null;
  disciplineGroup: string | null;
  academicStatus: string | null;
  verified: boolean;
};

export const personSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarPath: true,
  university: true,
  department: true,
  disciplineGroup: true,
  academicStatus: true,
  verificationStatus: true,
} as const;

export type PersonRow = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  university: string | null;
  department: string | null;
  disciplineGroup: string | null;
  academicStatus: string | null;
  verificationStatus: string;
};

export function toPersonSummary(row: PersonRow): PersonSummary {
  return {
    id: row.id,
    username: row.username,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarPath: row.avatarPath,
    university: row.university,
    department: row.department,
    disciplineGroup: row.disciplineGroup,
    academicStatus: row.academicStatus,
    verified: row.verificationStatus === "VERIFIED",
  };
}

export const projectCardInclude = {
  owner: { select: personSummarySelect },
  roles: {
    select: {
      id: true,
      title: true,
      disciplineGroup: true,
      slots: true,
      // Açık kontenjan = kontenjan - bu roldeki üye sayısı. Dolu roller sayılmaz.
      _count: { select: { members: true } },
    },
  },
  _count: { select: { members: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectCardRow = Prisma.ProjectGetPayload<{
  include: typeof projectCardInclude;
}>;

export type ProjectCardData = {
  id: string;
  title: string;
  summary: string;
  category: string;
  stage: string;
  workMode: string;
  city: string | null;
  status: string;
  createdAt: Date;
  /** Rollerin disiplin grupları, rol sırasıyla, tekrarsız. */
  disciplineGroups: string[];
  openRoleCount: number;
  /** Rol şeritleri, rol sırasıyla. `full`: kontenjanı dolmuş ("koparılmış") rol. */
  roles: ProjectCardRole[];
  owner: PersonSummary;
};

export type ProjectCardRole = {
  id: string;
  title: string;
  disciplineGroup: string;
  full: boolean;
};

export function toProjectCardData(row: ProjectCardRow): ProjectCardData {
  const disciplineGroups: string[] = [];
  const roles: ProjectCardRole[] = [];
  let openRoleCount = 0;

  for (const role of row.roles) {
    if (!disciplineGroups.includes(role.disciplineGroup)) {
      disciplineGroups.push(role.disciplineGroup);
    }
    const open = Math.max(0, role.slots - role._count.members);
    openRoleCount += open;
    roles.push({ id: role.id, title: role.title, disciplineGroup: role.disciplineGroup, full: open === 0 });
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    stage: row.stage,
    workMode: row.workMode,
    city: row.city,
    status: row.status,
    createdAt: row.createdAt,
    disciplineGroups,
    openRoleCount,
    roles,
    owner: toPersonSummary(row.owner),
  };
}
