import { redirect } from "next/navigation";
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
 * Masaüstünde (lg) alt menü yerine ekranın sol kenarında sabit, 230 px genişliğinde beyaz menü çıkar;
 * içerik onun sağında başlar. Formlar ve okuma sayfaları 760 px'te kalır; içinde `data-wide` işaretli bir öğe olan sayfalar (akış, proje listeleri,
 * arama, profil, mesajlar) tüm sütunu kullanır.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Editörün kendi arayüzü vardır (spec 2026-11-27 §2); öğrenci arayüzüne girmez.
  if (user && isAdmin(user)) redirect("/editor");
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
      <SideNav initial={counters} />
      <div className="app-content w-full lg:pl-[230px]">
        <main className="mx-auto flex w-full max-w-[640px] min-w-0 flex-col px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:max-w-[808px] lg:px-6 lg:pt-6 lg:pb-12 lg:has-[[data-wide]]:max-w-[1210px]">
          {children}
        </main>
      </div>
      <BottomNav initial={counters} />
    </>
  );
}
