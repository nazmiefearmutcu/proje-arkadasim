import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CATEGORIES, STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { focusRing } from "@/components/ui/styles";
import { RoleStrip } from "@/components/common/role-strip";
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
      {isNew ? (
        <p role="status" className="mb-4 rounded-card bg-ok-soft p-4 t-body text-ok">
          Projen yayında. Takipçilerin ana sayfalarında görecek.
        </p>
      ) : null}

      <div
        data-wide
        className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr_auto] lg:items-start lg:gap-x-8"
      >
        <article className="paper-shadow flex min-w-0 flex-col gap-[3px] lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-5 rounded-t-card border-b-2 border-dashed border-perf bg-surface px-5 pt-6 pb-6 lg:px-10 lg:pt-9 lg:pb-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Avatar
                size={48}
                name={ownerName}
                seed={project.owner.username}
                avatarPath={project.owner.avatarPath}
                disciplineGroup={project.owner.disciplineGroup}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {canSeeProfiles ? (
                  <Link
                    href={`/u/${project.owner.username}`}
                    className={cn(
                      "t-label w-fit max-w-full truncate rounded-control text-ink underline-offset-2 hover:underline",
                      focusRing,
                    )}
                  >
                    {ownerName}
                  </Link>
                ) : (
                  <span className="t-label min-w-0 truncate text-ink">{ownerName}</span>
                )}
                {project.owner.university ? (
                  <span className="t-meta truncate text-ink-2">{project.owner.university}</span>
                ) : null}
                {project.owner.verified ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] leading-[1.4] font-[650] text-stamp">
                    <VerifiedStamp size="sm" academicStatus={project.owner.academicStatus} />
                    {project.owner.academicStatus === "GRADUATE" ? "Mezun belgesi doğrulandı" : "Öğrenci belgesi doğrulandı"}
                  </span>
                ) : null}
              </div>
              <span className="t-meta shrink-0 text-ink-2">{relativeTimeTr(project.createdAt)}</span>
            </div>

            <h1 className="t-page max-w-[16em] text-ink">{project.title}</h1>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[15px] leading-[1.4] font-[550] text-ink">
              <span>{labelOf(CATEGORIES, project.category)}</span>
              <span>{labelOf(STAGES, project.stage)}</span>
              <span>{labelOf(WORK_MODES, project.workMode)}</span>
              {project.city ? <span>{project.city}</span> : null}
              {project.status === "CLOSED" ? <span className="text-danger">Başvurulara kapandı</span> : null}
            </div>

            <p className="t-prose text-[16px] leading-[1.6] whitespace-pre-line text-ink [overflow-wrap:anywhere] lg:text-[17px]">
              {project.description}
            </p>

            {project.tags.length > 0 ? (
              <ul aria-label="Etiketler" className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <li key={tag}>
                    <Chip>{tag}</Chip>
                  </li>
                ))}
              </ul>
            ) : null}

            {project.roles.length > 0 ? (
              <p className="t-meta text-ink-2">Aşağıdaki her şerit aranan bir rol. Dolan rolün şeridi koparılmış görünür.</p>
            ) : null}
          </div>

          {project.roles.length > 0 ? (
            <ul aria-label="Aranan roller" className="flex flex-col gap-[3px] sm:flex-row sm:flex-wrap">
              {project.roles.map((role) => (
                <li key={role.id} className="flex min-w-0 sm:flex-1 sm:basis-[220px]">
                  <RoleStrip
                    size="page"
                    title={role.title}
                    disciplineGroup={role.disciplineGroup}
                    full={role.full}
                    className="w-full"
                  >
                    {role.description ? (
                      <span className="text-[14px] leading-[1.45] [overflow-wrap:anywhere]">{role.description}</span>
                    ) : null}
                    <span className="mt-auto pt-1 text-[13px] leading-[1.4] font-[650]">
                      {role.full ? "Bu şerit koparıldı, rol doldu" : `${role.filled}/${role.slots} dolu`}
                    </span>
                  </RoleStrip>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <section
          aria-labelledby="ekip-baslik"
          className={cn(
            "paper-shadow flex flex-col rounded-card bg-surface px-5 pt-5 pb-2 lg:col-start-2",
            showActions ? "lg:row-start-2" : "lg:row-start-1",
          )}
        >
          <h2 id="ekip-baslik" className="t-section pb-2 text-ink">
            Ekip
          </h2>
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
        </section>

      {isOwner && project.ownerView ? (
        <div className="paper-shadow min-w-0 rounded-card bg-surface px-5 pb-5 lg:col-start-1 lg:row-start-3 lg:px-10">
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
        </div>
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
      </div>
    </>
  );
}
