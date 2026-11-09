# Oracle Cloud Always Free üzerinde yayınlama

Always Free kaynakları süresizdir: VM 7/24 açık kalır, disk kalıcıdır. Oracle yine de bir çalışma süresi
garantisi (SLA) vermez ve uzun süre boşta kalan Always Free VM'leri geri alabileceğini belirtir; site trafik
aldıkça bu olmaz.

## 1. Hesap ve VM (senin yapman gereken adımlar)

1. <https://www.oracle.com/cloud/free/> adresinden hesap aç. Kart doğrulaması istenir, ücret alınmaz.
   Ana bölge (home region) sonradan değişmez; kapasitesi bol bir bölge seç (ör. Frankfurt).
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 24.04** (ya da 22.04)
   - Shape: **VM.Standard.A1.Flex** (Ampere, Always Free) — 2 OCPU, 12 GB bellek yeterli.
     "Out of capacity" hatası alırsan başka bir Availability Domain dene ya da birkaç saat sonra tekrar dene.
   - SSH anahtarını indir ya da kendi açık anahtarını ekle.
   - Public IPv4 adresi atanmış olsun.
3. **Networking → Virtual cloud networks → (VCN) → Security Lists → Default** içine iki **Ingress** kuralı ekle:
   kaynak `0.0.0.0/0`, TCP, hedef port **80** ve **443**.

## 2. Kurulum (tek komut)

VM'e bağlan (`ssh ubuntu@<IP>`) ve çalıştır:

```bash
curl -fsSL https://raw.githubusercontent.com/nazmiefearmutcu/proje-arkadasim/main/deploy/oracle-setup.sh -o setup.sh && bash setup.sh
```

Betik Docker'ı kurar, 80/443 portlarını açar, kodu indirir ve sana üç şey sorar:

- **Alan adı:** Boş bırakırsan `<ip>.sslip.io` kullanılır (ücretsiz, HTTPS çalışır).
- **OpenAI API anahtarı:** Boş bırakırsan bütün belgeler manuel incelemeye düşer.
- **SMTP adresi:** Boş bırakırsan şifre sıfırlama e-postası gönderilemez.

Ayarlar `~/proje-arkadasim/.env.production` dosyasında durur; anahtarlar git'e girmez.

## 3. İlk yönetici

Sitede `/kayit` ile kendi hesabını aç, sonra VM'de:

```bash
cd ~/proje-arkadasim && sudo docker compose --env-file .env.production exec app npm run make-admin -- <e-posta>
```

Komutun yazdığı `@kullanıcı adı` seninki değilse rolü hemen geri al.

## Güncelleme, yedek, kayıtlar

- Güncelleme: `bash ~/proje-arkadasim/deploy/oracle-setup.sh`
- Kayıtlar: `cd ~/proje-arkadasim && sudo docker compose --env-file .env.production logs -f app`
- Veritabanı yedeği:
  `sudo docker compose --env-file .env.production cp app:/data/prod.db ./yedek-$(date +%F).db`

Canlıya çıkmadan önce README'deki KVKK kontrol listesini tamamla (veri sorumlusu bilgileri, avukat görüşü,
OpenAI ile standart sözleşme).
