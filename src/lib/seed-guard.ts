/**
 * Tohum (seed) çalıştırma koruması. Üretimde varsayılan parolalı bir yönetici hesabı oluşmasın diye
 * tohum yalnız geliştirme ortamında çalışır. Üretimde bilerek çalıştırmak için SEED_ALLOW_PRODUCTION=true
 * gerekir; bu durumda yönetici parolası örnek dosyadaki değerden farklı olmalıdır. Geliştirmede örnek parola
 * kabul edilir (yerel demo verisi).
 */

/** .env.example dosyasındaki yerel geliştirme parolası. Üretimde bu değerle yönetici oluşturulmaz. */
export const PUBLISHED_EXAMPLE_ADMIN_PASSWORD = "Yonetici-Dev-2026!";

export function seedProblem(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV === "production" && env.SEED_ALLOW_PRODUCTION !== "true") {
    return "Tohum üretim ortamında (NODE_ENV=production) çalıştırılamaz. Bilerek çalıştırmak için SEED_ALLOW_PRODUCTION=true tanımlayın.";
  }
  if (env.NODE_ENV === "production" && (env.SEED_ADMIN_PASSWORD ?? "") === PUBLISHED_EXAMPLE_ADMIN_PASSWORD) {
    return "SEED_ADMIN_PASSWORD örnek dosyadaki yayımlanmış değer. Kendi parolanızı belirleyin.";
  }
  return null;
}
