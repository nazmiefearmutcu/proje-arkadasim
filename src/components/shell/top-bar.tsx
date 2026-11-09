import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { focusRing } from "@/components/ui/styles";
import type { Counters } from "@/lib/counters";
import { getSearchSuggestions, type SuggestionUser } from "@/lib/search-suggestions";
import { AvatarMenu } from "./avatar-menu";
import { NotificationBell } from "./notification-bell";
import { SearchBar } from "./search-bar";

/** Üst bar için oturum açık kullanıcının alanları. Yalnız kendi görünümü için kullanılır. */
export interface TopBarUser extends SuggestionUser {
  firstName: string;
  lastName: string;
  username: string;
  avatarPath: string | null;
  verificationStatus: string;
  isAdmin: boolean;
}

export interface TopBarProps {
  user: TopBarUser | null;
  counters: Counters | null;
  logout: () => Promise<void>;
}

/**
 * Üst bar (60 px, yapışkan): profil menüsü, büyük arama kutusu ve bildirim zili.
 * Masaüstünde (lg) solda marka, ortada arama, sağda zil ve profil menüsü yer alır.
 * Sunucu bileşenidir; öneriler ve kullanıcı alanları burada hazırlanıp istemci bileşenlerine verilir.
 */
export function TopBar({ user, counters, logout }: TopBarProps) {
  const suggestions = getSearchSuggestions(user);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[60px] max-w-[640px] items-center gap-2 px-3 lg:max-w-[1440px] lg:gap-8 lg:px-6">
        <Link
          href="/"
          className={`hidden w-[220px] shrink-0 rounded-control py-2 lg:order-1 lg:inline-flex ${focusRing}`}
        >
          <Logo />
        </Link>
        <div className="contents lg:order-4 lg:block lg:shrink-0">
          <AvatarMenu
            user={
              user
                ? {
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    username: user.username,
                    avatarPath: user.avatarPath,
                    disciplineGroup: user.disciplineGroup,
                    verificationStatus: user.verificationStatus,
                  }
                : null
            }
            isAdmin={user?.isAdmin ?? false}
            logout={logout}
          />
        </div>
        <div className="flex min-w-0 flex-1 lg:order-2 lg:max-w-[640px]">
          <SearchBar suggestions={suggestions} />
        </div>
        <div className="lg:order-3 lg:ml-auto">
          <NotificationBell initial={counters} />
        </div>
      </div>
    </header>
  );
}
