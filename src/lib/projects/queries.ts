import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import {
  personSummarySelect,
  projectCardInclude,
  toPersonSummary,
  toProjectCardData,
  type PersonSummary,
  type ProjectCardData,
} from "@/lib/dto";
import { parseList } from "@/lib/json-fields";
import { searchTokens } from "@/lib/tr";

// Okuma sorguları. Yazmalar actions.ts içindedir.

export interface ListProjectsInput {
  q?: string;
  category?: string;
  disciplineGroup?: string;
  workMode?: string;
  city?: string;
  stage?: string;
  page?: number;
  pageSize?: number;
  /** Verilirse yalnız bu kullanıcının sahibi olduğu ya da üye olduğu projeler (her durum). */
  ownerOrMemberId?: string;
}

export interface ProjectList {
  items: ProjectCardData[];
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10_000;

/** Liste sorgusunun koşulunu kurar. Yalnız test ve listeleme kullanır. */
export function projectListWhere(input: ListProjectsInput): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [];

  if (input.ownerOrMemberId) {
    const userId = input.ownerOrMemberId;
    and.push({ OR: [{ ownerId: userId }, { members: { some: { userId } } }] });
  } else {
    and.push({ status: "OPEN" });
  }

  // Her belirteç ayrı bir AND koşuludur: "robotik kamera" iki belirteci de içermeli.
  for (const token of searchTokens(input.q ?? "")) {
    and.push({ searchText: { contains: token } });
  }
  if (input.category) and.push({ category: input.category });
  if (input.stage) and.push({ stage: input.stage });
  if (input.workMode) and.push({ workMode: input.workMode });
  if (input.city) and.push({ city: input.city });
  if (input.disciplineGroup) {
    and.push({ roles: { some: { disciplineGroup: input.disciplineGroup } } });
  }

  return { AND: and };
}

/** Projeleri en yeniden eskiye listeler. Sayfa boyutundan bir fazla satır çekerek `hasMore` belirler. */
export async function listProjects(input: ListProjectsInput): Promise<ProjectList> {
  const pageSize = Math.min(Math.max(Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
  const page = Math.min(Math.max(Math.floor(input.page ?? 1), 1), MAX_PAGE);

  const rows = await db.project.findMany({
    where: projectListWhere(input),
    include: projectCardInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });

  const hasMore = rows.length > pageSize;
  return {
    items: rows.slice(0, pageSize).map(toProjectCardData),
    hasMore,
  };
}

export interface ProjectRoleView {
  id: string;
  title: string;
  disciplineGroup: string;
  description: string;
  slots: number;
  /** Bu roldeki üye sayısı. */
  filled: number;
  /** Açık kontenjan (slots - filled, en az 0). */
  open: number;
  full: boolean;
}

export interface ProjectMemberView {
  userId: string;
  roleId: string | null;
  roleTitle: string | null;
  isOwner: boolean;
  joinedAt: Date;
  person: PersonSummary;
}

export interface ViewerProjectState {
  isOwner: boolean;
  isMember: boolean;
  pendingRequest: {
    id: string;
    roleId: string | null;
    roleTitle: string | null;
    message: string;
    createdAt: Date;
  } | null;
}

export interface OwnerProjectView {
  requests: Array<{
    id: string;
    roleId: string | null;
    roleTitle: string | null;
    message: string;
    createdAt: Date;
    person: PersonSummary;
  }>;
  invites: Array<{
    id: string;
    roleId: string | null;
    roleTitle: string | null;
    createdAt: Date;
    person: PersonSummary;
  }>;
}

export interface ProjectDetail {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  stage: string;
  workMode: string;
  city: string | null;
  status: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  owner: PersonSummary;
  roles: ProjectRoleView[];
  members: ProjectMemberView[];
  counts: {
    members: number;
    openSlots: number;
  };
  viewer: ViewerProjectState;
  /** Yalnız proje sahibi için dolu; diğerlerinde null. */
  ownerView: OwnerProjectView | null;
}

/**
 * Proje detayı ve görüntüleyiciye özel durum. Proje yoksa null.
 * Başvuru ve davet listeleri yalnız sahibe gider.
 */
export async function getProjectDetail(id: string, viewer: CurrentUser | null): Promise<ProjectDetail | null> {
  const row = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      summary: true,
      description: true,
      category: true,
      stage: true,
      workMode: true,
      city: true,
      status: true,
      tagsJson: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: personSummarySelect },
      roles: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          title: true,
          disciplineGroup: true,
          description: true,
          slots: true,
          _count: { select: { members: true } },
        },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          userId: true,
          roleId: true,
          isOwner: true,
          joinedAt: true,
          user: { select: personSummarySelect },
          role: { select: { title: true } },
        },
      },
    },
  });
  if (!row) return null;

  const viewerId = viewer?.id ?? null;
  const isOwner = viewerId !== null && row.ownerId === viewerId;
  const isMember = viewerId !== null && row.members.some((member) => member.userId === viewerId);

  let pendingRequest: ViewerProjectState["pendingRequest"] = null;
  if (viewerId !== null) {
    const request = await db.joinRequest.findFirst({
      where: { projectId: id, userId: viewerId, status: "PENDING" },
      select: {
        id: true,
        roleId: true,
        message: true,
        createdAt: true,
        role: { select: { title: true } },
      },
    });
    if (request) {
      pendingRequest = {
        id: request.id,
        roleId: request.roleId,
        roleTitle: request.role?.title ?? null,
        message: request.message,
        createdAt: request.createdAt,
      };
    }
  }

  let ownerView: OwnerProjectView | null = null;
  if (isOwner) {
    const [requests, invites] = await Promise.all([
      db.joinRequest.findMany({
        where: { projectId: id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          roleId: true,
          message: true,
          createdAt: true,
          user: { select: personSummarySelect },
          role: { select: { title: true } },
        },
      }),
      db.projectInvite.findMany({
        where: { projectId: id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          roleId: true,
          createdAt: true,
          invitee: { select: personSummarySelect },
          role: { select: { title: true } },
        },
      }),
    ]);

    ownerView = {
      requests: requests.map((request) => ({
        id: request.id,
        roleId: request.roleId,
        roleTitle: request.role?.title ?? null,
        message: request.message,
        createdAt: request.createdAt,
        person: toPersonSummary(request.user),
      })),
      invites: invites.map((invite) => ({
        id: invite.id,
        roleId: invite.roleId,
        roleTitle: invite.role?.title ?? null,
        createdAt: invite.createdAt,
        person: toPersonSummary(invite.invitee),
      })),
    };
  }

  const roles: ProjectRoleView[] = row.roles.map((role) => {
    const filled = role._count.members;
    return {
      id: role.id,
      title: role.title,
      disciplineGroup: role.disciplineGroup,
      description: role.description ?? "",
      slots: role.slots,
      filled,
      open: Math.max(0, role.slots - filled),
      full: filled >= role.slots,
    };
  });

  const roleTitles = new Map(row.roles.map((role) => [role.id, role.title]));
  const members: ProjectMemberView[] = row.members.map((member) => ({
    userId: member.userId,
    roleId: member.roleId,
    roleTitle: member.roleId ? (roleTitles.get(member.roleId) ?? null) : null,
    isOwner: member.isOwner,
    joinedAt: member.joinedAt,
    person: toPersonSummary(member.user),
  }));

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    stage: row.stage,
    workMode: row.workMode,
    city: row.city,
    status: row.status,
    tags: parseList(row.tagsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    owner: toPersonSummary(row.owner),
    roles,
    members,
    counts: {
      members: members.length,
      openSlots: roles.reduce((sum, role) => sum + role.open, 0),
    },
    viewer: { isOwner, isMember, pendingRequest },
    ownerView,
  };
}

export interface OpenProjectForInvite {
  id: string;
  title: string;
  roles: Array<{
    id: string;
    title: string;
    disciplineGroup: string;
    slots: number;
    openSlots: number;
  }>;
}

/**
 * Görüntüleyenin sahibi olduğu açık projeler, roller ve açık kontenjanlarıyla.
 * Profil sayfasındaki "Projeye davet et" akışı (görev 8) bunu kullanır.
 */
export async function getViewerOpenProjectsForInvite(viewerId: string): Promise<OpenProjectForInvite[]> {
  const rows = await db.project.findMany({
    where: { ownerId: viewerId, status: "OPEN" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      roles: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          title: true,
          disciplineGroup: true,
          slots: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  return rows.map((project) => ({
    id: project.id,
    title: project.title,
    roles: project.roles.map((role) => ({
      id: role.id,
      title: role.title,
      disciplineGroup: role.disciplineGroup,
      slots: role.slots,
      openSlots: Math.max(0, role.slots - role._count.members),
    })),
  }));
}
