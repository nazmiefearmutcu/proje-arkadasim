import Link from "next/link";
import { ProjectCard } from "@/components/common/project-card";
import { UserRow } from "@/components/common/user-row";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { focusRing } from "@/components/ui/styles";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/permissions";
import { isSearchableQuery, searchPeople, searchProjects } from "@/lib/search";
import { getSearchSuggestions, suggestionToQuery } from "@/lib/search-suggestions";

export const metadata = { title: "Ara" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Tab = "projeler" | "kisiler";

const MAX_QUERY_LENGTH = 80;
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "projeler", label: "Projeler" },
  { value: "kisiler", label: "Kişiler" },
];

function first(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (first(params, "q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const tab: Tab = first(params, "tur") === "kisiler" ? "kisiler" : "projeler";
  const viewer = await getCurrentUser();

  const hrefFor = (value: Tab) => `/ara?${new URLSearchParams({ q, tur: value }).toString()}`;

  return (
    <>
      <PageHeader title="Ara" description={q ? `“${q}” için sonuçlar` : undefined} />

      {q.length === 0 ? (
        <Suggestions viewer={viewer} />
      ) : (
        <>
          <nav aria-label="Arama sonuç türü" className="border-b border-line">
            <ul className="flex gap-5">
              {TABS.map((item) => {
                const active = item.value === tab;
                return (
                  <li key={item.value}>
                    <Link
                      href={hrefFor(item.value)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center whitespace-nowrap t-label",
                        active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                        focusRing,
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                          active ? "bg-pen" : "bg-transparent",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-4">
            {tab === "projeler" ? (
              <ProjectResults q={q} viewer={viewer} />
            ) : (
              <PeopleResults q={q} viewer={viewer} nextPath={hrefFor("kisiler")} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function Suggestions({ viewer }: { viewer: CurrentUser | null }) {
  const suggestions = getSearchSuggestions(
    viewer ? { disciplineGroup: viewer.disciplineGroup, interestsJson: viewer.interestsJson, city: viewer.city } : null,
  );

  return (
    <section aria-label="Önerilen aramalar" className="flex flex-col gap-3">
      <p className="t-body text-ink-2">Bir proje ya da kişi ara. Önerilerden birine dokunabilirsin.</p>
      <ul className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <Link
              href={`/ara?q=${encodeURIComponent(suggestionToQuery(suggestion))}`}
              className={cn(
                "inline-flex min-h-11 items-center rounded-chip bg-surface-2 px-4 t-label text-ink-2",
                focusRing,
              )}
            >
              {suggestion}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ProjectResults({ q, viewer }: { q: string; viewer: CurrentUser | null }) {
  if (!isSearchableQuery(q)) return <ShortQuery />;

  const projects = await searchProjects(q);
  if (projects.length === 0) {
    return (
      <EmptyState
        title="Bu aramaya uyan proje bulamadık."
        text="Farklı bir kelime dene."
        action={
          <ButtonLink href="/projeler" variant="secondary">
            Tüm projelere göz at
          </ButtonLink>
        }
      />
    );
  }

  const viewerView = viewer ? { verificationStatus: viewer.verificationStatus, role: viewer.role } : null;
  return (
    <ul className="flex flex-col gap-3">
      {projects.map((project) => (
        <li key={project.id}>
          <ProjectCard project={project} viewer={viewerView} />
        </li>
      ))}
    </ul>
  );
}

async function PeopleResults({
  q,
  viewer,
  nextPath,
}: {
  q: string;
  viewer: CurrentUser | null;
  nextPath: string;
}) {
  if (viewer === null || viewer.verificationStatus !== "VERIFIED") {
    const guest = viewer === null;
    return (
      <Card className="flex flex-col gap-3 p-4">
        <p className="t-body text-ink-2">
          {guest
            ? "Kişileri aramak için giriş yapıp belgeni doğrulaman gerekiyor."
            : "Kişileri aramak için belgeni doğrulaman gerekiyor."}
        </p>
        {guest ? (
          <ButtonLink href={`/giris?next=${encodeURIComponent(nextPath)}`}>Giriş yap</ButtonLink>
        ) : (
          <ButtonLink href="/dogrulama">Belgeni doğrula</ButtonLink>
        )}
      </Card>
    );
  }

  if (!isSearchableQuery(q)) return <ShortQuery />;

  const results = await searchPeople(q, viewer.id);
  if (results.length === 0) {
    return (
      <EmptyState
        title="Bu aramaya uyan doğrulanmış kişi bulamadık."
        text="Farklı bir ad ya da kullanıcı adı dene."
      />
    );
  }

  const viewerView = { verificationStatus: viewer.verificationStatus, role: viewer.role };
  return (
    <ul className="flex flex-col divide-y divide-line">
      {results.map(({ person }) => (
        <li key={person.id}>
          <UserRow
            person={person}
            name={displayName(person, viewerView)}
            action={
              <ButtonLink href={`/u/${person.username}`} variant="secondary">
                Profili gör
              </ButtonLink>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function ShortQuery() {
  return <EmptyState title="Aramak için en az iki harf yaz." />;
}
