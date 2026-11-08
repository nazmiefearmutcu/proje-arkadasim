/**
 * Tohum (seed) çalıştırma korumaları. Tohum yalnız geliştirme içindir: önce TÜM tabloları siler, sonra
 * demo verisini yükler. Bu yüzden:
 * - Üretimde (NODE_ENV=production) yalnız SEED_ALLOW_PRODUCTION=true ile çalışır ve .env.example'daki
 *   yayımlanmış parolalar reddedilir (yönetici ve örnek kullanıcı parolası).
 * - NODE_ENV kabukta tanımlı olmasa bile, veritabanında kullanıcı varsa yalnız açık `--wipe` bayrağıyla
 *   çalışır (`npm run seed -- --wipe`). Boş veritabanında (ör. `prisma migrate reset` sonrası) bayrak
 *   gerekmez.
 * Üretimde yönetici atamak için tohum değil, `npm run make-admin -- <e-posta>` kullanılır.
 */

/** .env.example dosyasındaki yerel geliştirme parolası. Üretimde bu değerle yönetici oluşturulmaz. */
export const PUBLISHED_EXAMPLE_ADMIN_PASSWORD = "Yonetici-Dev-2026!";

/** .env.example dosyasındaki örnek kullanıcı parolası. Üretimde bu değerle kullanıcı oluşturulmaz. */
export const PUBLISHED_EXAMPLE_USER_PASSWORD = "Ogrenci-Dev-2026!";

/** Dolu bir veritabanını bilerek silip yeniden doldurmak için verilmesi gereken komut satırı bayrağı. */
export const SEED_WIPE_FLAG = "--wipe";

export function seedProblem(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV === "production" && env.SEED_ALLOW_PRODUCTION !== "true") {
    return "Tohum üretim ortamında (NODE_ENV=production) çalıştırılamaz. Bilerek çalıştırmak için SEED_ALLOW_PRODUCTION=true tanımlayın.";
  }
  if (env.NODE_ENV === "production" && (env.SEED_ADMIN_PASSWORD ?? "") === PUBLISHED_EXAMPLE_ADMIN_PASSWORD) {
    return "SEED_ADMIN_PASSWORD örnek dosyadaki yayımlanmış değer. Kendi parolanızı belirleyin.";
  }
  if (env.NODE_ENV === "production" && (env.SEED_USER_PASSWORD ?? "") === PUBLISHED_EXAMPLE_USER_PASSWORD) {
    return "SEED_USER_PASSWORD örnek dosyadaki yayımlanmış değer. Kendi parolanızı belirleyin.";
  }
  return null;
}

/**
 * Veritabanında kullanıcı varsa ve `--wipe` verilmemişse tohumu durduran mesajı döner. Tohum tüm
 * tabloları sildiği için gerçek kullanıcı verisi yanlışlıkla silinmesin.
 */
export function seedWipeProblem(existingUsers: number, argv: readonly string[]): string | null {
  if (existingUsers === 0 || argv.includes(SEED_WIPE_FLAG)) return null;
  return [
    `Veritabanında ${existingUsers} kullanıcı var. Tohum tüm tabloları siler ve yerine demo verisi yükler; bu yüzden durduruldu.`,
    `Yalnız bir geliştirme veritabanını bilerek silip yeniden doldurmak için: npm run seed -- ${SEED_WIPE_FLAG}`,
    "Üretimde yönetici atamak için tohum yerine: npm run make-admin -- <e-posta>",
  ].join("\n");
}
