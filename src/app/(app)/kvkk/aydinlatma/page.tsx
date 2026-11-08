import {
  AI_PROVIDER,
  LEGAL,
  MASKED_TEXT_RETENTION_DAYS,
  RESET_TOKEN_MINUTES,
  SESSION_DAYS,
} from "@/config/legal";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal/legal-document";

export const metadata = { title: "Aydınlatma metni" };

const DATA_ROWS: Array<[string, string, string, string]> = [
  [
    "Ad, soyad, kullanıcı adı, e-posta, şifre özeti",
    "Hesap ve hizmet",
    "m.5/2-c, sözleşmenin kurulması ve ifası",
    "Hesap süresince",
  ],
  [
    "Eğitim bilgisi (üniversite, fakülte, bölüm, durum, sınıf veya mezuniyet yılı)",
    "Doğrulama ve eşleştirme",
    "m.5/2-c; m.5/2-f meşru menfaat",
    "Hesap süresince",
  ],
  ["Belge dosyası", "Doğrulama", "m.5/2-c", "Saklanmaz; yalnızca bellekte, saniyeler içinde"],
  [
    "Maskelenmiş belge metni",
    "Manuel inceleme",
    "m.5/2-f",
    `Karar anında, en geç ${MASKED_TEXT_RETENTION_DAYS} gün`,
  ],
  [
    "Belge özeti (HMAC)",
    "Aynı belgenin başka hesapta kullanılmasını önleme",
    "m.5/2-f",
    "Hesap süresince",
  ],
  ["Doğrulama sonucu ve gerekçesi", "Güvenlik ve itiraz", "m.5/2-f", "Hesap süresince"],
  ["Proje, başvuru, davet, takip, mesaj", "Hizmetin kendisi", "m.5/2-c", "Hesap süresince"],
  [
    "Giriş kayıtları (IP, zaman, tarayıcı)",
    "Güvenlik ve hukuki yükümlülük",
    "m.5/2-ç, m.5/2-f",
    "En fazla 365 gün (varsayılan)",
  ],
  [
    "Rıza kayıtları (tür, metin sürümü, zaman)",
    "İspat",
    "m.5/2-ç",
    "Hesap süresince ve ispat süresi boyunca",
  ],
];

export default function Page() {
  return (
    <LegalDocument
      title="Aydınlatma metni"
      description="KVKK m.10 kapsamında hangi verileri, hangi amaçla işlediğimizi ve haklarını açıklar."
    >
      <LegalSection title="Veri sorumlusu">
        <p>
          Kişisel verilerin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 uyarınca aşağıda
          açıklanan kapsamda işlenmektedir.
        </p>
        <LegalList
          items={[
            `Unvan: ${LEGAL.controllerName}`,
            `Adres: ${LEGAL.address}`,
            `E-posta: ${LEGAL.email}`,
            `KEP: ${LEGAL.kep}`,
            `VERBİS kayıt numarası: ${LEGAL.verbisNo}`,
          ]}
        />
      </LegalSection>

      <LegalSection title="Hangi verileri, hangi amaçla ve hangi sebeple işliyoruz">
        <p>
          Verilerin kayıt formu, belge yükleme, profil ayarları ve platformu kullanman sırasında elektronik ortamda
          toplanır. Sunucu, giriş kayıtları gibi kullanımdan doğan verileri de kaydeder.
        </p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] border-collapse text-left t-meta">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Veri
                </th>
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Amaç
                </th>
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Hukuki sebep (KVKK m.5)
                </th>
                <th scope="col" className="py-2 font-[600] text-ink">
                  Saklama
                </th>
              </tr>
            </thead>
            <tbody>
              {DATA_ROWS.map(([data, purpose, basis, retention]) => (
                <tr key={data} className="border-b border-line align-top">
                  <td className="py-2 pr-3 text-ink-2">{data}</td>
                  <td className="py-2 pr-3 text-ink-2">{purpose}</td>
                  <td className="py-2 pr-3 text-ink-2">{basis}</td>
                  <td className="py-2 text-ink-2">{retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Belge doğrulama süreci">
        <p>
          Yüklediğin belge dosyası hiçbir zaman diske ya da veritabanına yazılmaz. Dosya yalnızca işlem sırasında
          bellekte tutulur ve işlem bitince bellekten silinir. Metin çıkarma ve kişisel verilerin maskelenmesi
          sunucuda yerel olarak yapılır. Maskeleme; TC kimlik numarası, öğrenci numarası, doğum bilgileri, adres ve
          iletişim bilgileri gibi alanları metinden çıkarır; adın ve soyadın [AD] ve [SOYAD] ile değişir.
        </p>
      </LegalSection>

      <LegalSection title="Yurt dışına aktarım">
        <p>
          Maskelenmiş belge metni, yalnızca açık rıza vermen hâlinde yapay zeka incelemesi için yurt dışındaki{" "}
          {AI_PROVIDER.company} ({AI_PROVIDER.name}, {AI_PROVIDER.country}) sağlayıcısına gönderilir. Belge dosyası
          ve fotoğrafı hiçbir zaman gönderilmez.
        </p>
        <p>
          Açık rıza vermezsen belgen yurt dışına gönderilmez; ekibimiz tarafından manuel olarak incelenir. Hedeflenen
          inceleme süresi 24 saattir. Açık rıza isteğe bağlıdır ve hizmet koşulu değildir. Maskelenmiş metin yalnızca
          manuel inceleme gerektiğinde saklanır ve karar anında ya da en geç {MASKED_TEXT_RETENTION_DAYS} gün içinde
          silinir.
        </p>
      </LegalSection>

      <LegalSection title="Saklama süreleri">
        <LegalList
          items={[
            "Hesap verileri: hesabın açık olduğu sürece.",
            `Oturum kayıtları: ${SESSION_DAYS} gün; kullandıkça uzar.`,
            `Şifre sıfırlama bağlantıları: ${RESET_TOKEN_MINUTES} dakika.`,
            "Giriş kayıtları: varsayılan 365 gün.",
            `Maskelenmiş belge metni: en fazla ${MASKED_TEXT_RETENTION_DAYS} gün.`,
          ]}
        />
        <p>
          Hesabını sildiğinde hesabına bağlı veriler silinir. Yönetici işlemlerinin denetim kayıtları ve şikayet
          kayıtları ise hukuki yükümlülük gereği, hesabınla bağlantısı kaldırılarak saklanır.
        </p>
      </LegalSection>

      <LegalSection title="Haklarım">
        <p>KVKK m.11 uyarınca şu haklara sahipsin:</p>
        <LegalList
          items={[
            "Kişisel verilerinin işlenip işlenmediğini öğrenme.",
            "Kişisel verilerin işlenmişse buna ilişkin bilgi talep etme.",
            "Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.",
            "Kişisel verilerin yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.",
            "Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme.",
            "KVKK m.7’de öngörülen şartlar çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme.",
            "Düzeltme, silme ve yok etme işlemlerinin, verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
            "İşlenen verilerin yalnızca otomatik sistemler ile analiz edilmesi sonucunda aleyhine bir sonuç çıkmasına itiraz etme.",
            "Kanuna aykırı işleme nedeniyle zarara uğraman hâlinde zararın giderilmesini talep etme.",
          ]}
        />
        <p>
          Ayarlar sayfasından verilerinin bir dökümünü (JSON) indirebilir, açık rızanı geri alabilir ve hesabını
          silebilirsin.
        </p>
      </LegalSection>

      <LegalSection title="Başvuru">
        <p>
          Haklarınla ilgili başvurularını {LEGAL.email} adresine veya KEP adresi {LEGAL.kep} üzerinden yazılı olarak
          iletebilirsin. Başvurular en geç 30 gün içinde yanıtlanır (KVKK m.13).
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
