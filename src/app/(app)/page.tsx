import { DISCIPLINE_GROUPS } from "@/config/taxonomy";
import { DisciplineSpine } from "@/components/common/discipline-spine";
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
        <section aria-label="Akış" className="flex flex-col gap-3">
          {feed.items.map((project) => (
            <ProjectCard key={project.id} project={project} viewer={viewer} />
          ))}
          {feed.hasMore ? (
            <ButtonLink href={`/?sayfa=${page + 1}`} variant="secondary" className="w-full">
              Daha fazla göster
            </ButtonLink>
          ) : null}
        </section>
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
  const groupIds = DISCIPLINE_GROUPS.map((group) => group.id);

  return (
    <>
      <DeletedNotice query={query} />
      <section className="flex flex-col gap-4 pt-2 pb-2">
        <h1 className="t-hero text-ink">Bölümünün dışında bir ekip kur.</h1>
        <div className="[&>div]:h-3">
          <DisciplineSpine orientation="horizontal" groups={groupIds} />
        </div>
        <p className="t-body t-prose text-ink-2">
          Proje Arkadaşım, Türkiye&apos;deki üniversite öğrencileri ve mezunları için. Herkesin belgesi doğrulanmış;
          projeni paylaş, farklı bölümlerden ekip arkadaşı bul.
        </p>

        {viewer ? (
          <div className="flex flex-col gap-3 rounded-card border border-line p-4">
            <p className="t-label text-ink">Belgeni doğrula, proje paylaşmaya başla</p>
            <ButtonLink href="/dogrulama" className="w-full sm:w-auto">
              Belgeni yükle
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/kayit">Hesap oluştur</ButtonLink>
            <ButtonLink href="/projeler" variant="secondary">
              Projeleri keşfet
            </ButtonLink>
          </div>
        )}
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
          <div className="flex flex-col gap-3">
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

      <Section title="Nasıl çalışır">
        <ol className="flex flex-col gap-3 pl-5 list-decimal marker:text-ink-3">
          <li className="t-body text-ink-2">Hesabını oluştur ve belgeni yükle</li>
          <li className="t-body text-ink-2">Projeni paylaş veya bir projeye başvur</li>
          <li className="t-body text-ink-2">Ekibinle mesajlaş ve üretmeye başla</li>
        </ol>
      </Section>
    </>
  );
}
