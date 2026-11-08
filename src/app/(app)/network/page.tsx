import Link from "next/link";
import { DisciplineSpine } from "@/components/common/discipline-spine";
import { UserRow } from "@/components/common/user-row";
import { DismissButton } from "@/components/social/dismiss-button";
import { FollowButton } from "@/components/social/follow-button";
import { InviteResponse } from "@/components/social/invite-response";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { focusRing } from "@/components/ui/styles";
import { requireVerified } from "@/lib/auth/guards";
import { displayName } from "@/lib/permissions";
import { listIncomingInvites } from "@/lib/social/network-queries";
import { createIntroductions, getSuggestions } from "@/lib/social/suggestions";
import { getFollowCounts, listFollowers, listFollowing } from "@/lib/social/follow-queries";

export const metadata = { title: "Network" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = ["davetler", "tanistirmalar", "takipciler", "takip"] as const;
type Tab = (typeof TABS)[number];

function parseTab(raw: string | undefined): Tab {
  return (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "davetler";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireVerified("/network");
  const query = await searchParams;
  const rawTab = Array.isArray(query.sekme) ? query.sekme[0] : query.sekme;
  const tab = parseTab(rawTab);

  const [invites, counts] = await Promise.all([listIncomingInvites(viewer.id), getFollowCounts(viewer.id)]);

  const items: TabItem[] = [
    { value: "davetler", label: "Davetler", count: invites.length },
    { value: "tanistirmalar", label: "Tanıştırmalar" },
    { value: "takipciler", label: "Takipçiler", count: counts.followers },
    { value: "takip", label: "Takip", count: counts.following },
  ];

  return (
    <>
      <PageHeader title="Network" />
      <Tabs items={items} active={tab} basePath="/network" label="Network sekmeleri" />

      <div className="pt-4">
        {tab === "davetler" ? <InvitesTab invites={invites} viewer={viewer} /> : null}
        {tab === "tanistirmalar" ? <IntroductionsTab viewerId={viewer.id} viewer={viewer} /> : null}
        {tab === "takipciler" ? <FollowersTab viewerId={viewer.id} viewer={viewer} /> : null}
        {tab === "takip" ? <FollowingTab viewerId={viewer.id} viewer={viewer} /> : null}
      </div>
    </>
  );
}

type Viewer = Parameters<typeof displayName>[1];

async function InvitesTab({
  invites,
  viewer,
}: {
  invites: Awaited<ReturnType<typeof listIncomingInvites>>;
  viewer: Viewer;
}) {
  if (invites.length === 0) {
    return (
      <EmptyState
        title="Bekleyen davetin yok."
        text="Projelere göz atıp başvurabilirsin."
        action={
          <ButtonLink href="/projeler" variant="secondary">
            Projelere göz at
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {invites.map((invite) => (
        <li key={invite.id}>
          <Card className="flex flex-col gap-3 py-4 px-4">
            <DisciplineSpine orientation="horizontal" groups={invite.project.disciplineGroups} />
            <h2 className="t-card min-w-0 text-ink">
              <Link href={`/projeler/${invite.project.id}`} className={`rounded-control ${focusRing}`}>
                {invite.project.title}
              </Link>
            </h2>
            <div className="flex flex-col gap-1">
              <span className="t-meta text-ink-3">Davet eden</span>
              <UserRow person={invite.inviter} name={displayName(invite.inviter, viewer)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip>{invite.roleTitle ?? "Rol fark etmez"}</Chip>
            </div>
            {invite.message ? (
              <p className="t-body whitespace-pre-line text-ink-2">{invite.message}</p>
            ) : null}
            <InviteResponse inviteId={invite.id} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function IntroductionsTab({ viewerId, viewer }: { viewerId: string; viewer: Viewer }) {
  await createIntroductions(viewerId);
  const suggestions = await getSuggestions(viewerId, 12);

  return (
    <div className="flex flex-col gap-3">
      <p className="t-body text-ink-2">Farklı disiplinlerden, ilgi alanların ve şehrine göre seçtiğimiz kişiler.</p>
      {suggestions.length === 0 ? (
        <EmptyState
          title="Şimdilik önerimiz yok"
          text="Beceri ve ilgi alanlarını doldurduğunda sana daha iyi öneriler çıkarabiliriz."
          action={
            <ButtonLink href="/ayarlar" variant="secondary">
              Ayarlarını düzenle
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {suggestions.map((suggestion) => (
            <li key={suggestion.person.id}>
              <UserRow
                person={suggestion.person}
                name={displayName(suggestion.person, viewer)}
                reason={suggestion.reason || undefined}
                action={
                  <div className="flex flex-col items-end gap-1">
                    <FollowButton userId={suggestion.person.id} initialFollowing={false} />
                    <DismissButton userId={suggestion.person.id} />
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function FollowersTab({ viewerId, viewer }: { viewerId: string; viewer: Viewer }) {
  const entries = await listFollowers(viewerId, viewerId);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Henüz takipçin yok."
        text="Projelerini paylaştıkça ve profilini doldurdukça seni takip edenler artar."
        action={
          <ButtonLink href="/paylas" variant="secondary">
            Projeyi paylaş
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.person.id}>
          <UserRow
            person={entry.person}
            name={displayName(entry.person, viewer)}
            action={<FollowButton userId={entry.person.id} initialFollowing={entry.viewerFollows} />}
          />
        </li>
      ))}
    </ul>
  );
}

async function FollowingTab({ viewerId, viewer }: { viewerId: string; viewer: Viewer }) {
  const entries = await listFollowing(viewerId, viewerId);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Kimseyi takip etmiyorsun."
        text="Takip ettiğin kişilerin projeleri ana sayfanda görünür."
        action={
          <ButtonLink href="/network?sekme=tanistirmalar" variant="secondary">
            Önerilere bak
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.person.id}>
          <UserRow
            person={entry.person}
            name={displayName(entry.person, viewer)}
            action={<FollowButton userId={entry.person.id} initialFollowing={entry.viewerFollows} />}
          />
        </li>
      ))}
    </ul>
  );
}
