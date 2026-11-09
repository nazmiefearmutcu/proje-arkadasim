// Yasal yapılandırma (spec §6). Köşeli parantez içindeki değerler operatör tarafından
// doldurulacak veriler. Kod bunları çözemez; yayından önce gerçek bilgilerle değiştirilmeli
// ve yasal metinler avukat onayıyla yayımlanmalıdır.

// Aydınlatma metni ve rıza metinlerinin sürümü. Metin değişince artırılır.
export const LEGAL_VERSION = "2026-11-09";

export const LEGAL = {
  // [Veri sorumlusu unvanı]: operatör doldurur.
  controllerName: "[Veri sorumlusu unvanı]",
  // [Açık adres]: operatör doldurur.
  address: "[Açık adres]",
  // [KVKK başvuru e-postası]: operatör doldurur. KVKK m.11 başvuruları bu adrese gelir; posta
  // alabilen gerçek bir adres olmalıdır (aydınlatma metni, yardım ve ayarlar sayfasında görünür).
  email: "[KVKK başvuru e-postası]",
  // [KEP adresi]: operatör doldurur.
  kep: "[KEP adresi]",
  // [VERBİS kayıt no — varsa]: operatör doldurur.
  verbisNo: "[VERBİS kayıt no — varsa]",
  // [Barındırma ülkesi]: operatör doldurur (ör. "Türkiye"). Gizlilik sayfasında olgu olarak yazılır;
  // sunucunun gerçekte bulunduğu ülke olmalıdır.
  hostingCountry: "[Barındırma ülkesi]",
} as const;

// Yayından önce doldurulması zorunlu alanlar (spec §6.3). VERBİS numarası "varsa" olduğu için yoktur.
const REQUIRED_OPERATOR_FIELDS = ["controllerName", "address", "email", "kep", "hostingCountry"] as const;

type OperatorFields = Record<(typeof REQUIRED_OPERATOR_FIELDS)[number], string>;

/** Zorunlu operatör alanlarından biri hâlâ köşeli parantezli şablon değerse true döner. */
export function hasLegalPlaceholders(legal: OperatorFields = LEGAL): boolean {
  return REQUIRED_OPERATOR_FIELDS.some((key) => legal[key].trim().startsWith("["));
}

// Belge doğrulamasında maskelenmiş metni işleyen yapay zeka sağlayıcısı (spec §5.2, §6.3).
export const AI_PROVIDER = {
  name: "OpenAI",
  company: "OpenAI, L.L.C.",
  country: "Amerika Birleşik Devletleri",
} as const;

// Yapay zeka aktarım rızasının geçerli sayıldığı en eski metin sürümü. Sağlayıcı ya da alıcı ülke
// değişince güncellenir; daha eski sürümle verilmiş rıza (ör. DeepSeek/Çin) yeni aktarımı kapsamaz.
export const AI_CONSENT_MIN_VERSION = "2026-11-09";

// Yurt dışına aktarım için açık rıza beyanı (spec §4.1, birebir). Kayıt formu, /dogrulama ve
// /ayarlar aynı metni bu sabitten gösterir; metin değişirse LEGAL_VERSION artırılır.
export const AI_CONSENT_STATEMENT =
  "Maskelenmiş belge metnimin yapay zeka incelemesi için yurt dışına (OpenAI, ABD) aktarılmasına açık rıza veriyorum.";

// Saklama süreleri (gün ya da dakika).
export const MASKED_TEXT_RETENTION_DAYS = 30;
export const SESSION_DAYS = 30;
export const RESET_TOKEN_MINUTES = 60;
