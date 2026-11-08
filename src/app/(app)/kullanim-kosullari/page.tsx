import { LEGAL } from "@/config/legal";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata = { title: "Kullanım koşulları" };

export default function Page() {
  return (
    <LegalDocument
      title="Kullanım koşulları"
      description="Platformu kullanırken geçerli olan kurallar."
    >
      <LegalSection title="Kimler kullanabilir">
        <p>
          Platform, Türkiye’de üniversite öğrencisi veya üniversiteden mezun kişiler içindir. Belge doğrulamasını
          tamamlamayan hesaplar projeleri gezebilir; paylaşım, başvuru ve mesajlaşma için doğrulama gerekir.
        </p>
      </LegalSection>

      <LegalSection title="Hesabın">
        <p>
          Hesabında kendi adını ve gerçek bilgilerini kullanırsın. Başkasının kimliğini ya da belgesini kullanmak
          yasaktır.
        </p>
      </LegalSection>

      <LegalSection title="Sahte belge">
        <p>
          Sahte, değiştirilmiş ya da başkasına ait belge yüklemek hesabın kalıcı olarak kapatılmasına neden olur.
          Gerekirse yasal yollara başvurulur.
        </p>
      </LegalSection>

      <LegalSection title="Paylaşımlar">
        <p>
          Paylaştığın projeler gerçek olmalıdır. Platform blog ya da gönderi paylaşım alanı değildir. Spam, reklam,
          dolandırıcılık, yanıltıcı veya yasa dışı içerik yasaktır.
        </p>
      </LegalSection>

      <LegalSection title="Saygılı davranış">
        <p>
          Taciz, nefret söylemi, tehdit ve kişisel verilerin izinsiz paylaşılması yasaktır. Engelleme ve şikayet
          araçlarını kullanabilirsin.
        </p>
      </LegalSection>

      <LegalSection title="İçerik ve sorumluluk">
        <p>
          Paylaştığın içeriğin sorumluluğu sana aittir ve içeriğin sahibi olmaya devam edersin. Platformu hizmeti
          sunmak için gereken ölçüde kullanmamıza izin verirsin.
        </p>
      </LegalSection>

      <LegalSection title="Moderasyon">
        <p>
          Şikayetler yöneticiler tarafından incelenir. Kurallara aykırı içerik kaldırılabilir; hesap geçici ya da
          kalıcı olarak kapatılabilir.
        </p>
      </LegalSection>

      <LegalSection title="Hizmetin sınırları">
        <p>
          Belge doğrulama yapay zeka destekli bir incelemedir ve her zaman doğru sonuç vereceği garanti edilmez.
          Sonuca itiraz edebilir ve manuel inceleme isteyebilirsin. Hizmet olduğu gibi sunulur.
        </p>
      </LegalSection>

      <LegalSection title="Hesap silme">
        <p>
          İstediğin zaman hesabını Ayarlar sayfasından silebilirsin. Silme kalıcıdır; hesabına bağlı veriler silinir.
        </p>
      </LegalSection>

      <LegalSection title="Değişiklikler ve iletişim">
        <p>
          Bu koşullar değişebilir; güncel sürüm numarası sayfanın üst kısmında gösterilir. Sorular için {LEGAL.email}{" "}
          adresine yazabilirsin.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
