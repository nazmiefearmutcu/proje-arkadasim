import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CATEGORIES, STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { focusRing } from "@/components/ui/styles";
import { RoleStrip } from "@/components/common/role-strip";
import { ArrowLeft } from "lucide-react";
import { UserRow } from "@/components/common/user-row";
import { VerifiedLine } from "@/components/common/verified-stamp";
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
  const openRoleCount = project.roles.filter((role) => !role.full).length;

  return (
    <>
      {isNew ? (
        <p role="status" className="mb-4 rounded-card bg-ok-soft p-4 t-body text-ok">
          Projen yayında. Takipçilerin ana sayfalarında görecek.
        </p>
      ) : null}

      <div
        data-wide
        className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_auto_1fr_auto] lg:items-start lg:gap-x-6"
      >
        <Link
          href="/"
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-control text-[12px] font-[650] text-ink-2 hover:text-ink lg:col-span-2",
            focusRing,
          )}
        >
          <ArrowLeft aria-hidden="true" strokeWidth={2} className="size-4" />
          Ana sayfaya dön
        </Link>

        <article className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface lg:col-start-1 lg:row-span-2 lg:row-start-2">
          <div className="flex flex-col gap-5 p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Avatar
                size={40}
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
                {project.owner.verified ? <VerifiedLine academicStatus={project.owner.academicStatus} /> : null}
              </div>
              <span className="t-mono shrink-0 text-ink-3">{relativeTimeTr(project.createdAt)}</span>
            </div>

            <h1 className="t-page text-ink">{project.title}</h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-[1.4] font-[550] text-ink-2">
              <span>{labelOf(CATEGORIES, project.category)}</span>
              <span>{labelOf(STAGES, project.stage)}</span>
              <span>{labelOf(WORK_MODES, project.workMode)}</span>
              {project.city ? <span>{project.city}</span> : null}
              {project.status === "CLOSED" ? <span className="text-danger">Başvurulara kapandı</span> : null}
            </div>

            <p className="t-prose text-[15px] leading-relaxed whitespace-pre-line text-ink [overflow-wrap:anywhere]">
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

          </div>

          {project.roles.length > 0 ? (
            <div className="border-t-[1.5px] border-dashed border-perf bg-surface-2 p-6">
              <p className="mb-3 text-[12px] font-[500] text-ink-2">
                Aşağıdaki şeritlerden sana uyan görevi kopar.{" "}
                {openRoleCount} görev aranıyor, {project.roles.length - openRoleCount} tanesi doldu.
              </p>
              <ul aria-label="Aranan roller" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {project.roles.map((role) => (
                  <li key={role.id} className="flex min-w-0">
                    <RoleStrip
                      title={role.title}
                      disciplineGroup={role.disciplineGroup}
                      full={role.full}
                      description={role.description}
                      footer={role.full ? "Ekibe katıldı" : `${role.filled}/${role.slots} dolu`}
                      className="w-full"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <section
          aria-labelledby="ekip-baslik"
          className={cn(
            "flex flex-col rounded-card border border-line bg-surface px-5 pt-5 pb-2 lg:col-start-2",
            showActions ? "lg:row-start-3" : "lg:row-start-2",
          )}
        >
          <h2 id="ekip-baslik" className="t-section pb-1 text-ink">
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
        <div className="min-w-0 rounded-card border border-line bg-surface px-5 pb-5 lg:col-start-1 lg:row-start-4 lg:px-7">
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
