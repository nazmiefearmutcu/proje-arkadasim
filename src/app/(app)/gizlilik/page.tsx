import Link from "next/link";
import { LEGAL } from "@/config/legal";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal/legal-document";

export const metadata = { title: "Gizlilik politikası" };

export default function Page() {
  return (
    <LegalDocument
      title="Gizlilik politikası"
      description="Verilerini nasıl koruduğumuzu ve hangi bilgileri neden kullandığımızı kısaca anlatır."
    >
      <LegalSection title="Ayrıntılı bilgi">
        <p>
          Hangi verileri hangi sebeple işlediğimizin tam listesi{" "}
          <Link href="/kvkk/aydinlatma" className="text-pen underline">
            aydınlatma metninde
          </Link>{" "}
          yer alır.
        </p>
      </LegalSection>

      <LegalSection title="Verilerini nasıl koruyoruz">
        <LegalList
          items={[
            "Şifreler düz metin olarak saklanmaz; tuzlanmış, güçlü bir özet (scrypt) olarak tutulur.",
            "Oturum anahtarları veritabanında yalnızca özet olarak tutulur. Tarayıcındaki çerez httpOnly ve SameSite=Lax olarak ayarlanır.",
            "Üretim ortamında oturum çerezi yalnızca güvenli bağlantı (HTTPS) üzerinden gönderilir.",
            "Veri değiştiren isteklerde isteğin kaynağı denetlenir.",
            "Giriş, kayıt, doğrulama ve şifre sıfırlama denemeleri hız sınırına tabidir.",
            "Yönetici işlemleri denetim kaydına yazılır.",
            "Belge içeriği, maskelenmiş metin, şifreler ve jetonlar uygulama günlüklerine yazılmaz.",
            "Belge dosyaları saklanmaz; yalnızca bellekte işlenir.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Verilerin nerede tutulur">
        <p>Verilerin {LEGAL.hostingCountry} içinde barındırılır. Yurt dışına yalnızca açık rızan varsa ve yalnızca maskelenmiş belge metni aktarılır.</p>
      </LegalSection>

      <LegalSection title="Çerezler">
        <p>
          Platform yalnızca zorunlu bir oturum çerezi kullanır. Ayrıntılar{" "}
          <Link href="/cerezler" className="text-pen underline">
            çerez sayfasında
          </Link>{" "}
          anlatılır.
        </p>
      </LegalSection>

      <LegalSection title="Değişiklikler">
        <p>Bu politika güncellenebilir. Güncel sürüm numarası her sayfanın üst kısmında gösterilir.</p>
      </LegalSection>
    </LegalDocument>
  );
}
