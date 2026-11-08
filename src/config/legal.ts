// Yasal yapılandırma (spec §6). Köşeli parantez içindeki değerler operatör tarafından
// doldurulacak veriler. Kod bunları çözemez; yayından önce gerçek bilgilerle değiştirilmeli
// ve yasal metinler avukat onayıyla yayımlanmalıdır.

// Aydınlatma metni ve rıza metinlerinin sürümü. Metin değişince artırılır.
export const LEGAL_VERSION = "2026-11-08";

export const LEGAL = {
  // [Veri sorumlusu unvanı]: operatör doldurur.
  controllerName: "[Veri sorumlusu unvanı]",
  // [Açık adres]: operatör doldurur.
  address: "[Açık adres]",
  email: "kvkk@proje-arkadasim.local",
  // [KEP adresi]: operatör doldurur.
  kep: "[KEP adresi]",
  // [VERBİS kayıt no — varsa]: operatör doldurur.
  verbisNo: "[VERBİS kayıt no — varsa]",
  hostingCountry: "Türkiye",
} as const;

// Belge doğrulamasında maskelenmiş metni işleyen yapay zeka sağlayıcısı (spec §5.2, §6.3).
export const AI_PROVIDER = {
  name: "DeepSeek",
  company: "Hangzhou DeepSeek Artificial Intelligence Co., Ltd.",
  country: "Çin Halk Cumhuriyeti",
} as const;

// Saklama süreleri (gün ya da dakika).
export const MASKED_TEXT_RETENTION_DAYS = 30;
export const SESSION_DAYS = 30;
export const RESET_TOKEN_MINUTES = 60;
