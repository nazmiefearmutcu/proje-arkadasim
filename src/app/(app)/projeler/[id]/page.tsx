import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CATEGORIES, STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { focusRing } from "@/components/ui/styles";
import { DisciplineChip } from "@/components/common/discipline-chip";
import { DisciplineSpine } from "@/components/common/discipline-spine";
import { UserRow } from "@/components/common/user-row";
import { VerifiedStamp } from "@/components/common/verified-stamp";
import { OwnerPanel } from "@/components/projects/owner-panel";
import { ProjectActions, type ProjectViewerState } from "@/components/projects/project-actions";
import { getCurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/permissions";
import { getProjectDetail } from "@/lib/projects/queries";
import { relativeTimeTr } from "@/lib/time";

/** Sayfa ve generateMetadata aynı istekte tek sorgu paylaşır; görünürlük kuralları aynı kalır. */
const loadProject = cache(async (id: string) => {
  const viewer = await getCurrentUser();
  return { viewer, project: await getProjectDetail(id, viewer) };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { project } = await loadProject(id);
  return { title: project ? project.title : "Proje bulunamadı" };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { viewer, project } = await loadProject(id);
  if (!project) notFound();

  const isNew = query.yeni === "1";
  const canSeeProfiles = viewer !== null && (viewer.verificationStatus === "VERIFIED" || viewer.role === "ADMIN");
  const ownerName = displayName(project.owner, viewer);
  const spineGroups = [...new Set(project.roles.map((role) => role.disciplineGroup))];

  const { isOwner, isMember, pendingRequest, pendingInviteId } = project.viewer;
  let viewerState: ProjectViewerState = "open";
  if (isMember) viewerState = "member";
  else if (pendingRequest) viewerState = "pending";
  else if (project.status === "CLOSED") viewerState = "closed";
  else if (!viewer) viewerState = "guest";
  else if (viewer.verificationStatus !== "VERIFIED") viewerState = "unverified";
  else if (pendingInviteId) viewerState = "invited";

  const showActions = !isOwner;

  return (
    <>
      <DisciplineSpine orientation="horizontal" groups={spineGroups} className="mb-4" />

      {isNew ? (
        <p role="status" className="mb-4 rounded-card bg-ok-soft p-4 t-body text-ok">
          Projen yayında. Takipçilerin ana sayfalarında görecek.
        </p>
      ) : null}

      <PageHeader title={project.title} />

      <div className="flex flex-wrap gap-1.5">
        <Chip>{labelOf(CATEGORIES, project.category)}</Chip>
        <Chip>{labelOf(STAGES, project.stage)}</Chip>
        <Chip>{labelOf(WORK_MODES, project.workMode)}</Chip>
        {project.city ? <Chip>{project.city}</Chip> : null}
        {project.status === "CLOSED" ? <Chip selected>Kapandı</Chip> : null}
      </div>

      <div className="mt-4 flex items-center gap-3 border-b border-line pb-4">
        <Avatar
          size={48}
          name={ownerName}
          seed={project.owner.username}
          avatarPath={project.owner.avatarPath}
          disciplineGroup={project.owner.disciplineGroup}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="t-label min-w-0 truncate text-ink">{ownerName}</span>
            {project.owner.verified ? <VerifiedStamp size="sm" academicStatus={project.owner.academicStatus} /> : null}
          </div>
          {project.owner.university ? <span className="t-meta truncate text-ink-2">{project.owner.university}</span> : null}
          {canSeeProfiles ? (
            <Link
              href={`/u/${project.owner.username}`}
              className={cn(
                "t-meta inline-flex min-h-11 w-fit items-center rounded-control text-pen underline-offset-2 hover:underline",
                focusRing,
              )}
            >
              Profile git
            </Link>
          ) : null}
        </div>
        <span className="t-meta shrink-0 text-ink-3">{relativeTimeTr(project.createdAt)}</span>
      </div>

      <Section title="Açıklama">
        <p className="t-body t-prose whitespace-pre-line text-ink-2">{project.description}</p>
      </Section>

      <Section title="Aranan roller">
        <ul className="flex flex-col divide-y divide-line">
          {project.roles.map((role) => (
            <li key={role.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="t-label text-ink">{role.title}</h3>
                  <DisciplineChip id={role.disciplineGroup} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="t-meta text-ink-2">
                    {role.filled}/{role.slots} dolu
                  </span>
                  {role.full ? <Chip selected>Dolu</Chip> : null}
                </div>
              </div>
              {role.description ? <p className="t-body text-ink-2">{role.description}</p> : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ekip">
        <ul className="flex flex-col divide-y divide-line">
          {project.members.map((member) => {
            // Misafir ve doğrulanmamış görüntüleyici: "Ad S.", bölüm yok, profil bağlantısı yok (karar R2).
            const row = (
              <UserRow
                person={canSeeProfiles ? member.person : { ...member.person, department: null }}
                name={displayName(member.person, viewer)}
                reason={member.isOwner ? "Proje sahibi" : (member.roleTitle ?? "Ekip üyesi")}
              />
            );
            return (
              <li key={member.userId}>
                {canSeeProfiles ? (
                  <Link href={`/u/${member.person.username}`} className={cn("block rounded-control", focusRing)}>
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {project.tags.length > 0 ? (
        <Section title="Etiketler">
          <ul className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <li key={tag}>
                <Chip>{tag}</Chip>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {isOwner && project.ownerView ? (
        <OwnerPanel
          projectId={project.id}
          status={project.status === "CLOSED" ? "CLOSED" : "OPEN"}
          roles={project.roles.map((role) => ({ id: role.id, title: role.title, full: role.full }))}
          requests={project.ownerView.requests.map((request) => ({
            id: request.id,
            roleTitle: request.roleTitle,
            message: request.message,
            person: request.person,
            name: displayName(request.person, viewer),
          }))}
          invites={project.ownerView.invites.map((invite) => ({
            id: invite.id,
            roleTitle: invite.roleTitle,
            person: invite.person,
            name: displayName(invite.person, viewer),
          }))}
          members={project.members
            .filter((member) => !member.isOwner)
            .map((member) => ({
              userId: member.userId,
              roleTitle: member.roleTitle,
              person: member.person,
              name: displayName(member.person, viewer),
            }))}
        />
      ) : null}

      {showActions ? (
        <ProjectActions
          key={viewerState}
          projectId={project.id}
          viewerState={viewerState}
          pendingRequestId={pendingRequest?.id ?? null}
          roles={project.roles
            .filter((role) => !role.full)
            .map((role) => ({ id: role.id, title: role.title, full: role.full }))}
        />
      ) : null}
    </>
  );
}
