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
  /** `/ara` sayfasındaki sorgu, arama kutusunda gösterilir. */
  initialQuery?: string;
}

/**
 * Üst bar (60 px, yapışkan): profil menüsü, büyük arama kutusu ve bildirim zili.
 * Sunucu bileşenidir; öneriler ve kullanıcı alanları burada hazırlanıp istemci bileşenlerine verilir.
 */
export function TopBar({ user, counters, logout, initialQuery }: TopBarProps) {
  const suggestions = getSearchSuggestions(user);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[60px] max-w-[640px] items-center gap-2 px-3">
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
        <SearchBar suggestions={suggestions} initialQuery={initialQuery} />
        <NotificationBell initial={counters} />
      </div>
    </header>
  );
}
