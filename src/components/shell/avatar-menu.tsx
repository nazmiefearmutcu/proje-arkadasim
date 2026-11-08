"use client";

import {
  CircleHelp,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  UserPlus,
  UserRound,
  UserRoundPen,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { VERIFICATION_STATUSES, labelOf } from "@/config/taxonomy";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { focusRing } from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

export interface AvatarMenuUser {
  name: string;
  username: string;
  avatarPath: string | null;
  disciplineGroup: string | null;
  verificationStatus: string;
}

export interface AvatarMenuProps {
  /** Oturum açık kullanıcı; misafirse null. */
  user: AvatarMenuUser | null;
  isAdmin: boolean;
  /** Çıkış formunun eylemi (sunucu eylemi). */
  logout: () => Promise<void>;
}

const rowClasses =
  "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left t-body text-ink hover:bg-surface-2";

function MenuLink({
  href,
  icon: Icon,
  label,
  trailing,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link href={href} onClick={onNavigate} className={cn(rowClasses, focusRing)}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-2" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

/**
 * Üst bar profil menüsü. Misafirde giriş ve kayıt bağlantıları, oturum açıkta hesap bağlantıları gösterilir.
 * Profil sayfaları yalnız doğrulanmış kişilere açıktır: doğrulanmamış kullanıcıya "Profilim" yerine
 * "Profilini düzenle" (Ayarlar > Profil) gösterilir, böylece açıklamasız /dogrulama yönlendirmesi olmaz.
 */
export function AvatarMenu({ user, isAdmin, logout }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const verified = user?.verificationStatus === "VERIFIED";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={user ? "Hesap menüsünü aç" : "Misafir menüsünü aç"}
        aria-haspopup="dialog"
        className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", focusRing)}
      >
        {user ? (
          <Avatar name={user.name} seed={user.username} avatarPath={user.avatarPath} disciplineGroup={user.disciplineGroup} />
        ) : (
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <UserRound aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </span>
        )}
      </button>

      <Sheet open={open} onClose={close} title={user ? user.name : "Hesap"}>
        {user ? (
          <>
            <div className="flex flex-col gap-3 px-2 pb-3">
              <p className="t-meta text-ink-3">@{user.username}</p>
              <div>
                <Chip selected={verified}>
                  {labelOf(VERIFICATION_STATUSES, user.verificationStatus)}
                </Chip>
              </div>
            </div>
            <nav aria-label="Hesap" className="flex flex-col">
              {verified ? (
                <MenuLink href={`/u/${user.username}`} icon={UserRound} label="Profilim" onNavigate={close} />
              ) : (
                <MenuLink href="/ayarlar#profil" icon={UserRoundPen} label="Profilini düzenle" onNavigate={close} />
              )}
              <MenuLink href="/projeler?filtre=benim" icon={LayoutGrid} label="Projelerim" onNavigate={close} />
              <MenuLink href="/dogrulama" icon={ShieldCheck} label="Belge durumu" onNavigate={close} />
              <MenuLink href="/ayarlar" icon={Settings} label="Ayarlar" onNavigate={close} />
              <MenuLink href="/kvkk/aydinlatma" icon={Lock} label="Gizlilik ve KVKK" onNavigate={close} />
              <MenuLink href="/yardim" icon={CircleHelp} label="Yardım" onNavigate={close} />
              {isAdmin ? (
                <MenuLink href="/admin" icon={Shield} label="Yönetim paneli" onNavigate={close} />
              ) : null}
              <form action={logout} className="flex">
                <SubmitButton unstyled className={cn(rowClasses, "disabled:opacity-60", focusRing)}>
                  <LogOut aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-2" />
                  <span>Çıkış yap</span>
                </SubmitButton>
              </form>
            </nav>
          </>
        ) : (
          <nav aria-label="Misafir" className="flex flex-col">
            <MenuLink href="/giris" icon={LogIn} label="Giriş yap" onNavigate={close} />
            <MenuLink href="/kayit" icon={UserPlus} label="Hesap oluştur" onNavigate={close} />
            <MenuLink href="/kvkk/aydinlatma" icon={Lock} label="Gizlilik ve KVKK" onNavigate={close} />
            <MenuLink href="/yardim" icon={CircleHelp} label="Yardım" onNavigate={close} />
          </nav>
        )}
      </Sheet>
    </>
  );
}
