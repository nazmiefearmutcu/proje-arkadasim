import Link from "next/link";
import { AI_CONSENT_STATEMENT, AI_PROVIDER, LEGAL_VERSION } from "@/config/legal";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal/legal-document";

export const metadata = { title: "Açık rıza metni" };

export default function Page() {
  return (
    <LegalDocument
      title="Açık rıza metni"
      description="Maskelenmiş belge metninin yurt dışında yapay zeka incelemesi için aktarılmasına ilişkin rıza."
    >
      <LegalSection title="Rızanın konusu">
        <p>
          Belge doğrulaması sırasında, belgenin kişisel verileri maskelendikten sonra kalan metninin{" "}
          {AI_PROVIDER.company} ({AI_PROVIDER.name}, {AI_PROVIDER.country}) tarafından yapay zeka ile incelenmek
          üzere yurt dışına aktarılması.
        </p>
      </LegalSection>

      <LegalSection title="Aktarılacak veri">
        <LegalList
          items={[
            "Yalnızca maskelenmiş belge metni.",
            "PDF dosyasının kişisel olmayan teknik bilgileri, örneğin oluşturucu yazılım ve tarih.",
          ]}
        />
        <p>Belge dosyası, fotoğrafı ve maskelenmemiş hiçbir metin gönderilmez.</p>
      </LegalSection>

      <LegalSection title="Amaç">
        <p>
          Belgenin tutarlı ve makul olup olmadığını saniyeler içinde değerlendirmek. Yapay zeka incelemesi belgenin
          gerçekliğini kanıtlayamaz; sonuç nihai karar değildir ve insan incelemesiyle düzeltilebilir.
        </p>
      </LegalSection>

      <LegalSection title="Riskler">
        <p>
          {AI_PROVIDER.country} için KVKK kapsamında yeterlilik kararı bulunmamaktadır. Aktarılan metin takma adlı
          veridir. Sağlayıcı, API üzerinden gönderilen verileri model eğitiminde kullanmadığını beyan eder. Maskeleme riski azaltır ama ortadan kaldırmaz. Sağlayıcının veri işleme ve saklama uygulamaları
          bizim denetimimiz dışındadır.
        </p>
      </LegalSection>

      <LegalSection title="Gönüllülük">
        <p>
          Bu rıza isteğe bağlıdır ve hizmeti kullanmanın koşulu değildir. Rıza vermezsen belgen yurt dışına
          gönderilmez; ekibimiz en geç 24 saat içinde manuel olarak inceler.
        </p>
      </LegalSection>

      <LegalSection title="Geri alma">
        <p>
          Rızanı istediğin zaman Ayarlar sayfasındaki Gizlilik ve KVKK bölümünden geri alabilirsin. Geri alma,
          bundan sonraki aktarımları durdurur; daha önce yapılmış aktarımları geri çağırmaz.
        </p>
      </LegalSection>

      <LegalSection title="Kayıt">
        <p>
          Rızanın verildiği veya geri alındığı tarih, rıza türü ve metin sürümü ({LEGAL_VERSION}) kayıt altında
          tutulur.
        </p>
      </LegalSection>

      <LegalSection title="Rıza beyanı">
        <p>
          Kayıt formundaki, doğrulama sayfasındaki ve ayarlar sayfasındaki onay kutusu aynı metni içerir:
        </p>
        <blockquote className="border-l-2 border-line pl-4 text-ink">“{AI_CONSENT_STATEMENT}”</blockquote>
        <p>
          Aydınlatma metninin tamamı için{" "}
          <Link href="/kvkk/aydinlatma" className="text-pen underline">
            aydınlatma metni
          </Link>{" "}
          sayfasına bak.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
