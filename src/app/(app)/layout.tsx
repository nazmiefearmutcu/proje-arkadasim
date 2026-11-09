import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SideNav } from "@/components/shell/side-nav";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";
import { getCounters } from "@/lib/counters";

/**
 * Kabuklu sayfalar: üst bar, içerik ve alt menü. Oturum ve rozet sayıları burada bir kez okunur;
 * üst bar ve alt menü aynı değerleri alır.
 *
 * Masaüstünde (lg) alt menü yerine sol kenar menü çıkar ve içerik genişler. Formlar ve okuma
 * sayfaları 760 px'te kalır; içinde `data-wide` işaretli bir öğe olan sayfalar (akış, proje listeleri,
 * arama, profil, mesajlar) tüm sütunu kullanır.
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
      <div className="mx-auto w-full lg:grid lg:max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-6">
        <SideNav initial={counters} />
        <main className="mx-auto flex w-full max-w-[640px] min-w-0 flex-col px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:max-w-[760px] lg:px-0 lg:pt-6 lg:pb-12 lg:has-[[data-wide]]:max-w-none">
          {children}
        </main>
      </div>
      <BottomNav initial={counters} />
    </>
  );
}
