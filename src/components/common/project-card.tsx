import Link from "next/link";
import { CATEGORIES, STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { ProjectCardData } from "@/lib/dto";
import { displayName } from "@/lib/permissions";
import { relativeTimeTr } from "@/lib/time";
import { DisciplineChip } from "./discipline-chip";
import { DisciplineSpine } from "./discipline-spine";
import { VerifiedStamp } from "./verified-stamp";

export interface ProjectCardProps {
  project: ProjectCardData;
  /** Görüntüleyen kullanıcı; misafirse null. Ad gösterimi buna göre seçilir. */
  viewer: { verificationStatus: string; role?: string } | null;
}

const MAX_VISIBLE_GROUPS = 3;

/**
 * Proje kartı. Sol kenarda disiplin sırtı, başlık (tüm kart tıklanabilir), özet, bilgi çipleri,
 * aranan disiplinler ve sahibin künyesi. Kapalı projelerde "Kapandı" çipi ve soluk sırt olur.
 */
export function ProjectCard({ project, viewer }: ProjectCardProps) {
  const closed = project.status === "CLOSED";
  const { owner } = project;
  const ownerName = displayName(owner, viewer);
  const visibleGroups = project.disciplineGroups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenGroupCount = project.disciplineGroups.length - visibleGroups.length;

  return (
    <Card className="flex flex-col gap-3 py-4 pr-4 pl-[22px]">
      <div aria-hidden="true" className={cn("absolute top-[10px] bottom-[10px] left-2.5 flex", closed && "opacity-40")}>
        <DisciplineSpine groups={project.disciplineGroups} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="t-card min-w-0 text-ink">
          <Link
            href={`/projeler/${project.id}`}
            className={cn("line-clamp-2 rounded-control after:absolute after:inset-0 after:rounded-card", focusRing)}
          >
            {project.title}
          </Link>
        </h2>
        <p className="t-body line-clamp-2 text-ink-2">{project.summary}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip>{labelOf(CATEGORIES, project.category)}</Chip>
        <Chip>{labelOf(STAGES, project.stage)}</Chip>
        <Chip>{labelOf(WORK_MODES, project.workMode)}</Chip>
        {project.city ? <Chip>{project.city}</Chip> : null}
        {closed ? <Chip selected>Kapandı</Chip> : null}
      </div>

      {visibleGroups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="t-meta text-ink-3">Aranan</span>
          {visibleGroups.map((id) => (
            <DisciplineChip key={id} id={id} />
          ))}
          {hiddenGroupCount > 0 ? <Chip>+{hiddenGroupCount}</Chip> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3">
        <Avatar
          size={28}
          name={ownerName}
          seed={owner.username}
          avatarPath={owner.avatarPath}
          disciplineGroup={owner.disciplineGroup}
        />
        <span className="t-label min-w-0 truncate text-ink">{ownerName}</span>
        {owner.verified ? <VerifiedStamp size="sm" /> : null}
        {owner.university ? <span className="t-meta min-w-0 truncate text-ink-3">{owner.university}</span> : null}
        <span className="t-meta shrink-0 text-ink-3">{relativeTimeTr(project.createdAt)}</span>
      </div>
    </Card>
  );
}
