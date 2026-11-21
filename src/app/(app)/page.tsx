import Link from "next/link";
import { ChatScreen, ClosingScreen, LandingHero, StripScreen, VerifiedScreen } from "@/components/landing/landing-sections";
import { ProjectCard } from "@/components/common/project-card";
import { UserRow } from "@/components/common/user-row";
import { FollowButton } from "@/components/social/follow-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getCurrentUser } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/user-select";
import { displayName } from "@/lib/permissions";
import { getHomeFeed, normalizeFeedPage } from "@/lib/social/feed";
import { getFollowCounts } from "@/lib/social/follow-queries";
import { getSuggestions } from "@/lib/social/suggestions";

export const metadata = { title: "Ana sayfa" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SUGGESTION_COUNT = 5;

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
        <div data-wide className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_324px]">
          <section aria-label="Akış" className="flex min-w-0 flex-col gap-4">
            {feed.items.map((project) => (
              <ProjectCard key={project.id} project={project} viewer={viewer} />
            ))}
            {feed.hasMore ? (
              <ButtonLink href={`/?sayfa=${page + 1}`} variant="secondary" className="w-full">
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
      <div className="sticky top-[84px] rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-3.5">
          <h2 className="font-display text-[14px] font-[700] text-ink">Tanışabileceğin kişiler</h2>
          <p className="mt-0.5 text-[11px] text-ink-2">Ortak ilgi alanlarınıza ve bölümünüze göre</p>
        </div>
        <ul className="flex flex-col divide-y divide-line px-4">
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
        <div className="border-t border-line bg-surface-2 px-4 py-2.5 text-center">
          <Link
            href="/network?sekme=tanistirmalar"
            className={cn("rounded-control text-[12px] font-[650] text-ink hover:underline", focusRing)}
          >
            Tümünü Network&apos;te gör
          </Link>
        </div>
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

/** Misafir ve doğrulanmamış kullanıcılar için tanıtım sayfası: tam ekran, tek başlıklı bölümler. */
function Landing({
  viewer,
  query,
}: {
  viewer: CurrentUser | null;
  query: Record<string, string | string[] | undefined>;
}) {
  const signedIn = viewer !== null;

  return (
    <div data-bleed className="flex flex-col">
      <DeletedNotice query={query} />
      <LandingHero signedIn={signedIn} />
      <StripScreen />
      <VerifiedScreen />
      <ChatScreen />
      <ClosingScreen signedIn={signedIn} />
    </div>
  );
}
