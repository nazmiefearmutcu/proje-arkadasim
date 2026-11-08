"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { OpenProjectForInvite } from "@/lib/projects/queries";
import { BlockButton } from "./block-button";
import { FollowButton } from "./follow-button";
import { InviteSheet } from "./invite-sheet";
import { ReportSheet } from "./report-sheet";

export interface ProfileActionsProps {
  targetId: string;
  username: string;
  name: string;
  initialFollowing: boolean;
  followsYou: boolean;
  /** Görüntüleyenin açık projeleri. Boşsa davet yerine "önce proje paylaş" yönlendirmesi çıkar. */
  openProjects: OpenProjectForInvite[];
}

/**
 * Başkasının profilindeki eylemler: takip, mesaj, davet ve diğer işlemler (engelle, şikayet et).
 * Paneller burada açılır; hiçbiri başka panelin içinde değildir.
 */
export function ProfileActions({
  targetId,
  username,
  name,
  initialFollowing,
  followsYou,
  openProjects,
}: ProfileActionsProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {followsYou ? (
        <div>
          <Chip>Seni takip ediyor</Chip>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-2">
        <FollowButton userId={targetId} initialFollowing={initialFollowing} className="min-w-[140px] flex-1" />
        <ButtonLink
          href={`/mesajlar/yeni?kime=${encodeURIComponent(username)}`}
          variant="secondary"
          className="min-w-[140px] flex-1"
        >
          Mesaj gönder
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {openProjects.length > 0 ? (
          <Button variant="secondary" className="min-w-[140px] flex-1" onClick={() => setInviteOpen(true)}>
            Projeye davet et
          </Button>
        ) : (
          <div className="flex w-full flex-col gap-2 rounded-card border border-line p-3">
            <p className="t-body text-ink-2">Davet etmek için önce bir proje paylaş.</p>
            <Link
              href="/paylas"
              className={cn(
                "t-label inline-flex min-h-11 w-fit items-center rounded-control text-pen underline-offset-2 hover:underline",
                focusRing,
              )}
            >
              Projeyi paylaş
            </Link>
          </div>
        )}
        <Button variant="ghost" size="md" aria-label="Diğer işlemler" onClick={() => setMenuOpen(true)} className="size-11 px-0">
          <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Diğer işlemler">
        <div className="flex flex-col gap-3 px-2 pt-2 pb-2">
          <Button
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            Şikayet et
          </Button>
          <BlockButton userId={targetId} blocked={false} />
        </div>
      </Sheet>

      {openProjects.length > 0 ? (
        <InviteSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          username={username}
          name={name}
          projects={openProjects}
        />
      ) : null}

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        targetId={targetId}
        subject={name}
      />
    </div>
  );
}
