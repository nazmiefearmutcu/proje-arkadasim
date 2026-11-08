import { notFound } from "next/navigation";
import { DisciplineChip } from "@/components/common/discipline-chip";
import { ProjectCard } from "@/components/common/project-card";
import { VerifiedStamp } from "@/components/common/verified-stamp";
import { BlockButton } from "@/components/social/block-button";
import { ProfileActions } from "@/components/social/profile-actions";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { requireVerified } from "@/lib/auth/guards";
import { displayName } from "@/lib/permissions";
import { loadProfile } from "@/lib/social/profile";

export const metadata = { title: "Profil" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await requireVerified(`/u/${encodeURIComponent(username)}`);
  const lookup = await loadProfile(username, viewer);

  if (lookup.kind === "missing") notFound();

  if (lookup.kind === "blocked") {
    return (
      <section className="flex flex-col gap-4 pt-4">
        <p className="t-card text-ink">Bu profili görüntüleyemezsin.</p>
        {lookup.blockedByViewer ? <BlockButton userId={lookup.targetId} blocked /> : null}
      </section>
    );
  }

  const { person, isSelf, follow, counts, ownedProjects, memberProjects, openProjectsForInvite } = lookup;
  const name = displayName(person, viewer);
  const isVerified = person.verificationStatus === "VERIFIED";

  const yearLine =
    person.academicStatus === "GRADUATE" && person.graduationYear
      ? `${person.graduationYear} mezunu`
      : person.classYear
        ? `${person.classYear}. sınıf`
        : person.graduationYear
          ? `${person.graduationYear} mezunu`
          : null;

  return (
    <>
      <header className="flex flex-col gap-4 pt-2 pb-4">
        <Avatar
          size={96}
          name={name}
          seed={person.username}
          avatarPath={person.avatarPath}
          disciplineGroup={person.disciplineGroup}
        />
        <div className="flex flex-col gap-2">
          <h1 className="t-page text-ink">{name}</h1>
          {isVerified ? <VerifiedStamp size="lg" academicStatus={person.academicStatus} /> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {person.disciplineGroup ? <DisciplineChip id={person.disciplineGroup} /> : null}
            {person.department ? <span className="t-label text-ink">{person.department}</span> : null}
          </div>
          {person.university ? <p className="t-body text-ink-2">{person.university}</p> : null}
          {person.faculty ? <p className="t-meta text-ink-2">{person.faculty}</p> : null}
          {yearLine ? <p className="t-meta text-ink-2">{yearLine}</p> : null}
          {person.city ? <p className="t-meta text-ink-2">{person.city}</p> : null}
        </div>

        {person.bio ? <p className="t-body t-prose whitespace-pre-line text-ink-2">{person.bio}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          {person.lookingForProject ? <Chip selected>Proje arıyor</Chip> : null}
        </div>

        <div className="flex flex-wrap gap-4 t-label text-ink-2">
          <span>{counts.followers} takipçi</span>
          <span>{counts.following} takip</span>
        </div>

        {isSelf ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/ayarlar" variant="secondary">
              Profili düzenle
            </ButtonLink>
            <ButtonLink href="/dogrulama" variant="secondary">
              Belge durumu
            </ButtonLink>
          </div>
        ) : (
          <ProfileActions
            targetId={person.id}
            username={person.username}
            name={name}
            initialFollowing={follow.following}
            followsYou={follow.followsYou}
            openProjects={openProjectsForInvite}
          />
        )}
      </header>

      <Section title="Beceriler">
        {person.skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {person.skills.map((skill) => (
              <li key={skill}>
                <Chip>{skill}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body text-ink-2">Henüz beceri eklenmemiş.</p>
        )}
      </Section>

      <Section title="İlgi alanları">
        {person.interests.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {person.interests.map((interest) => (
              <li key={interest}>
                <Chip>{interest}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body text-ink-2">Henüz ilgi alanı eklenmemiş.</p>
        )}
      </Section>

      <Section title="Projeler">
        {ownedProjects.length > 0 ? (
          <div className="flex flex-col gap-3">
            {ownedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} viewer={viewer} />
            ))}
          </div>
        ) : isSelf ? (
          <EmptyState
            title="Henüz proje paylaşmadın."
            text="Bir proje paylaşınca burada görünür."
            action={
              <ButtonLink href="/paylas" variant="secondary">
                İlk projeni paylaş
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState title="Henüz proje paylaşmadı" />
        )}
      </Section>

      <Section title="Katıldığı projeler">
        {memberProjects.length > 0 ? (
          <div className="flex flex-col gap-3">
            {memberProjects.map((project) => (
              <ProjectCard key={project.id} project={project} viewer={viewer} />
            ))}
          </div>
        ) : (
          <p className="t-body text-ink-2">Henüz bir ekibe katılmadı.</p>
        )}
      </Section>

    </>
  );
}
