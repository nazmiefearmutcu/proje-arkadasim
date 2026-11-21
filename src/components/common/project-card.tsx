import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { STAGES, WORK_MODES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { ProjectCardData } from "@/lib/dto";
import { displayName } from "@/lib/permissions";
import { relativeTimeTr } from "@/lib/time";
import { RoleStrip } from "./role-strip";
import { VerifiedLine } from "./verified-stamp";

export interface ProjectCardProps {
  project: ProjectCardData;
  /** Görüntüleyen kullanıcı; misafirse null. Ad gösterimi buna göre seçilir. */
  viewer: { verificationStatus: string; role?: string } | null;
}

const MAX_VISIBLE_STRIPS = 3;

/** "Aranan beceriler · 2 açık, 1 bulundu" satırının sayı kısmı. */
function roleCounts(open: number, full: number): string {
  return full > 0 ? `${open} açık, ${full} bulundu` : `${open} açık`;
}

/**
 * Proje kartı: beyaz kart, üstte ilan sahibi (doğrulama satırıyla) ve paylaşım zamanı, başlık, iki
 * satırlık özet ve aşama/çalışma şekli/şehir. Kesik çizginin altında aranan beceriler: her açık
 * becerinin "Başvur" bağlantısı proje sayfasına gider; karşılığı bulunan beceri gri kutu olur. Kartta
 * bölüm gösterilmez: önemli olan beceridir.
 */
export function ProjectCard({ project, viewer }: ProjectCardProps) {
  const closed = project.status === "CLOSED";
  const { owner } = project;
  const ownerName = displayName(owner, viewer);
  const href = `/projeler/${project.id}`;
  const strips = project.roles.slice(0, MAX_VISIBLE_STRIPS);
  const hiddenCount = project.roles.length - strips.length;
  const fullCount = project.roles.filter((role) => role.full).length;
  const openCount = project.roles.length - fullCount;

  return (
    <article className="min-w-0 overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-perf">
      <div className="p-5 pb-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar
              size={36}
              name={ownerName}
              seed={owner.username}
              avatarPath={owner.avatarPath}
              disciplineGroup={owner.disciplineGroup}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[14px] font-[600] text-ink">{ownerName}</span>
                {owner.verified ? <VerifiedLine academicStatus={owner.academicStatus} /> : null}
              </div>
              {owner.university ? <p className="truncate text-[12px] text-ink-2">{owner.university}</p> : null}
            </div>
          </div>
          <span className="t-mono shrink-0 whitespace-nowrap text-ink-3">{relativeTimeTr(project.createdAt)}</span>
        </div>

        <h2 className="t-card text-ink">
          <Link href={href} className={cn("rounded-control hover:underline hover:underline-offset-4", focusRing)}>
            {project.title}
          </Link>
        </h2>
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{project.summary}</p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="rounded-chip border border-line bg-paper px-2 py-0.5 text-[11px] font-[600] text-ink-2">
            {labelOf(STAGES, project.stage)}
          </span>
          <span className="rounded-chip border border-line bg-paper px-2 py-0.5 text-[11px] font-[600] text-ink-2">
            {labelOf(WORK_MODES, project.workMode)}
          </span>
          {project.city ? (
            <span className="flex items-center gap-1 text-[11px] font-[500] text-ink-2">
              <MapPin aria-hidden="true" strokeWidth={2} className="size-3" />
              {project.city}
            </span>
          ) : null}
          {closed ? (
            <span className="rounded-chip border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-[600] text-danger">
              Başvurulara kapandı
            </span>
          ) : null}
        </div>
      </div>

      {project.roles.length > 0 ? (
        <div className="border-t-[1.5px] border-dashed border-perf bg-surface-2 px-5 pt-3.5 pb-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-[12px] text-ink-2">
              Aranan beceriler ·{" "}
              <strong className="font-[650] text-ink">{roleCounts(openCount, fullCount)}</strong>
            </span>
            <Link
              href={href}
              className={cn("flex shrink-0 items-center gap-0.5 rounded-control text-[12px] font-[650] text-ink hover:underline", focusRing)}
            >
              Detayı aç
              <ChevronRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
            </Link>
          </div>
          <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-3", closed && "opacity-60")}>
            {strips.map((role) => (
              <RoleStrip
                key={role.id}
                title={role.title}
                disciplineGroup={role.disciplineGroup}
                full={role.full}
                href={role.full || closed ? undefined : href}
              />
            ))}
          </div>
          {hiddenCount > 0 ? (
            <p className="mt-2 text-[12px] text-ink-2">
              +{hiddenCount} beceri daha. Hepsini proje sayfasında görebilirsin.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
