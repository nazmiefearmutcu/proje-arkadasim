# Proje Arkadaşım

Proje Arkadaşım, Türkiye'de üniversite okuyan veya mezun olmuş kişilerin proje paylaşıp projelere
katılabildiği, telefonda rahat kullanılan bir web uygulamasıdır. Herkes projeleri gezebilir; proje
paylaşmak, başvurmak, takip etmek ve mesajlaşmak için hesabın belge ile doğrulanmış olması gerekir.
Belge doğrulaması, öğrenci ya da mezuniyet belgesinin yerel olarak okunup maskelenmesiyle yapılır.

Disiplinlerarası ekip kurmak, kişinin kendi bölümü ve çevresiyle sınırlı kalmadan doğru proje arkadaşını
bulmasını kolaylaştırmak amaçlanır. Ayrıntılı tasarım için `docs/superpowers/specs/2026-11-08-proje-arkadasim-design.md`
dosyasına (Türkçe) bakın.

## Özellikler

- Misafir kullanıcılar projeleri listeleyebilir, filtreleyebilir ve detaylarını görebilir.
- Belge doğrulama: PDF (e-Devlet öğrenci belgesi, YÖK mezun belgesi) ya da fotoğraf yükleme, canlı adım göstergesi, sonuç ve tekrar deneme.
- Proje paylaşma: kategori, aşama, çalışma şekli, şehir, etiketler ve 1–6 arası aranan rol (disiplin grubu ve kişi sayısıyla).
- Katılma başvurusu, proje sahibi için başvuru yönetimi, davet gönderme ve kabul/ret.
- Ana sayfada yalnızca takip edilenlerin projeleri; tanıştırma önerileri (Network).
- Takip, engelleme, şikayet ve yönetici kuyruğu (doğrulama incelemesi, şikayetler).
- Mesaj isteği akışı: takip edilmeyen birine ilk mesaj istek olarak gider, kabul edilene kadar ikinci mesaj gönderilemez.
- Türkçe duyarsız arama (kişi ve proje), kişiye özel arama önerileri.
- KVKK hakları: verilerini indirme (JSON), açık rızayı geri alma, hesabı kalıcı silme.

## Teknoloji

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4
- Prisma 6 ile SQLite (PostgreSQL'e geçişe uygun şema)
- zod 4 (doğrulama), Node'un yerleşik `crypto.scrypt` (şifre özeti)
- `unpdf` (PDF metin katmanı), `tesseract.js` (görsel OCR), `openai` SDK (DeepSeek için OpenAI uyumlu uç nokta)
- `nodemailer` (SMTP; yoksa e-postalar konsola yazılır), `lucide-react`
- Vitest 5 (birim ve entegrasyon testleri)

## Kurulum

Gereksinimler: **Node 24** ve npm 11.

```bash
# 1. Bağımlılıkları kur (postinstall adımında Prisma istemcisi üretilir)
npm install

# 2. Ortam dosyasını oluştur
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 3. Gizli anahtarları üret ve .env içindeki boş değerlere yapıştır
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Bu komutu iki kez çalıştırın: biri SESSION_SECRET, diğeri DOC_HASH_PEPPER için.

# 4. Veritabanını oluştur (prisma/dev.db)
npx prisma migrate dev

# 5. Örnek veriyi yükle (mevcut tüm verileri siler)
npm run seed

# 6. Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın. Telefon görünümünü denemek için tarayıcı geliştirici
araçlarında 375 px genişlik seçin.

Belge doğrulaması geliştirmede `VERIFIER_PROVIDER="mock"` ile çalışır; gerçek bir yapay zeka
incelemesi için bkz. [Belge doğrulama nasıl çalışır](#belge-doğrulama-nasıl-çalışır).

## Demo hesaplar

`npm run seed` aşağıdaki hesapları oluşturur. Tüm parolalar yalnız yerel geliştirme içindir ve
`.env.example` dosyasındadır: yönetici için `SEED_ADMIN_PASSWORD`, diğer hesaplar için `SEED_USER_PASSWORD`.
Parolalar bu README'de ya da tohum çıktısında yazılmaz.

| Hesap | E-posta | Durum | Not |
|---|---|---|---|
| Yönetici | `admin@proje-arkadasim.local` (`SEED_ADMIN_EMAIL`) | Doğrulanmış, ADMIN | Yönetim paneli (`/admin`) |
| Demo kullanıcı: Elif Yılmaz | `elif.yilmaz@ornek.edu.tr` | Doğrulanmış, İşletme, Ege Üniversitesi | Bildirimli ve davetli demo hesabı; açık proje sahibi |
| Doğrulanmış kullanıcılar | `<kullanıcı-adı>@ornek.edu.tr` (16 kişi) | Doğrulanmış | Kişi arama, takip, mesajlaşma |
| Doğrulanmamış | `yeni.kullanici@ornek.edu.tr` | Doğrulanmadı | Doğrulama sayfasına yönlendirilir |
| Manuel incelemede | `oguz.tuna@ornek.edu.tr` | Manuel inceleme | Yönetici kuyruğunda görünür |

Tohum ayrıca 12 proje, bekleyen katılma başvuruları ve davetler, bir aktif sohbet, bir mesaj isteği ve açık bir şikayet üretir.

## Ortam değişkenleri

Tüm değişkenler `.env` dosyasında tanımlanır. `.env` git'e eklenmez; yalnız `.env.example` paylaşılır.

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | Evet | Veritabanı adresi. Varsayılan `file:./dev.db` (SQLite, `prisma/` klasörüne göre). |
| `SESSION_SECRET` | Hayır (kullanılmıyor) | `.env.example` içinde yer alır, ancak bu sürümde kod tarafından okunmaz. Oturum jetonları rastgele üretilir ve veritabanında özetlenir. |
| `DOC_HASH_PEPPER` | Evet | Belge özetlerinin (HMAC-SHA256) gizli biberi. Tanımlı değilse belge yükleme `ERROR` döner. Değişirse eski özetler eşleşmez. |
| `VERIFIER_PROVIDER` | Evet | Belge inceleyicisi: `mock` (yalnız geliştirme) ya da `deepseek`. Tanınmayan değerde otomatik onay verilmez. |
| `DEEPSEEK_API_KEY` | Gerçek AI için | DeepSeek API anahtarı. Boşsa AI incelemesi çağrılmaz; belgeler manuel incelemeye düşer. |
| `DEEPSEEK_MODEL` | Hayır | Model adı. Varsayılan `deepseek-flash`. |
| `DEEPSEEK_BASE_URL` | Hayır | OpenAI uyumlu uç nokta. Varsayılan `https://api.deepseek.com`. |
| `DEEPSEEK_THINKING` | Hayır | `enabled` ya da `disabled` değerleriyle DeepSeek'in düşünme modunu açıp kapatır. Boşsa istekte gönderilmez. |
| `APP_URL` | Hayır | Uygulamanın dışarıdan erişilen adresi. E-posta bağlantılarında kullanılır. Varsayılan `http://localhost:3000`. |
| `SMTP_URL` | Hayır | Örnek: `smtp://kullanici:parola@sunucu:587`. Boşsa şifre sıfırlama e-postaları yalnız konsola yazılır. |
| `MAIL_FROM` | Hayır | Giden e-postalarda görünen gönderen adresi. |
| `LOGIN_LOG_RETENTION_DAYS` | Hayır | Giriş kayıtlarının (IP, zaman, tarayıcı) saklanma süresi, gün. Varsayılan 365. |
| `TRUST_PROXY` | Hayır | Ters vekil (reverse proxy) arkasındaysa `true` yapın; yalnız o zaman `x-forwarded-for` okunur. Varsayılan `false`. |
| `ADMIN_EMAILS` | Hayır (kullanılmıyor) | Kod bu değişkeni okumaz. Yönetici yetkisi yalnız `role = ADMIN` ile verilir. |
| `AVATAR_DIR` | Hayır | Profil resimlerinin klasörü. Varsayılan `storage/avatars`. |
| `NODE_ENV` | Hayır | `production` ortamında `mock` sağlayıcı ve varsayılan tohum parolası reddedilir, çerezler Secure olur. |
| `SEED_ADMIN_EMAIL` | Tohum için | Tohumda oluşturulan yöneticinin e-postası. |
| `SEED_ADMIN_PASSWORD` | Tohum için | Yöneticinin parolası (yalnız geliştirme). |
| `SEED_USER_PASSWORD` | Tohum için | Tohumdaki örnek kullanıcıların ortak parolası (yalnız geliştirme). |
| `SEED_ALLOW_PRODUCTION` | Hayır | `true` değilse tohum `NODE_ENV=production` ortamında çalışmaz. Bilerek çalıştırmak için `true` yapın ve güçlü bir parola kullanın. |

Anahtar üretmek için: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Belge doğrulama nasıl çalışır

Yükleme `POST /api/verification` üzerinden tek bir istekte tamamlanır; belge bellekte işlenir ve diske ya da veritabanına yazılmaz.

1. **Alım:** Oturum, deneme sınırı (24 saatte 5), boyut (en fazla 10 MB) ve dosyanın gerçek başlangıç baytları kontrol edilir (`%PDF`, JPEG, PNG, WebP). Uzantı ve MIME türüne güvenilmez.
2. **Özet:** `HMAC-SHA256(DOC_HASH_PEPPER, dosya baytları)`. Aynı belge başka bir hesapta onaylıysa belge reddedilir.
3. **Yerel metin çıkarımı:** PDF metin katmanı `unpdf` ile okunur; metin çok kısaysa (taranmış PDF) kullanıcıdan fotoğraf ya da e-Devlet PDF'i istenir. Görseller `tesseract.js` ile yerelde OCR'dan geçer.
4. **Ad eşleştirme:** Kayıtlı ad ve soyad belgede aranır. Soyadın bütün parçaları ve adın en az bir parçası bulunmalıdır; OCR için uzun parçalarda 1 harf farkı tolere edilir.
5. **Yerel maskeleme (yurt dışına çıkmadan önce):** TCKN benzeri 11 haneli sayılar, etiketli değerler (baba adı, ana adı, doğum yeri ve tarihi, öğrenci numarası, uyruk, adres, telefon, e-posta, seri no, barkod, kimlik no), kayıtlı ad ve soyad, "Adı Soyadı" değeri, e-posta, telefon, IBAN ve kalan uzun sayılar maskelenir. 4 haneli yıllar ve gg.aa.yyyy tarihleri korunur. Çıktı en fazla 6000 karakterdir.
6. **Yapay zeka incelemesi (yalnız açık rıza varsa):** Yalnızca maskelenmiş metin ve kişisel olmayan PDF meta sinyalleri gönderilir. Görsel ya da dosya asla gönderilmez. Yanıt `zod` ile doğrulanır; geçersizse işlem hata sayılır. Zaman aşımı 20 saniye, boş yanıtta bir kez tekrar.
7. **Karar:** Sıra ile: özet başka hesapta onaylı → reddet; AI çağrılamadı, rıza yok, yanıt geçersiz ya da anahtar yok → **manuel incelemeye al**; belge öğrenci ya da mezun belgesi değil → reddet; ad eşleşmiyor → PDF ise reddet, OCR ise manuel inceleme; yabancı kurum → manuel inceleme; öğrenci belgesi 6 aydan eski → reddet; güven ≥ 0,85 ve ciddi kırmızı bayrak yoksa onay.
8. **Kayıt:** Sonuç, kaynak, ad eşleşmesi, AI gerekçesi, çıkarılan eğitim alanları ve süre saklanır. Maskeli metin yalnız manuel incelemede tutulur ve en geç 30 gün içinde silinir.

**Kural:** AI hata verirse, anahtar yoksa ya da yanıt geçersizse belge **asla otomatik onaylanmaz**; manuel incelemeye düşer.

**Sağlayıcılar:**
- `mock`: yalnız `NODE_ENV !== "production"` iken çalışır. Maskeli metindeki anahtar kelimelerden deterministik bir sonuç üretir; yerel test ve tohum için kullanılır.
- `deepseek`: üretim varsayılanıdır. `DEEPSEEK_API_KEY` gerekir.

**Bilinen sınır:** Yapay zeka incelemesi belgenin tutarlılığını ve makulluğunu denetler; kriptografik gerçekliğini kanıtlayamaz. Riskleri azaltan önlemler: PDF meta sinyalleri, aynı belgenin tekrar kullanımının engellenmesi, ad eşleşmesi, tarih güncelliği, deneme sınırı, şikayet ve yönetici geri alma. Altın standart olan e-Devlet ya da YÖK entegrasyonu kapsam dışıdır; e-Devlet barkod sorgusunun otomasyonu yapılmaz.

## KVKK: uygulanan tedbirler

- Aydınlatma metni kayıt öncesinde gösterilir; metin sürümlüdür (`LEGAL_VERSION`) ve her onay `Consent` tablosunda ayrı satır olarak tutulur.
- Açık rıza ayrı ve isteğe bağlıdır; hizmet şartı değildir. Reddeden kullanıcı yerli manuel inceleme yolunu kullanır. Rıza geri alınabilir ve sonraki aktarımları durdurur.
- Veri minimizasyonu: belge dosyası saklanmaz; yurt dışına yalnızca maskeli metin gider; misafirlere soyad yalnız baş harfle gösterilir.
- Saklama ve imha: `npm run purge` (ve uygulama içi tetikleme) süresi geçmiş maskeli metinleri, oturumları, şifre sıfırlama jetonlarını ve giriş kayıtlarını temizler.
- İlgili kişi hakları: veriler JSON olarak indirilebilir, rıza geri alınabilir, hesap kalıcı olarak silinebilir (kayıtlara bağlı veriler cascade ile silinir; denetim kayıtları ve şikayetler kalır, kullanıcı alanları boşalır).
- Güvenlik: scrypt şifre özeti, httpOnly ve SameSite=Lax oturum çerezi (üretimde Secure), oturum jetonunun veritabanında SHA-256 özeti, değişiklik isteklerinde Origin kontrolü, hız sınırları, yönetici eylemleri için denetim kaydı (`AdminAuditLog`). Belge içeriği ve maskeli metin hiçbir zaman loglanmaz.
- Çerezler yalnız zorunlu oturum çerezidir; çerez onay bandı gerekmez. Ayrıntı `/cerezler` sayfasında.

## Canlıya çıkmadan önce yapılacaklar

Bu liste operatörün (veri sorumlusunun) yapması gerekenlerdir. Kod bunların bir kısmını çözemez.

1. **DeepSeek (Çin) riski:** Çin için yeterlilik kararı yoktur. 2024 değişikliğinden sonra açık rıza yalnız arızi aktarımlar için geçerlidir; her kayıtta tekrarlanan bir aktarım arızi sayılmayabilir. Uygun güvence (Kurul'un standart sözleşmesi ve 5 iş günü içinde bildirim) DeepSeek ile yapılamıyorsa hukuki risk sürer. Tasarım bu riski maskeleme ile azaltır ama ortadan kaldırmaz; gönderilen metin takma adlı (pseudonymous) veridir. **Canlıya çıkmadan önce KVKK avukatının görüşü alınmalıdır.** Gerekirse sağlayıcı değiştirilebilir (tek dosyalık değişiklik: `src/lib/verification/providers/`).
2. Veri sorumlusu bilgilerini `src/config/legal.ts` içinde doldurun: unvan, açık adres, KEP adresi, VERBİS kayıt numarası (varsa). VERBİS kayıt yükümlülüğünü değerlendirin.
3. Türkiye'de barındırmayı tercih edin; böylece ek bir yurt dışı aktarımı doğmaz.
4. 5651 sayılı Kanun kapsamındaki yükümlülükleri (yer sağlayıcılık, giriş kaydı süreleri) hukuken teyit edin.
5. Yasal metinler şablondur. Avukat onayıyla yayımlayın ve metin değişince `LEGAL_VERSION` değerini artırın.
6. Üretimde `NODE_ENV=production` kullanın; `VERIFIER_PROVIDER=mock` kullanılmaz. Tohum yalnız bilerek (`SEED_ALLOW_PRODUCTION=true`) ve kendi yönetici parolanızla çalıştırılır.
7. `DOC_HASH_PEPPER` ve (kullanılırsa) `SESSION_SECRET` değerlerini geliştirme değerlerinden farklı, rastgele ve gizli tutun.
8. Ters vekil arkasındaysanız `TRUST_PROXY=true` yapın; değilse bırakın.
9. `SMTP_URL` tanımlayın; şifre sıfırlama e-postaları yalnız konsola yazılmamalıdır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır. |
| `npm run build` | Üretim derlemesi yapar. |
| `npm run start` | Derlenmiş uygulamayı çalıştırır. |
| `npm run lint` | ESLint çalıştırır. |
| `npm test` | Vitest testlerini bir kez çalıştırır. |
| `npm run test:watch` | Testleri izleyerek çalıştırır. |
| `npm run seed` | Tüm tabloları siler ve örnek veriyi yeniden yazar. Yalnız geliştirme veritabanında kullanın. |
| `npm run purge` | Saklama süresi geçmiş maskeli metin, oturum, sıfırlama jetonu ve giriş kaydını temizler. |
| `npm run db:migrate` | `prisma migrate dev` ile yeni migrasyon uygular ya da üretir. |
| `npm run db:reset` | Veritabanını sıfırlar ve migrasyonları baştan uygular. **Tüm veri silinir.** Ardından `npm run seed` ile örnek veri yükleyin. |

## Proje yapısı

```
src/
  app/
    (app)/          kabuklu sayfalar: ana sayfa, ağ, paylaş, mesajlar, projeler, profil, ara, bildirimler, ayarlar, admin
    (auth)/         giriş, kayıt, şifre sıfırlama
    api/            route handler'lar: doğrulama yükleme, sayaçlar, mesaj sorgusu, dışa aktarma, avatar
  components/
    ui/             temel bileşenler (Button, Input, Card, Avatar, Sheet, Tabs, Chip ...)
    shell/          üst bar, alt menü, avatar menüsü, arama çubuğu, bildirim zili
    projects/ messaging/ social/ verification/ admin/ auth/ legal/ common/
  config/           taxonomy.ts (kategoriler, disiplin grupları, 81 il), legal.ts (veri sorumlusu, sürüm)
  lib/
    auth/           oturum, parola özeti, yetki kontrolleri (requireUser, requireVerified, requireAdmin)
    verification/   yükleme, OCR/PDF çıkarımı, ad eşleştirme, maskeleme, sağlayıcılar, karar motoru
    social/         takip, tanıştırma önerileri, ana sayfa akışı, engelleme, şikayet
    messaging/      mesaj isteği ve sohbet kuralları
    projects/       proje işlemleri, filtreler, sorgular
    search.ts, tr.ts (Türkçe katlama), json-fields.ts, notify.ts, rate-limit.ts, purge.ts
prisma/
  schema.prisma     veri modeli (SQLite)
  migrations/       SQLite migrasyonları
  seed.ts           örnek veri
scripts/
  purge.ts          npm run purge
tests/              uçtan uca benzeri entegrasyon testleri (route handler'lar, doğrulama, ana sayfa)
docs/               tasarım dokümanı (spec), tasarım sistemi, geliştirme planı ve raporları
```

## PostgreSQL'e geçiş

Şema SQLite'a göre yazıldı; enum ve dizi yoktur, listeler JSON metin olarak tutulur. PostgreSQL'e geçmek için:

1. `prisma/schema.prisma` içinde `datasource db` bloğunda `provider = "postgresql"` yapın.
2. `DATABASE_URL` değerini PostgreSQL bağlantı adresiyle değiştirin (`postgresql://kullanici:parola@sunucu:5432/veritabani`).
3. Mevcut migrasyonlar SQLite SQL'i içerdiği için PostgreSQL'de yeni bir başlangıç migrasyonu üretin: `npx prisma migrate dev --name init_postgres`.
4. `npm run seed` ile örnek veriyi yükleyin (geliştirme ortamında).

Arama sorguları `searchText` sütununda `contains` ile çalışır; metinler Türkçe katlanmış küçük harf ASCII olarak saklandığı için PostgreSQL'de büyük/küçük harf farkı sorun olmaz.

## Testler

```bash
npm test
```

Testler `prisma/test.db` adlı ayrı bir SQLite dosyası kullanır (`vitest.config.ts`); geliştirme veritabanına dokunmaz.
`tests/global-setup.ts` test şemasını hazırlar. Birim testleri Türkçe katlama, maskeleme, ad eşleştirme, karar motoru,
tanıştırma puanlaması, arama, parola kuralları, oturum ve yetki kontrollerini kapsar. Entegrasyon testleri doğrulama
route'unu sentetik bir PDF ile (mock sağlayıcıyla ve sahte DeepSeek yanıtlarıyla), ana sayfa akışını, mesajlaşmayı
ve bildirim yönlendirmesini sınar. Testlerde gerçek belge kullanılmaz.

Dağıtımdan önce `npm run build`, `npm run lint` ve `npm test` yeşil olmalıdır.
