import Link from "next/link";
import { STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { ProjectCardData } from "@/lib/dto";
import { displayName } from "@/lib/permissions";
import { relativeTimeTr } from "@/lib/time";
import { RoleStrip } from "./role-strip";
import { VerifiedStamp } from "./verified-stamp";

export interface ProjectCardProps {
  project: ProjectCardData;
  /** Görüntüleyen kullanıcı; misafirse null. Ad gösterimi buna göre seçilir. */
  viewer: { verificationStatus: string; role?: string } | null;
}

const MAX_VISIBLE_STRIPS = 3;

/** "2 açık rol, 1 rol doldu" gibi kısa durum cümlesi. */
function roleSummary(open: number, full: number, closed: boolean): string {
  if (closed) return "Proje başvurulara kapandı";
  if (open === 0 && full === 0) return "Rol belirtilmemiş";
  if (open === 0) return "Bütün roller doldu";
  return full > 0 ? `${open} açık rol, ${full} rol doldu` : `${open} açık rol`;
}

/**
 * Proje kartı: panoya asılmış bir ilan. Üstte ilan sahibi, altında başlık (tüm kart tıklanabilir),
 * özet ve durum; en altta koparmalı rol şeritleri. Her şerit aranan bir rol, rengi rolün disiplini;
 * dolan rolün şeridi koparılmış görünür. Kapalı projelerde şeritler soluklaşır.
 */
export function ProjectCard({ project, viewer }: ProjectCardProps) {
  const closed = project.status === "CLOSED";
  const { owner } = project;
  const ownerName = displayName(owner, viewer);
  const strips = project.roles.slice(0, MAX_VISIBLE_STRIPS);
  const hiddenCount = project.roles.length - strips.length;
  const fullCount = project.roles.filter((role) => role.full).length;
  const openCount = project.roles.length - fullCount;

  return (
    <article className="paper-shadow relative flex min-w-0 flex-col gap-[3px]">
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 rounded-t-card bg-surface px-5 pt-5 pb-4",
          strips.length > 0 ? "border-b-2 border-dashed border-perf" : "rounded-b-card",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Avatar
            size={28}
            name={ownerName}
            seed={owner.username}
            avatarPath={owner.avatarPath}
            disciplineGroup={owner.disciplineGroup}
          />
          <span className="t-label min-w-0 truncate text-ink">{ownerName}</span>
          {owner.verified ? <VerifiedStamp size="sm" /> : null}
          {owner.university ? <span className="t-meta min-w-0 truncate text-ink-2">{owner.university}</span> : null}
          <span className="t-meta ml-auto shrink-0 text-ink-2">{relativeTimeTr(project.createdAt)}</span>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="t-card min-w-0 text-ink">
            <Link
              href={`/projeler/${project.id}`}
              className={cn("line-clamp-3 rounded-control after:absolute after:inset-0 after:rounded-card", focusRing)}
            >
              {project.title}
            </Link>
          </h2>
          <p className="t-body line-clamp-2 text-ink-2">{project.summary}</p>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-[1.4] font-[550] text-ink">
            <span>{labelOf(STAGES, project.stage)}</span>
            <span>{labelOf(WORK_MODES, project.workMode)}</span>
            {project.city ? <span>{project.city}</span> : null}
          </div>
          <p className="t-meta text-ink-2">{roleSummary(openCount, fullCount, closed)}</p>
        </div>
      </div>

      {strips.length > 0 ? (
        <div className={cn("flex gap-[3px]", closed && "opacity-50")}>
          {strips.map((role) => (
            <RoleStrip
              key={role.id}
              title={role.title}
              disciplineGroup={role.disciplineGroup}
              full={role.full}
              className="flex-1 basis-0"
            />
          ))}
          {hiddenCount > 0 ? (
            <div className="flex min-h-[60px] shrink-0 items-center rounded-b-card bg-surface px-3 text-[13px] font-[700] text-ink">
              +{hiddenCount} rol
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
