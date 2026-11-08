import { DISCIPLINE_GROUPS } from "@/config/taxonomy";
import { ProjectCard } from "@/components/common/project-card";
import { ProjectFilters } from "@/components/projects/project-filters";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, requireUser } from "@/lib/auth/guards";
import { activeFilterCount, parseProjectFilters, projectsHref } from "@/lib/projects/filters";
import { listProjects } from "@/lib/projects/queries";

export const metadata = { title: "Projeler" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseProjectFilters(await searchParams);
  const mineViewer = filters.mine ? await requireUser("/projeler?filtre=benim") : null;
  const viewer = mineViewer ?? (await getCurrentUser());

  const list = await listProjects({
    q: filters.q,
    category: filters.category ?? undefined,
    disciplineGroup: filters.disciplineGroup ?? undefined,
    workMode: filters.workMode ?? undefined,
    city: filters.city ?? undefined,
    stage: filters.stage ?? undefined,
    page: filters.page,
    ownerOrMemberId: mineViewer?.id,
  });

  const activeCount = activeFilterCount(filters);
  const hasAnyFilter = activeCount > 0 || filters.disciplineGroup !== null;
  const filterKey = projectsHref(filters);

  return (
    <>
      <PageHeader
        title={filters.mine ? "Projelerim" : "Projeler"}
        right={
          <ButtonLink href="/paylas" size="md">
            Projeyi paylaş
          </ButtonLink>
        }
      />

      <nav aria-label="Proje listesi" className="flex gap-2 overflow-x-auto pb-1">
        <Chip href="/projeler" selected={!filters.mine} className="shrink-0">
          Açık projeler
        </Chip>
        <Chip href="/projeler?filtre=benim" selected={filters.mine} className="shrink-0">
          Projelerim
        </Chip>
      </nav>

      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Disiplinler">
        <Chip
          href={projectsHref({ mine: filters.mine, q: filters.q, category: filters.category, workMode: filters.workMode, city: filters.city, stage: filters.stage })}
          selected={filters.disciplineGroup === null}
          className="shrink-0"
        >
          Tüm disiplinler
        </Chip>
        {DISCIPLINE_GROUPS.map((group) => {
          const selected = filters.disciplineGroup === group.id;
          return (
            <Chip
              key={group.id}
              href={projectsHref({
                mine: filters.mine,
                q: filters.q,
                category: filters.category,
                workMode: filters.workMode,
                city: filters.city,
                stage: filters.stage,
                disciplineGroup: selected ? null : group.id,
              })}
              selected={selected}
              dotColor={`var(--d-${group.id})`}
              className="shrink-0"
            >
              {group.label}
            </Chip>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ProjectFilters key={filterKey} initial={filters} activeCount={activeCount} />
        {activeCount > 0 ? (
          <ButtonLink href={projectsHref({ mine: filters.mine, disciplineGroup: filters.disciplineGroup })} variant="ghost">
            Filtreleri temizle
          </ButtonLink>
        ) : null}
      </div>

      <section aria-label="Projeler" className="mt-4 flex flex-col gap-3">
        {list.items.length === 0 ? (
          filters.mine ? (
            <EmptyState
              title="Henüz projen yok"
              text="Bir proje paylaştığında ya da bir ekibe katıldığında burada görünür."
              action={<ButtonLink href="/paylas">İlk projeyi paylaş</ButtonLink>}
            />
          ) : hasAnyFilter ? (
            <EmptyState
              title="Bu filtrelerle proje yok"
              text="Filtreleri biraz gevşetmeyi ya da başka bir disiplini denemeyi dene."
              action={
                <ButtonLink href={projectsHref({ mine: filters.mine })} variant="secondary">
                  Filtreleri temizle
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Henüz açık proje yok"
              text="İlk projeyi sen paylaşabilirsin. Ekip arkadaşı aradığın gerçek bir proje anlat."
              action={<ButtonLink href="/paylas">İlk projeyi paylaş</ButtonLink>}
            />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {list.items.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} viewer={viewer} />
                </li>
              ))}
            </ul>
            {list.hasMore ? (
              <ButtonLink
                href={projectsHref({ ...filters, page: filters.page + 1 })}
                variant="secondary"
                className="w-full"
              >
                Daha fazla göster
              </ButtonLink>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
