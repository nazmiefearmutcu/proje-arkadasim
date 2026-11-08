import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";
import { getCounters } from "@/lib/counters";

/**
 * Kabuklu sayfalar: üst bar, içerik ve alt menü. Oturum ve rozet sayıları burada bir kez okunur;
 * üst bar ve alt menü aynı değerleri alır.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const counters = user ? await getCounters(user.id) : null;

  return (
    <>
      <TopBar
        user={
          user
            ? {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                avatarPath: user.avatarPath,
                disciplineGroup: user.disciplineGroup,
                verificationStatus: user.verificationStatus,
                interestsJson: user.interestsJson,
                city: user.city,
                isAdmin: isAdmin(user),
              }
            : null
        }
        counters={counters}
        logout={logoutAction}
      />
      <main className="mx-auto flex w-full max-w-[640px] flex-col px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav initial={counters} />
    </>
  );
}
