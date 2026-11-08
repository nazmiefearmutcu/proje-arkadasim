import { db } from "@/lib/db";
import { personSummarySelect, toPersonSummary, type PersonSummary } from "@/lib/dto";

// Network sayfasının davet okuması. Kabul ve ret projects/actions.ts içindedir.

export const INCOMING_INVITE_LIMIT = 50;

export interface IncomingInvite {
  id: string;
  message: string | null;
  roleTitle: string | null;
  createdAt: Date;
  inviter: PersonSummary;
  project: {
    id: string;
    title: string;
    status: string;
    /** Projenin aradığı disiplin grupları, tekrarsız, rol sırasıyla. */
    disciplineGroups: string[];
  };
}

/** Görüntüleyene gelen bekleyen proje davetleri (en yeni önce). */
export async function listIncomingInvites(viewerId: string): Promise<IncomingInvite[]> {
  const rows = await db.projectInvite.findMany({
    where: { inviteeId: viewerId, status: "PENDING" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: INCOMING_INVITE_LIMIT,
    select: {
      id: true,
      message: true,
      createdAt: true,
      role: { select: { title: true } },
      inviter: { select: personSummarySelect },
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          roles: { orderBy: { id: "asc" }, select: { disciplineGroup: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    roleTitle: row.role?.title ?? null,
    createdAt: row.createdAt,
    inviter: toPersonSummary(row.inviter),
    project: {
      id: row.project.id,
      title: row.project.title,
      status: row.project.status,
      disciplineGroups: [...new Set(row.project.roles.map((role) => role.disciplineGroup))],
    },
  }));
}
