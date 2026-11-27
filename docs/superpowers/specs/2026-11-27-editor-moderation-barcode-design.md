# Editör hesabı, içerik denetimi ve e-Devlet barkodlu belge doğrulama

Tarih: 2026-11-27. Yol: mimari (yeni alt sistemler). Sahibi onay beklemeden geliştirilmesini istedi;
bu belge kararların kaydıdır.

## Amaç

1. **Tek editör hesabı.** Sistemde en fazla bir editör hesabı bulunur. Bu hesap öğrenci hesabı değildir,
   kendi arayüzünü kullanır.
2. **İçerik denetimi.** Şüpheli, spam, reklam ya da kurallara aykırı projeler (uygulamadaki "gönderiler")
   editörün önüne düşer. Editör tek tıkla onaylar ya da gerekçeyle siler.
3. **Anında belge doğrulama.** Kullanıcı belgesinin barkod numarasını girer. Sistem barkodu e-Devlet'in
   herkese açık "Barkodlu Belge Doğrulama" hizmetine sorar ve sonucu hemen gösterir. Editör yalnız
   otomatik sistemin karar veremediği durumlara bakar.

## 1. Editör hesabı

- Rol değeri veritabanında `ADMIN` olarak kalır (mevcut yetki kodu, testler ve denetim kaydı bunu
  kullanır). Arayüzde her yerde "Editör" denir.
- Hesap `npm run editor -- <e-posta>` komutuyla oluşturulur (`scripts/create-editor.ts`).
  - Komut ayrı, yeni bir hesap açar: kullanıcı adı `editor`, ad "ProBuddy", soyad "Editör".
  - Bu e-postayla kayıtlı bir öğrenci hesabı varsa komut reddeder: editör hesabı öğrenci hesabı olamaz.
  - Başka bir editör varsa komut reddeder. `--replace` verilirse eski editör hesabı silinir, yenisi
    açılır (tek editör kuralı).
  - Parola komut satırına hiç yazılmaz. Hesap kullanılamaz rastgele bir parola özetiyle açılır. Komut
    30 dakika geçerli, tek kullanımlık bir parola belirleme bağlantısı üretir ve yalnız bunu yazdırır.
    Bağlantı mevcut `/sifre-sifirla/[token]` akışını kullanır.
- Eski `make-admin` komutu kaldırılır. Öğrenci hesabını editör yapmak artık mümkün değildir.
- Editör keşifte görünmez: arama, ağ önerileri ve profil listeleri `role = USER` ile süzülür.

## 2. Editör arayüzü

- Yeni rota grubu `src/app/(editor)/editor`, kendi düzeniyle gelir: açık üst bar ("PROBUDDY Editör"),
  solda menü (telefonda üstte yatay sekmeler), çıkış düğmesi. Öğrenci arayüzünün alt menüsü, arama
  kutusu ve bildirim zili burada yoktur.
- Sayfalar:
  - `/editor`: genel bakış. Onay bekleyen ilan, açık şikayet, incelenecek belge sayıları ve kısayollar.
  - `/editor/icerik`: içerik denetimi.
  - `/editor/belgeler`: otomatik sistemin karar veremediği belgeler (eski `/admin/dogrulamalar`).
  - `/editor/sikayetler`: kullanıcı ve mesaj şikayetleri (eski `/admin/sikayetler`).
- Eski `/admin` yolları `/editor` karşılığına yönlendirilir.
- Editör öğrenci arayüzüne girmez. `(app)` düzeni editörü `/editor`e yönlendirir. Girişten sonra
  editör doğrudan `/editor`e gider.
- Editör olmayan biri `/editor` açarsa 404 alır; alanın varlığı gizlenir.

## 3. İçerik denetimi

### Veri

`Project` modeline şu alanlar eklenir:

| Alan | Değerler | Anlamı |
| --- | --- | --- |
| `moderationStatus` | `APPROVED` (varsayılan), `PENDING` | `PENDING` ilan yayında değildir |
| `moderationFlagsJson` | dizi | Otomatik denetimin bulduğu işaretler |
| `moderatedAt`, `moderatedById` | | Son editör kararı |

Mevcut projeler `APPROVED` sayılır.

### Otomatik denetim (`src/lib/moderation/assess.ts`)

Saf bir işlevdir. Başlık, özet, açıklama, etiketler ve beceri metinleri üzerinde çalışır ve işaretlerle
bir puan döndürür. Puanı 3 ya da üstü olan ilan `PENDING` olarak kaydedilir.

| İşaret | Puan |
| --- | --- |
| Telefon numarası | 3 |
| Küfür ya da hakaret | 3 |
| Reklam ya da satış dili (indirim, satılık, fiyat, kazanç, bahis, kripto, takipçi) | 2 |
| Para karşılığı ödev, tez ya da proje yazdırma | 3 |
| E-posta adresi | 2 |
| Bağlantı | 2 (iki ve üstü için 3) |
| Aynı sahibin son 7 günde aynı başlıklı ya da aynı açıklamalı ilanı | 2 |
| Sahibin son 24 saatte 3. ya da daha sonraki ilanı | 2 |
| Büyük harf seli | 1 |
| Aynı karakterin uzun tekrarı | 1 |

Türkçe büyük/küçük harf ve aksanlar normalize edilir. Kelime eşleşmeleri kelime sınırıyla yapılır.

Ne zaman çalışır:

- **Yeni ilan:** işaretli ilan bekletilir. Sahibe "İlanın editör onayından sonra yayınlanacak" denir.
- **Düzenleme:** onaylı bir ilan düzenlemeyle şüpheli hale gelirse yeniden `PENDING` olur. Editörün
  onayladığı ilan, metni değişmedikçe tekrar bekletilmez.
- **Şikayet:** bir projeye 3 ya da daha fazla farklı kişiden açık şikayet gelirse proje otomatik olarak
  `PENDING` olur.

### Görünürlük

`PENDING` ilan şu yerlerde görünmez:

- keşif listesi, arama, ana sayfa;
- profilde başkalarına gösterilen liste;
- detay sayfası: sahip dışındakilere 404 döner. Sahip sayfayı bir uyarı bandıyla görür.

Bekleyen ilana başvuru ve davet sunucuda da reddedilir.

### Editör eylemleri (`src/lib/moderation/actions.ts`)

- **Onayla:**
  - `APPROVED` yapar, karar zamanını ve editörü yazar.
  - O projeye ait açık şikayetleri çözer.
  - Denetim kaydına `APPROVE_PROJECT` yazar.
  - İlan bekliyorduysa sahibine "İlanın yayında" bildirimi gider.
- **Sil:**
  - Gerekçe zorunludur: Spam, Reklam, Kurallara aykırı, Uygunsuz içerik; isteğe bağlı not eklenebilir.
  - Projeyi ve bağlı kayıtlarını siler, açık şikayetleri çözer.
  - Denetim kaydına `DELETE_PROJECT` yazar.
  - Sahibine başlık ve gerekçeyle "İlanın kaldırıldı" bildirimi gider.

Her iki eylem de yalnız editörle çalışır ve iki kez basılsa da bir kez işlenir.

### Kuyruk ekranı

Üç sekme vardır:

- **Onay bekleyen:** bekleyen ilanlar.
- **Şikayet edilen:** yayında olup açık şikayeti olan ilanlar.
- **Son ilanlar:** son 50 yayın, göz gezdirmek için.

Kartta şunlar bulunur:

- başlık, sahip (@kullanıcı adı, üniversite), zaman;
- işaret çipleri;
- şikayet sayısı ve nedenleri;
- özet; açıklama ve becerilerin tamamı açılır bölümde;
- "Onayla" ve "Sil" düğmeleri.

Editör ilanı öğrenci arayüzüne geçmeden, bu ekranda okur.

## 4. e-Devlet barkodlu belge doğrulama

### e-Devlet tarafı (2026-11-27'de denendi)

- `https://www.turkiye.gov.tr/belge-dogrulama` giriş istemeyen 4 aşamalı bir formdur: barkod, sorgulama
  alanı (belgeye göre çoğunlukla T.C. kimlik no), bilgilendirme ve onay, sonuç.
- İlk adım `POST /belge-dogrulama?submit` ile gönderilir. Alanlar: `sorgulananBarkod`, gizli `token`,
  `btn`. Oturum çerezleri gerekir.
- Tanımsız barkod aynı sayfayı `warningContainer` içinde "Girilen barkod numarası e-Devlet Kapısında
  tanımlı değildir." uyarısıyla döndürür.
- İlk adımda CAPTCHA görülmedi. Sonraki adımların biçimi gerçek bir barkod olmadan görülemedi. İstemci bu
  yüzden formu genel kurallarla yürür (aşağıda).

### Kullanıcı akışı (`/dogrulama`)

1. Ana kart: "e-Devlet barkoduyla anında doğrula". Kullanıcı iki alan doldurur:
   - **Barkod numarası:** belgenin sağ alt köşesinde.
   - **T.C. kimlik no:** e-Devlet öğrenci ve mezun belgelerinde sorgulama alanı olarak istenir.
2. Sonuç aynı istekte döner:
   - **Onaylandı:** eğitim bilgileri profile yazılır.
   - **Reddedildi:** gerekçeyle birlikte.
   - **Editöre gitti:** e-Devlet belgeyi doğruladı ama bilgiler okunamadı.
   - **Şu an yapılamadı:** e-Devlet'e ulaşılamadı ya da biçim değişti.
3. İkinci yol, barkodlu belgesi olmayanlar için: mevcut belge yükleme akışı. Belge editörün kuyruğuna
   düşer.

### Gizlilik

- T.C. kimlik no yalnız bu sorgu için, bellekte kullanılır. Hiçbir yere yazılmaz, loglanmaz, hata
  mesajına girmez.
- Barkod düz metin olarak saklanmaz. Tekrar kullanım denetimi için yalnız HMAC özeti
  (`DOC_HASH_PEPPER`) saklanır.
- e-Devlet'ten dönen belge metni yalnız bellekte işlenir. Editör incelemesine düşerse maskeli metin mevcut
  saklama süresiyle tutulur.
- Aydınlatma metnine şu bilgi eklenir: T.C. kimlik no ve barkod, belgenin doğrulanması amacıyla e-Devlet
  Kapısı'na (yurt içi, kamu) iletilir; saklanmaz.

### Modüller (`src/lib/verification/edevlet/`)

- **`identifiers.ts`:**
  - barkodu normalize eder (büyük harf, boşluksuz, en fazla 50 karakter, harf/rakam/tire);
  - T.C. kimlik no doğrular (11 hane, ilk hane 0 değil, iki kontrol hanesi).
- **`client.ts`:** `EDevletClient` arayüzü ve gerçek HTTP istemcisi.
  - Çerez kavanozu, 15 sn zaman aşımı, en fazla 5 yönlendirme, 2 MB HTML ve 5 MB PDF sınırı tutar.
    Yalnız `www.turkiye.gov.tr` adresine gider.
  - Formu genel kurallarla yürür (en fazla 4 aşama). Her aşamada `mainForm` alanlarını okur ve şöyle
    doldurur:
    - gizli alanları olduğu gibi gönderir;
    - `sorgulananBarkod`'a barkodu yazar;
    - etiketi "kimlik" içeren metin alanına T.C. kimlik noyu yazar;
    - onay kutularını işaretler.
  - Tanınmayan zorunlu bir metin alanı çıkarsa durur.
  - CAPTCHA, giriş sayfası ya da tanınmayan biçim görürse "kullanılamıyor" döner; hiçbir korumayı
    aşmaya çalışmaz.
  - Sonuç: `NOT_FOUND` (uyarı metniyle), `MISMATCH` (barkod ile kimlik no uyuşmadı), `FOUND` (sonuç
    sayfasının metni ve varsa belgenin PDF'i), `UNAVAILABLE`.
- **`mock.ts`:** testler ve yerel geliştirme için sahte istemci. Üretimde seçilemez.
- **`document.ts`:** e-Devlet'ten dönen YÖK öğrenci belgesi ya da mezun belgesi metninden şunları
  çıkarır:
  - belge türü, ad soyad, üniversite, fakülte, bölüm/program, sınıf, öğrenim düzeyi;
  - öğrencilik durumu ("Aktif" / "Kayıtlı" / "Mezun") ve mezuniyet yılı.
- **`service.ts`** (`verifyBarcode`) sırasıyla:
  1. Mevcut deneme sınırını uygular (24 saatte 5 sonuç).
  2. Barkod özetiyle tekrar kullanım denetimi yapar.
  3. e-Devlet'e sorar.
  4. Dönen belgeden alanları okur.
  5. Ad soyadı hesaptaki adla eşleştirir.
  6. Kararı verir:
     - **Onay:** e-Devlet buldu, ad eşleşti, belge YÖK öğrenci/mezun belgesi, öğrenci aktif ya da mezun,
       üniversite ve bölüm okundu.
     - **Ret:** barkod tanımsız, kimlik no uyuşmadı, ad eşleşmedi, kaydı silinmiş öğrenci, öğrenci ya da
       mezun belgesi değil, ya da belge başka doğrulanmış hesapta kullanılmış.
     - **Editör incelemesi:** e-Devlet buldu, ad eşleşti ama alanlar okunamadı.
     - **Hata, deneme sayılmaz:** e-Devlet'e ulaşılamadı. Kullanıcıya belge yükleme yolu önerilir.
  7. `VerificationAttempt` kaydını `source = "EDEVLET"` ile yazar, kullanıcı durumunu günceller ve
     bildirim gönderir. Bu adım mevcut belge kilidi ve işlem korumalarıyla yapılır.
- `EDEVLET_VERIFICATION=off` ortam değişkeni barkod yolunu kapatır; varsayılan açıktır.
  `EDEVLET_CLIENT=mock` yalnız üretim dışında kullanılır.

## Riskler

- e-Devlet sayfa biçimini değiştirebilir ya da otomatik istekleri engelleyebilir. Bu durumda sistem
  "şu an yapılamadı" der ve belge yükleme yolunu önerir; hiçbir belge yanlışlıkla onaylanmaz.
- Kurumlar için resmi yol, e-Devlet Kapısı ile yapılan entegrasyon anlaşmasıdır (web servisi). Trafik
  büyürse bu yola geçilmelidir.
- 2–4. aşamalar gerçek bir barkodla denenmedi. Bu bilgi editöre ve sahibine teslim notunda iletilir.

## Test

- `identifiers`, `assess`, `document` ayrıştırıcısı: saf işlev testleri.
- `client`: gerçek HTML parçalarıyla `fetch` taklidi (uyarı sayfası, iki aşamalı akış, CAPTCHA,
  yabancı alan adı yönlendirmesi).
- `service`: sahte istemciyle onay, ret, editör incelemesi, tekrar kullanım ve hata yolları.
- Denetim eylemleri: yetki, iki kez basma, şikayet çözme, bildirim.
- Görünürlük: bekleyen ilan liste, arama ve detayda gizli; sahibe görünür.
- `create-editor`: tek editör kuralı, `--replace` ve öğrenci e-postasının reddi.
