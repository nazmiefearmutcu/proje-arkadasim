import { Check } from "lucide-react";
import { ProjectCard } from "@/components/common/project-card";
import { UserRow } from "@/components/common/user-row";
import { FollowButton } from "@/components/social/follow-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { listProjects } from "@/lib/projects/queries";
import { displayName } from "@/lib/permissions";
import { getHomeFeed, normalizeFeedPage } from "@/lib/social/feed";
import { getFollowCounts } from "@/lib/social/follow-queries";
import { getSuggestions } from "@/lib/social/suggestions";

export const metadata = { title: "Ana sayfa" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SUGGESTION_COUNT = 5;
const LANDING_PROJECT_COUNT = 3;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const viewer = await getCurrentUser();

  if (!viewer || viewer.verificationStatus !== "VERIFIED") {
    return <Landing viewer={viewer} query={query} />;
  }

  const rawPage = Array.isArray(query.sayfa) ? query.sayfa[0] : query.sayfa;
  const page = normalizeFeedPage(rawPage);
  const feed = await getHomeFeed(viewer.id, page);

  return (
    <>
      <DeletedNotice query={query} />
      <PageHeader title="Ana sayfa" description="Takip ettiğin kişilerin paylaştığı projeler" />

      {feed.items.length > 0 ? (
        <div data-wide className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Akış" className="grid min-w-0 content-start gap-3 lg:grid-cols-2">
            {feed.items.map((project) => (
              <ProjectCard key={project.id} project={project} viewer={viewer} />
            ))}
            {feed.hasMore ? (
              <ButtonLink href={`/?sayfa=${page + 1}`} variant="secondary" className="w-full lg:col-span-2">
                Daha fazla göster
              </ButtonLink>
            ) : null}
          </section>
          <HomeRail viewer={viewer} />
        </div>
      ) : page > 1 ? (
        <EmptyState
          title="Bu sayfada proje yok"
          text="Ana sayfanın ilk sayfasına dönerek en yeni projelere bakabilirsin."
          action={
            <ButtonLink href="/" variant="secondary">
              İlk sayfaya dön
            </ButtonLink>
          }
        />
      ) : (
        <FeedEmpty viewer={viewer} />
      )}
    </>
  );
}

/** Akış boşken: takip yoksa bunu söyler, değilse projelerin henüz olmadığını. Öneriler eklenir. */
async function FeedEmpty({ viewer }: { viewer: CurrentUser }) {
  const [counts, suggestions] = await Promise.all([
    getFollowCounts(viewer.id),
    getSuggestions(viewer.id, SUGGESTION_COUNT),
  ]);
  const noneFollowed = counts.following === 0;

  return (
    <>
      <EmptyState
        title={noneFollowed ? "Henüz kimseyi takip etmiyorsun" : "Takip ettiklerin henüz proje paylaşmadı"}
        text={
          noneFollowed
            ? "Aşağıdaki kişilere bakıp takip etmeye başlayabilir, projeleri keşfedebilirsin."
            : "Projeleri keşfedip ekip arkadaşı bulabilirsin."
        }
        action={
          <ButtonLink href="/projeler" variant="secondary">
            Projeleri keşfet
          </ButtonLink>
        }
      />
      {suggestions.length > 0 ? (
        <Section title="Önerilen kişiler">
          <ul className="flex flex-col divide-y divide-line">
            {suggestions.map((suggestion) => (
              <li key={suggestion.person.id}>
                <UserRow
                  person={suggestion.person}
                  name={displayName(suggestion.person, viewer)}
                  reason={suggestion.reason || undefined}
                  action={<FollowButton userId={suggestion.person.id} initialFollowing={false} />}
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

/** Masaüstü (xl) sağ sütunu: takip önerileri. Telefonda ve dar ekranlarda gösterilmez. */
async function HomeRail({ viewer }: { viewer: CurrentUser }) {
  const suggestions = await getSuggestions(viewer.id, SUGGESTION_COUNT);
  if (suggestions.length === 0) return null;

  return (
    <aside aria-label="Önerilen kişiler" className="hidden xl:block">
      <div className="paper-shadow sticky top-[84px] rounded-card bg-surface px-5 pt-3 pb-1">
        <Section
          title="Önerilen kişiler"
          right={
            <ButtonLink href="/network?sekme=tanistirmalar" variant="ghost">
              Tümü
            </ButtonLink>
          }
        >
          <ul className="flex flex-col divide-y divide-line">
            {suggestions.map((suggestion) => (
              <li key={suggestion.person.id}>
                <UserRow
                  person={suggestion.person}
                  name={displayName(suggestion.person, viewer)}
                  reason={suggestion.reason || undefined}
                  action={<FollowButton userId={suggestion.person.id} initialFollowing={false} />}
                />
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}

/** Hesap silindikten sonra `/?hesap=silindi` ile gelinen bildirim. Misafir ve akış görünümlerinde ortak. */
function DeletedNotice({ query }: { query: Record<string, string | string[] | undefined> }) {
  const hesap = Array.isArray(query.hesap) ? query.hesap[0] : query.hesap;
  if (hesap !== "silindi") return null;
  return (
    <p role="status" className="t-body rounded-control border border-line bg-surface px-4 py-3 text-ink">
      Hesabın ve verilerin kalıcı olarak silindi.
    </p>
  );
}

/** Misafir ve doğrulanmamış kullanıcılar için tanıtım sayfası. */
async function Landing({
  viewer,
  query,
}: {
  viewer: CurrentUser | null;
  query: Record<string, string | string[] | undefined>;
}) {
  const latest = await listProjects({ pageSize: LANDING_PROJECT_COUNT });

  return (
    <>
      <DeletedNotice query={query} />
      <section
        data-wide
        className="flex flex-col gap-6 rounded-card bg-pen px-5 pt-8 pb-8 text-pen-ink lg:gap-8 lg:px-12 lg:pt-14 lg:pb-12"
      >
        <h1 className="t-hero max-w-[9em]">Bölümünün dışında bir ekip kur.</h1>
        <p className="max-w-[34em] text-[17px] leading-[1.5] text-pen-ink/85 lg:text-[20px]">
          Projeni panoya as, aradığın rolleri şeritlere yaz. Başka bölümlerden öğrenciler ve mezunlar kendine uyan
          şeridi koparıp ekibine katılsın.
        </p>

        {viewer ? (
          <div className="flex flex-col gap-3">
            <p className="text-[16px] leading-[1.4] font-[600]">Belgeni doğrula, proje paylaşmaya başla</p>
            <ButtonLink href="/dogrulama" variant="inverse" className="h-12 w-full px-6 text-[16px] sm:w-fit">
              Belgeni yükle
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/kayit" variant="inverse" className="h-12 px-6 text-[16px]">
              Hesap oluştur
            </ButtonLink>
            <ButtonLink href="/projeler" variant="inverse-outline" className="h-12 px-6 text-[16px]">
              Panodaki projelere bak
            </ButtonLink>
          </div>
        )}

        <p className="flex max-w-[40em] items-start gap-2 text-[15px] leading-[1.5] text-pen-ink/85">
          <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--tick)] text-ink">
            <Check strokeWidth={3} className="size-3.5" />
          </span>
          Yalnızca öğrenci ya da mezun belgesi doğrulanmış kişiler proje paylaşabilir ve projelere katılabilir.
          Panoya herkes bakabilir.
        </p>

        <ol className="flex flex-col gap-5 border-t border-white/25 pt-6 sm:flex-row sm:gap-8">
          <li className="flex flex-1 flex-col gap-1.5">
            <span aria-hidden="true" className="text-[40px] leading-none font-[800] [font-stretch:70%]">1</span>
            <span className="text-[16px] leading-[1.4] font-[650]">Hesabını aç, belgeni yükle</span>
            <span className="text-[14px] leading-[1.45] text-pen-ink/85">
              e-Devlet öğrenci ya da mezun belgen saniyeler içinde kontrol edilir.
            </span>
          </li>
          <li className="flex flex-1 flex-col gap-1.5">
            <span aria-hidden="true" className="text-[40px] leading-none font-[800] [font-stretch:70%]">2</span>
            <span className="text-[16px] leading-[1.4] font-[650]">Projeni paylaş ya da bir şerit kopar</span>
            <span className="text-[14px] leading-[1.45] text-pen-ink/85">Her şerit bir rol. Dolunca koparılmış görünür.</span>
          </li>
          <li className="flex flex-1 flex-col gap-1.5">
            <span aria-hidden="true" className="text-[40px] leading-none font-[800] [font-stretch:70%]">3</span>
            <span className="text-[16px] leading-[1.4] font-[650]">Ekibinle yazış, üretmeye başla</span>
            <span className="text-[14px] leading-[1.45] text-pen-ink/85">
              Mesajlar yalnızca ekip arkadaşlarından ve kabul ettiğin kişilerden gelir.
            </span>
          </li>
        </ol>
      </section>

      <Section
        title="Son paylaşılan projeler"
        right={
          <ButtonLink href="/projeler" variant="ghost">
            Tüm projeler
          </ButtonLink>
        }
      >
        {latest.items.length > 0 ? (
          <div data-wide className="grid gap-3 lg:grid-cols-3">
            {latest.items.map((project) => (
              <ProjectCard key={project.id} project={project} viewer={viewer} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Henüz açık proje yok"
            text="İlk projeyi paylaşan sen olabilirsin."
          />
        )}
      </Section>

    </>
  );
}
