# Proje Arkadaşım — Tasarım Dokümanı (Spec)

- Tarih: 2026-11-08
- Durum: Onaylandı (2026-11-08) — belge doğrulamada A yaklaşımı (yerel çıkarım + maskeleme, DeepSeek'e yalnızca maskelenmiş metin)
- Yol: Mimari (yeni proje)

## 1. Amaç

Proje Arkadaşım, **Türkiye'de üniversite okuyan veya üniversiteden mezun olmuş** kişilerin proje paylaştığı
ve projelere katıldığı, telefonda rahat kullanılan bir web uygulamasıdır. Belge zorunluluğu platformu ciddi
kılar; disiplinlerarası ekip kurmayı, kişinin kendi bölümü ve çevresiyle sınırlı kalmadan doğru proje
arkadaşını bulmasını kolaylaştırır.

Başarı ölçütleri:
- Misafir kullanıcı giriş yapmadan projeleri gezebilir.
- Belge doğrulama çoğu kullanıcı için **saniyeler içinde** sonuçlanır (PDF yolu hedefi p50 < 6 sn, görsel yolu < 15 sn).
- Belge dosyası hiçbir zaman diske veya veritabanına yazılmaz; yurt dışına yalnızca maskelenmiş metin gider, o da yalnızca açık rıza ile.
- Telefonda (360–430 px genişlik) tüm akışlar tek elle kullanılabilir.

## 2. Kullanıcı tipleri ve yetkiler

| Yetki | Misafir | Kayıtlı (doğrulanmamış) | Doğrulanmış | Admin |
|---|---|---|---|---|
| Projeleri listeleme / detay görme | ✓ | ✓ | ✓ | ✓ |
| Proje sahibinin adını görme | Ad + soyadın baş harfi | Ad + soyadın baş harfi | Tam ad | Tam ad |
| Proje arama | ✓ | ✓ | ✓ | ✓ |
| Kişi arama, profil sayfaları | — | — | ✓ | ✓ |
| Proje paylaşma, katılma başvurusu, davet | — | — (doğrulamaya yönlendirilir) | ✓ | ✓ |
| Takip etme, Network, Mesajlarım | — | — | ✓ | ✓ |
| Doğrulama kuyruğu, şikayetler | — | — | — | ✓ |

"Bu ikisinden birine sahip olmayan giriş yapamaz" kuralı şöyle uygulanır: hesap oluşturulabilir ama belge
onaylanana kadar hesap **misafir yetkisinin ötesine geçemez**; korumalı her eylem `/dogrulama` sayfasına yönlendirir.

## 3. Bilgi mimarisi ve navigasyon

### 3.1 Uygulama kabuğu (her sayfada)

- **Üst bar** (sticky):
  - Sol: profil resmi. Dokununca açılır menü (sheet/popover): Profilim, Projelerim, Belge durumu, Ayarlar,
    Gizlilik ve KVKK, Yardım, Çıkış yap. Admin için ek: Yönetim paneli. Misafirde: genel ikon → Giriş yap / Kayıt ol / KVKK.
  - Orta: **büyük arama çubuğu**. Boşken kişiye özel öneriler yarı saydam placeholder olarak döner
    (ör. "Endüstriyel tasarımcı ara…", "'yapay zeka' projelerini ara…"). Odaklanınca öneri çipleri görünür.
  - Sağ: bildirim zili, okunmamış sayısı rozeti.
- **Alt menü** (5 buton, soldan sağa): Ana Sayfa · Network · **Paylaş** (ortada, vurgulu) · Mesajlarım · Projeler.
  Network ve Mesajlarım'da bekleyen öğe rozetleri.
- Masaüstünde aynı kabuk ortalanmış dar kolon (max ~640 px) olarak görünür; ayrı masaüstü düzeni yok.

### 3.2 Rotalar

| Rota | Erişim | İçerik |
|---|---|---|
| `/` | Herkes | Doğrulanmış: yalnızca takip edilenlerin paylaştığı projeler (kendi projeleri hariç). Boşsa önerilen kişiler. Misafir/doğrulanmamış: tanıtım + son projeler önizlemesi + kayıt/doğrulama çağrısı. |
| `/network` | Doğrulanmış | Gelen proje davetleri (kabul/ret), tanıştırma önerileri (gerekçeli, Takip et), takipçi/takip sayıları. |
| `/paylas` | Doğrulanmış | Proje oluşturma formu. (Blog/gönderi yok — bilinçli karar.) |
| `/mesajlar` | Doğrulanmış | Sohbetler + "İstekler" sekmesi. |
| `/mesajlar/[id]` | Katılımcılar | Sohbet ekranı. |
| `/projeler` | Herkes | Tüm açık projeler; filtre: kategori, disiplin, çalışma şekli, şehir, aşama. |
| `/projeler/[id]` | Herkes | Detay, aranan roller, ekip; Katıl (başvuru); sahibine: başvurular, davet, düzenle, kapat. |
| `/projeler/[id]/duzenle` | Proje sahibi | Düzenleme. |
| `/u/[username]` | Doğrulanmış | Profil: eğitim bilgisi, doğrulama rozeti, beceriler, ilgi alanları, projeler; Takip et, Mesaj, Projeye davet et, Engelle, Şikayet et. |
| `/ara` | Herkes | Sonuçlar: Projeler (herkes), Kişiler (yalnız doğrulanmış). |
| `/bildirimler` | Kayıtlı | Bildirim listesi, tümünü okundu yap. |
| `/giris`, `/kayit`, `/sifremi-unuttum`, `/sifre-sifirla/[token]` | Misafir | Kimlik akışları. |
| `/dogrulama` | Kayıtlı | Belge yükleme, canlı adımlar, sonuç, tekrar deneme. |
| `/ayarlar` | Kayıtlı | Profil, şifre, gizlilik, KVKK hakları (verilerimi indir, rızayı geri al, hesabı sil). |
| `/kvkk/aydinlatma`, `/kvkk/acik-riza`, `/gizlilik`, `/cerezler`, `/kullanim-kosullari` | Herkes | Yasal metinler. |
| `/admin`, `/admin/dogrulamalar`, `/admin/sikayetler` | Admin | Panel. |

## 4. Ekranlar ve davranışlar

### 4.1 Kayıt (`/kayit`) — 3 adım, tek sayfada stepper
1. **Hesap:** ad, soyad (belgeyle eşleşecek, uyarı metniyle), e-posta, kullanıcı adı, şifre (≥ 10 karakter).
2. **Bilgilendirme ve onaylar:** Aydınlatma metni özeti + tam metin bağlantısı (okundu onayı zorunlu),
   Kullanım koşulları (zorunlu), **ayrı ve isteğe bağlı** açık rıza kutusu: "Maskelenmiş belge metnimin yapay zeka
   incelemesi için yurt dışına (DeepSeek, Çin) aktarılmasına açık rıza veriyorum." İşaretlenmezse belge
   yurt dışına çıkmaz, manuel incelemeye düşer (hedef < 24 saat). Rıza hizmet şartına bağlanmaz.
3. **Belge:** `/dogrulama` bileşeni gömülü.

### 4.2 Doğrulama (`/dogrulama`)
- Durum kartı: Doğrulanmamış / İnceleniyor / Onaylandı / Reddedildi (gerekçe + tekrar dene) / Manuel incelemede.
- Yükleme: PDF (önerilen: "e-Devlet'ten Öğrenci Belgesi veya YÖK Mezun Belgesi PDF'i") veya JPEG/PNG/WebP fotoğraf, ≤ 10 MB.
- Canlı adım göstergesi: Belge okunuyor → Kişisel veriler maskeleniyor → Yapay zeka inceliyor → Sonuç.
- Onaylanınca profil eğitim alanları (üniversite, fakülte, bölüm, durum, sınıf/mezuniyet yılı) otomatik doldurulur, kullanıcı düzeltebilir (üniversite/durum hariç).
- Deneme sınırı: 24 saatte 5 deneme.

### 4.3 Proje paylaşma (`/paylas`)
Alanlar: başlık (8–80), kısa özet (20–160), açıklama (80–4000), kategori (Yazılım, Donanım, Tasarım, Girişim,
Araştırma, Sosyal Sorumluluk, Sanat ve Medya, Oyun, Diğer), aşama (Fikir, Prototip, Geliştirme, Yayında),
çalışma şekli (Uzaktan, Yüz yüze, Hibrit), şehir (yüz yüze/hibritte zorunlu; 81 il listesi), etiketler (≤ 8),
**aranan roller** (1–6 adet: rol adı, disiplin, kişi sayısı 1–5, kısa açıklama). Disiplinlerarası vurgu: disiplin
seçimi bölüm grupları listesinden yapılır.

### 4.4 Projeler (`/projeler`) ve detay
- Kart: başlık, özet, kategori/aşama/çalışma şekli çipleri, aranan disiplinler, sahibi (yetkiye göre ad), üniversite, doğrulama rozeti, tarih.
- Sıralama: en yeni; filtreler URL query parametrelerinde (paylaşılabilir).
- Detayda **Katıl**: rol seç (opsiyonel) + motivasyon mesajı (≥ 20 karakter) → başvuru. Misafir → `/giris?next=…`;
  doğrulanmamış → `/dogrulama`. Aynı projeye tek bekleyen başvuru.
- Sahip: başvuruları kabul/ret, profilden veya kişi aramadan **davet**, projeyi kapat/aç, sil. Üye: projeden ayrıl.
- Kabul edilen başvuru/davet → `ProjectMember` olur; rol kontenjanı dolunca rol "dolu" görünür.

### 4.5 Ana sayfa (`/`)
- Doğrulanmış kullanıcı: takip ettiklerinin projeleri, yeniden eskiye, sayfalı ("daha fazla yükle").
- Kimseyi takip etmiyorsa: "Henüz kimseyi takip etmiyorsun" + 5 önerilen kişi (tanıştırma algoritması) + Projeler'e git.

### 4.6 Network (`/network`)
- **Davetler:** gelen proje davetleri (proje, davet eden, rol, mesaj) → Kabul / Reddet.
- **Tanıştırmalar:** "Seni Elif ile tanıştıralım — farklı disiplin (Endüstriyel Tasarım), ortak ilgi: yapay zeka".
  Takip et / Gizle. Ayrıca ilk kez önerilen en iyi 3 kişi için bildirim üretilir (kişi başı 7 günde en çok bir kez).
- Takipçi / takip edilen sayıları ve listeleri (sekme).

### 4.7 Mesajlaşma (seçilen model: mesaj isteği)
- Doğrudan sohbet açılabilir: karşılıklı takip **veya** aynı projenin ekibinde olmak.
- Aksi halde ilk mesaj **istek** olarak gider; gönderen kabul edilene kadar ikinci mesaj atamaz.
  Alıcı "İstekler" sekmesinde Kabul / Reddet. Reddedilen istek gönderene "gönderildi" olarak görünmeye devam eder (baskı oluşturmamak için).
- Engelleme her iki yönde mesajlaşmayı, öneriyi ve daveti kapatır.
- Gerçek zamanlılık: açık sohbette 3 sn'de bir yeni mesaj sorgusu; kabukta 20 sn'de bir sayaç sorgusu + sekmeye dönüşte.

### 4.8 Bildirimler
Türler: FOLLOW, JOIN_REQUEST, JOIN_ACCEPTED, JOIN_REJECTED, INVITE, INVITE_ACCEPTED, INVITE_DECLINED,
MESSAGE_REQUEST, MESSAGE_REQUEST_ACCEPTED, VERIFICATION_RESULT, INTRODUCTION, NEW_PROJECT_FROM_FOLLOWING.
Mesajların kendisi bildirim üretmez (Mesajlarım rozeti yeterli). Listeye dokununca ilgili sayfaya gider ve okundu olur.

### 4.9 Arama
- Tek kutu; `/ara?q=` iki bölüm: Projeler (başlık, özet, etiket, rol/disiplin), Kişiler (ad, kullanıcı adı, üniversite, bölüm, beceri — yalnız doğrulanmış kullanıcılara).
- Türkçe duyarsız eşleşme: kayıtlarda `searchText` sütunu (Türkçe harfler ASCII'ye katlanmış, küçük harf) tutulur; sorgu da aynı katlamayla `LIKE` aranır.
- **Kişiye özel placeholder:** kullanıcının bölüm grubuna göre tamamlayıcı disiplin önerileri ("Yazılım" → "Endüstriyel tasarımcı ara…", "Pazarlamacı ekip arkadaşı ara…"), ilgi alanları ("'robotik' projelerini ara…"), şehri ("İzmir'deki projeleri ara…"). Misafire genel öneriler. 3,5 sn'de bir yumuşak geçişle döner.

### 4.10 Ayarlar
Profil (avatar ≤ 2 MB JPEG/PNG/WebP, biyografi ≤ 300, şehir, beceriler ≤ 15, ilgi alanları ≤ 10, "Proje arıyorum" anahtarı),
şifre değiştir, KVKK: **Verilerimi indir** (JSON), **Açık rızamı geri al**, **Hesabımı sil** (şifre onayıyla, kalıcı), yasal metinler.

## 5. Belge doğrulama hattı

### 5.1 Akış (tamamı tek istek içinde, bellek üzerinde)
1. **Alım:** `POST /api/verification` (multipart). Oturum, deneme sınırı, boyut (≤ 10 MB) ve sihirli bayt kontrolü
   (`%PDF`, JPEG `FFD8FF`, PNG `89504E47`, WebP `RIFF....WEBP`). Uzantıya/MIME'ye güvenilmez.
2. **Özet:** `docHash = HMAC-SHA256(DOC_HASH_PEPPER, dosyaBaytları)`. Başka bir hesapta **onaylanmış** aynı özet varsa → REJECTED ("Bu belge başka bir hesapta kullanılmış").
3. **Yerel metin çıkarımı:** PDF → `unpdf` ile metin katmanı + PDF meta verisi (Producer/Creator, oluşturma/değiştirme tarihi, artımlı güncelleme sayısı). Metin < 80 karakterse (taranmış PDF) → kullanıcıya "fotoğraf olarak yükle veya e-Devlet PDF'i kullan" (ERROR, deneme hakkı yenmez).
   Görsel → `tesseract.js` (tur + eng) yerel OCR. OCR ortalama güveni < %55 ise → net fotoğraf iste (deneme hakkı yenmez).
4. **Yerel ad eşleştirme:** kayıtlı ad/soyad, Türkçe katlanmış metinde aranır. Kural: soyadın tüm parçaları **ve** adın en az bir parçası bulunmalı; ≥ 4 harfli parçalarda OCR için Levenshtein ≤ 1 tolerans. Sonuç: `nameMatch: boolean`.
5. **Yerel maskeleme (yurt dışına çıkmadan önce):**
   - 11 haneli tüm sayı dizileri (boşluklu/tireli varyantlar dahil; TCKN sağlama algoritmasından bağımsız, hepsi) → `[TCKN]`
   - Etiketli satırların değeri: Baba Adı, Anne/Ana Adı, Doğum Yeri, Doğum Tarihi, Öğrenci No/Numarası, Uyruk, Adres, Telefon, E-posta, Seri No, Barkod/Doğrulama Kodu, Kimlik → `[GİZLİ]`
   - Kayıtlı ad ve soyad parçaları → `[AD]` / `[SOYAD]`; "Adı Soyadı" etiketli satırın değeri → `[AD SOYAD]`
   - E-posta, telefon (+90/0 5xx…), IBAN (`TR` + 24 hane) → `[GİZLİ]`
   - Kalan ≥ 6 haneli sayı dizileri → `[NUMARA]` (4 haneli yıllar ve gg.aa.yyyy tarihleri korunur)
   - Maskeleme fonksiyonu saf (pure) ve birim testli; çıktı en fazla 6000 karakterle sınırlanır.
6. **Yapay zeka incelemesi** (yalnızca açık rıza varsa): `VerifierProvider` arayüzü üzerinden DeepSeek.
   - OpenAI uyumlu SDK, `baseURL = https://api.deepseek.com`, model `DEEPSEEK_MODEL` (varsayılan `deepseek-flash`),
     `response_format: { type: "json_object" }`, prompt içinde "json" kelimesi ve örnek şema, `max_tokens` 800, zaman aşımı 20 sn,
     boş içerikte 1 kez tekrar. **Yalnızca maskelenmiş metin + kişisel olmayan PDF meta sinyalleri gönderilir; görsel veya dosya asla gönderilmez.**
   - Beklenen JSON:
     ```json
     {
       "isEducationDocument": true,
       "documentType": "OGRENCI_BELGESI | MEZUN_BELGESI | DIPLOMA | TRANSKRIPT | DIGER",
       "academicStatus": "STUDENT | GRADUATE | UNKNOWN",
       "institution": "string|null",
       "isTurkishHigherEducation": true,
       "faculty": "string|null",
       "department": "string|null",
       "degreeLevel": "ONLISANS | LISANS | YUKSEK_LISANS | DOKTORA | UNKNOWN",
       "classYear": "number|null",
       "graduationYear": "number|null",
       "issueDate": "YYYY-MM-DD|null",
       "issuer": "E_DEVLET | YOK | UNIVERSITE | DIGER",
       "redFlags": ["string"],
       "confidence": 0.0,
       "summary": "kısa Türkçe gerekçe, kişisel veri içermez"
     }
     ```
   - Yanıt `zod` ile doğrulanır; geçersizse ERROR.
7. **Karar motoru** (saf fonksiyon, birim testli), sırayla:
   1. Özet başka hesapta onaylı → REJECTED.
   2. AI çağrılamadı / rıza yok / geçersiz yanıt / anahtar yok → MANUAL_REVIEW (**hata durumunda asla otomatik onay yok**).
   3. `isEducationDocument=false` veya `documentType=DIGER` → REJECTED ("öğrenci veya mezun belgesi değil").
   4. `nameMatch=false` → PDF kaynağında REJECTED ("belgedeki ad-soyad hesabınla eşleşmiyor"); OCR kaynağında MANUAL_REVIEW.
   5. `isTurkishHigherEducation=false` → MANUAL_REVIEW (yabancı kurum: Türkiye'de yaşayan mezun olabilir, insan kararı).
   6. Öğrenci belgesi ve `issueDate` 6 aydan eski → REJECTED ("güncel tarihli belge yükle"). Mezun belgesi/diploma için tarih sınırı yok. Tarih yoksa öğrenci belgesinde MANUAL_REVIEW.
   7. `confidence ≥ 0.85` ve ciddi kırmızı bayrak yok → APPROVED. `0.5 ≤ confidence < 0.85` veya bayrak var → MANUAL_REVIEW. `< 0.5` → REJECTED.
8. **Kalıcılaştırma:** `VerificationAttempt` (sonuç, kaynak, ad eşleşmesi, AI gerekçesi, çıkarılan eğitim alanları, süre, model).
   Dosya baytları değişkenden bırakılır (`buffer.fill(0)`), hiçbir yerde loglanmaz. Maskelenmiş metin yalnızca MANUAL_REVIEW'da saklanır ve karar anında ya da en geç 30 günde silinir.
9. **Bildirim:** VERIFICATION_RESULT bildirimi; APPROVED'da kullanıcı `VERIFIED` olur ve eğitim alanları profile yazılır.

### 5.2 Sağlayıcılar
- `deepseek`: üretim varsayılanı (`DEEPSEEK_API_KEY` gerekir; yoksa MANUAL_REVIEW).
- `mock`: yalnız `NODE_ENV !== "production"` iken çalışır; maskelenmiş metindeki anahtar kelimelerden deterministik sonuç üretir (yerel test ve seed için). Üretimde seçilirse uygulama başlatılırken hata verir.
- Arayüz sayesinde ileride Türkiye'de barındırılan veya standart sözleşme imzalanmış bir sağlayıcıya geçiş tek dosyalık değişikliktir.

### 5.3 Bilinen sınır (dürüst not)
Yapay zeka incelemesi belgenin **tutarlılığını ve makullüğünü** denetler; kriptografik gerçekliğini kanıtlayamaz.
Riskleri azaltan önlemler: PDF meta sinyalleri, aynı belgenin tekrar kullanımının engellenmesi, ad eşleşmesi, tarih güncelliği,
deneme sınırı, şikayet + admin geri alma. Altın standart (e-Devlet/YÖK kurumsal entegrasyonu) kapsam dışıdır;
e-Devlet barkod sorgulamasının otomasyonu (CAPTCHA, kullanım şartları) yapılmayacaktır.

## 6. KVKK uyum tasarımı

### 6.1 Veri envanteri

| Veri | Amaç | Hukuki sebep (KVKK m.5) | Saklama |
|---|---|---|---|
| Ad, soyad, kullanıcı adı, e-posta, şifre özeti | Hesap ve hizmet | 5/2-c sözleşmenin kurulması/ifası | Hesap süresince |
| Eğitim bilgisi (üniversite, fakülte, bölüm, durum, sınıf/mezuniyet yılı) | Doğrulama ve eşleştirme | 5/2-c, 5/2-f meşru menfaat | Hesap süresince |
| Belge dosyası | Doğrulama | 5/2-c | **Saklanmaz** (yalnız bellek, saniyeler) |
| Maskelenmiş belge metni | Manuel inceleme | 5/2-f | Karar anında, en geç 30 gün |
| Belge özeti (HMAC) | Aynı belgenin başka hesapta kullanımını önleme | 5/2-f | Hesap süresince |
| Doğrulama sonucu ve gerekçesi | Güvenlik, itiraz | 5/2-f | Hesap süresince |
| Proje, başvuru, davet, takip, mesaj | Hizmetin kendisi | 5/2-c | Hesap süresince |
| Giriş kayıtları (IP, zaman, tarayıcı) | Güvenlik, hukuki yükümlülük | 5/2-ç, 5/2-f | `LOGIN_LOG_RETENTION_DAYS` (varsayılan 365) |
| Rıza kayıtları (tür, metin sürümü, zaman) | İspat | 5/2-ç | Hesap süresince + ispat süresi |

### 6.2 Uygulanan teknik ve idari tedbirler
- Aydınlatma metni (m.10) kayıt öncesinde; sürümlü (`LEGAL_VERSION`), onay kaydı `Consent` tablosunda.
- Açık rıza **ayrı, isteğe bağlı, hizmet şartı değil**; reddeden kullanıcıya yerli manuel inceleme yolu. Rıza geri alınabilir (sonraki aktarımları durdurur).
- Veri minimizasyonu: belge saklanmaz; yurt dışına yalnız maskelenmiş metin; misafirlere soyad yalnız baş harf.
- Saklama ve imha: zamanlanmış temizlik (uygulama içi, istek tetiklemeli + `npm run purge` betiği): süresi geçen maskeli metinler, oturumlar, şifre sıfırlama jetonları, giriş kayıtları.
- İlgili kişi hakları (m.11): verilerimi indir (JSON), hesabı kalıcı sil (cascade), rıza geri alma, başvuru iletişim adresi (`legal.ts`).
- Güvenlik: scrypt şifre özeti, httpOnly + SameSite=Lax + üretimde Secure çerez, oturum jetonu veritabanında SHA-256 özetiyle, mutasyonlarda Origin kontrolü, hız sınırları, admin erişim denetim kaydı (`AdminAuditLog`), belge içeriği ve maskeli metin asla loglanmaz.
- Çerezler: yalnız zorunlu oturum çerezi → çerez onay bandı gerekmez; `/cerezler` sayfası bunu açıklar.

### 6.3 Operatörün (senin) yapması gerekenler — kod bunları çözemez
- **DeepSeek (Çin) riski:** Çin için yeterlilik kararı yok. 2024 değişikliğinden sonra açık rıza yalnız **arızi** aktarımlar için geçerli; her kayıtta tekrarlanan aktarım arızi sayılmayabilir. Uygun güvence (Kurul'un standart sözleşmesi + 5 iş günü içinde bildirim) DeepSeek ile imzalanamıyorsa hukuki risk sürer. Tasarım bu riski maskeleme ile **azaltır ama ortadan kaldırmaz** — gönderilen metin takma adlı (pseudonymous) veridir. Canlıya çıkmadan önce KVKK avukatı görüşü alınmalı; gerekirse sağlayıcı değiştirilebilir (5.2).
- Veri sorumlusu bilgileri (`src/config/legal.ts`: unvan, adres, e-posta, KEP), VERBİS kaydı yükümlülüğünün değerlendirilmesi.
- Türkiye'de barındırma tercih edilmeli (ek yurt dışı aktarımı doğmasın).
- 5651 sayılı Kanun kapsamındaki yükümlülükler (yer sağlayıcılık, giriş kaydı süreleri) hukuken teyit edilmeli.
- Yasal metinler şablondur; avukat onayıyla yayımlanmalı.

## 7. Veri modeli (Prisma, SQLite; PostgreSQL'e uyumlu)

SQLite'ta dizi tipi olmadığı için etiket/beceri/ilgi listeleri JSON metin olarak tutulur (`skillsJson` vb.), yardımcı fonksiyonlarla okunur.

- **User:** id, email (unique), passwordHash, firstName, lastName, username (unique), avatarPath?, bio?, city?,
  skillsJson, interestsJson, lookingForProject, role (USER|ADMIN), verificationStatus (UNVERIFIED|PENDING|MANUAL_REVIEW|VERIFIED|REJECTED),
  academicStatus? (STUDENT|GRADUATE), university?, faculty?, department?, disciplineGroup?, degreeLevel?, classYear?, graduationYear?,
  verifiedAt?, searchText, createdAt, updatedAt.
- **Session:** id, tokenHash (unique), userId, expiresAt, createdAt, userAgent?.
- **PasswordResetToken:** id, tokenHash, userId, expiresAt, usedAt?.
- **LoginEvent:** id, userId, ip, userAgent, success, createdAt.
- **Consent:** id, userId, type (PRIVACY_NOTICE|TERMS|CROSS_BORDER_AI), version, granted, createdAt.
- **VerificationAttempt:** id, userId, status (APPROVED|REJECTED|MANUAL_REVIEW|ERROR), source (PDF_TEXT|OCR), docHash, nameMatch,
  documentType?, aiUsed, aiModel?, aiConfidence?, aiSummary?, redFlagsJson, extractedJson (yalnız eğitim alanları), maskedText? (yalnız MANUAL_REVIEW),
  maskedTextExpiresAt?, rejectReason?, processingMs, reviewedById?, reviewedAt?, createdAt.
- **Project:** id, ownerId, title, summary, description, category, stage, workMode, city?, tagsJson, status (OPEN|CLOSED), searchText, createdAt, updatedAt.
- **ProjectRole:** id, projectId, title, disciplineGroup, description?, slots.
- **ProjectMember:** id, projectId, userId, roleId?, isOwner, joinedAt. unique(projectId, userId).
- **JoinRequest:** id, projectId, userId, roleId?, message, status (PENDING|ACCEPTED|REJECTED|WITHDRAWN), createdAt, decidedAt?.
- **ProjectInvite:** id, projectId, inviterId, inviteeId, roleId?, message?, status (PENDING|ACCEPTED|DECLINED|CANCELLED), createdAt, decidedAt?.
- **Follow:** followerId, followingId, createdAt. PK(followerId, followingId).
- **Introduction:** id, userId, suggestedUserId, reason, dismissed, createdAt. unique(userId, suggestedUserId).
- **Conversation:** id, userAId, userBId (sıralı, unique çift), status (ACTIVE|REQUEST|DECLINED), initiatorId, lastMessageAt, createdAt.
- **ConversationRead:** conversationId, userId, lastReadAt. PK(conversationId, userId).
- **Message:** id, conversationId, senderId, body (1–2000), createdAt.
- **Notification:** id, userId, type, actorId?, projectId?, conversationId?, dataJson, readAt?, createdAt.
- **Block:** blockerId, blockedId, createdAt. PK.
- **Report:** id, reporterId, targetType (USER|PROJECT|MESSAGE), targetId, reason, details?, status (OPEN|RESOLVED), createdAt.
- **AdminAuditLog:** id, adminId, action, targetUserId?, targetId?, createdAt.

Hesap silme: kullanıcıya bağlı tüm kayıtlar cascade silinir (mesajlar dahil; karşı taraf sohbetinde "Silinmiş kullanıcı" görünür — sohbet de silinir). İstisna (§6.2 denetim izi): `AdminAuditLog` ve `Report` satırları silinmez; kullanıcı ilişkisi (`adminId`, `targetUserId`, `reporterId`) `SET NULL` olur.

## 8. Teknik mimari

- **Yığın:** Next.js 15 (App Router, TypeScript, Server Components + Server Actions, Route Handlers), React 19,
  Tailwind CSS 4, Prisma 6 + SQLite (`DATABASE_URL` ile PostgreSQL'e geçiş), zod, `openai` SDK (DeepSeek için),
  `unpdf`, `tesseract.js`, Vitest. Şifre özeti için Node yerleşik `crypto.scrypt` (yerel derleme gerektiren paket yok).
- **Klasör yapısı:**
  ```
  src/app/(app)/…          kabuklu sayfalar (üst bar + alt menü)
  src/app/(auth)/…         giriş/kayıt (sade kabuk)
  src/app/api/…            route handler'lar (doğrulama yükleme, sayaçlar, mesaj sorgusu, avatar servis)
  src/components/ui/…      ilkel bileşenler (Button, Input, Card, Avatar, Badge, Sheet, EmptyState, Tabs, Chip)
  src/components/shell/…   TopBar, BottomNav, AvatarMenu, SearchBar, NotificationBell
  src/components/<özellik>/…
  src/lib/auth/…           session, password, guards (requireUser, requireVerified, requireAdmin)
  src/lib/verification/…   extract, mask, name-match, provider (deepseek, mock), decision, service
  src/lib/…                db, notify, permissions (canMessage, canViewFullName), search, suggestions, rate-limit, tr (Türkçe katlama), purge
  src/config/…             legal.ts, taxonomy.ts (kategoriler, disiplin grupları, tamamlayıcı eşlemeler, 81 il)
  prisma/schema.prisma, prisma/seed.ts
  ```
- **Kimlik:** e-posta + şifre; oturum jetonu 32 bayt rastgele, çerezde ham, veritabanında SHA-256; 30 gün, kayan yenileme. Şifre sıfırlama e-postası `Mailer` arayüzüyle (geliştirmede konsola yazar, `SMTP_URL` varsa nodemailer).
- **Mutasyonlar:** Server Actions (Next'in yerleşik Origin kontrolü); dosya yükleme ve sorgu uçları Route Handler + Origin kontrolü.
- **Sorgu yoklaması:** `GET /api/me/counters` → `{ notifications, messages, requests, invites }`; `GET /api/conversations/[id]/messages?after=`.
- **Tanıştırma algoritması:** aday = doğrulanmış, kendisi değil, takip edilmeyen, engel yok, gizlenmemiş. Puan =
  3×ortak ilgi + 2×tamamlayıcı disiplin + 1,5×aynı şehir + 1×ortak takip (en çok 3) + 1×proje arıyor + 0,5×aynı üniversite. Gerekçe en yüksek katkılı faktörden üretilir.
- **Hız sınırları:** giriş 10/15 dk/IP+e-posta, kayıt 5/saat/IP, doğrulama 5/24 saat/kullanıcı (veritabanından), mesaj 30/dk/kullanıcı, şifre sıfırlama 3/saat.
- **Görsel yön (frontend-design ile kesinleşti):** Türk kampüs hayatının dili. Eylemler için **tükenmez kalem mavisi** (#2340C8), belge doğrulaması için **resmî mühür moru** (#7A3FA8), soğuk tonlu kâğıt zemin (#F4F6F9), mürekkep metin (#161A33) ve 12 disiplin grubunun her birine bir renk. Akılda kalan tek öğe **disiplin sırtı**: projenin aradığı disiplinler kartın sol kenarında renk dilimleri olarak, proje sayfasında yatay bant olarak görünür. Geri kalan her şey sakin: ince çizgiler, kartlarda gölge yok, dekoratif gradyan yok. Tek yazı ailesi: Geologica (Türkçe destekli). İlk taslaktaki "krem zemin + serif + sıcak vurgu" fikri, bu tür sayfaların varsayılan görünümü olduğu için bilinçli olarak bırakıldı. Kesin tokenlar: `docs/superpowers/sdd/task-03-brief.md` ve `docs/design-system.md`. Koyu tema sistem tercihine göre desteklenir.

## 9. Hata yönetimi
- Form hataları alan bazında Türkçe; sunucu hataları kullanıcıya genel mesaj, loglarda kişisel veri olmadan.
- Doğrulama: her hata türü kullanıcıya eyleme dönük mesaj ("e-Devlet PDF'ini yükle", "daha net fotoğraf çek"); teknik hatada MANUAL_REVIEW.
- Yetkisiz erişim: misafir → `/giris?next=`, doğrulanmamış → `/dogrulama`, başkasının kaynağı → 404.
- Boş durumlar her listede özel metin ve eylemle.

## 10. Test stratejisi
- **Birim (Vitest):** Türkçe katlama, TCKN/numara maskeleme (gerçekçi e-Devlet metin örnekleriyle), ad eşleştirme (OCR gürültüsü), karar motoru (tüm dallar), `canMessage`, tanıştırma puanlaması, arama sorgu oluşturucu, placeholder üretici, dosya sihirli bayt kontrolü.
- **Entegrasyon:** doğrulama servisi mock sağlayıcıyla, test içinde üretilen sentetik PDF ile (gerçek belge kullanılmaz); DeepSeek sağlayıcısı sahte HTTP yanıtlarıyla (boş içerik, geçersiz JSON, zaman aşımı).
- **Uçtan uca:** uygulama içi tarayıcıda mobil görünümde manuel senaryo: kayıt → doğrulama (mock) → proje paylaş → başka kullanıcıyla başvuru/kabul → mesaj isteği → bildirimler.
- `npm run build`, `npm run lint`, `npm test` yeşil olmadan iş bitmiş sayılmaz.

## 11. Kapsam dışı (bilinçli)
Blog/gönderi akışı, beğeni/yorum, WebSocket, native mobil uygulama, e-posta adresi doğrulama (güven çapası belge),
e-Devlet/YÖK entegrasyonu, ödeme, çoklu dil, push bildirimleri, grup sohbeti.

## 12. Kabul kriterleri
1. Misafir `/projeler` ve proje detayını görür; Katıl'a basınca girişe yönlendirilir.
2. Kayıt → PDF yükleme (mock veya DeepSeek) → saniyeler içinde sonuç; onayda profil eğitim alanları dolar.
3. Belge dosyası diskte/veritabanında bulunmaz (test ile doğrulanır); DeepSeek'e giden gövdede TCKN ve ad bulunmaz (test ile doğrulanır).
4. Ana sayfada yalnızca takip edilenlerin projeleri görünür.
5. Alt menü 5 buton, Paylaş ortada; üstte avatar menüsü, ortada kişiye özel placeholder'lı arama, sağda bildirim zili.
6. Network'te davet kabul/ret ve tanıştırma önerileri çalışır.
7. Takip edilmeyen birine ilk mesaj istek olarak gider; kabulden sonra sohbet akar.
8. Ayarlar'dan veriler indirilebilir ve hesap kalıcı silinebilir.
9. Build, lint ve testler yeşil; 375 px genişlikte yatay kaydırma yok.
