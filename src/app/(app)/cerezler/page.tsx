import Link from "next/link";
import { SESSION_DAYS } from "@/config/legal";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata = { title: "Çerezler" };

export default function Page() {
  return (
    <LegalDocument
      title="Çerezler"
      description="Platform yalnızca zorunlu bir oturum çerezi kullanır."
    >
      <LegalSection title="Kullandığımız çerez">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[480px] border-collapse text-left t-meta">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Çerez
                </th>
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Amaç
                </th>
                <th scope="col" className="py-2 pr-3 font-[600] text-ink">
                  Tür
                </th>
                <th scope="col" className="py-2 font-[600] text-ink">
                  Süre ve özellikler
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="py-2 pr-3 font-mono text-ink">pa_session</td>
                <td className="py-2 pr-3 text-ink-2">Giriş yaptığını hatırlamak</td>
                <td className="py-2 pr-3 text-ink-2">Zorunlu (oturum)</td>
                <td className="py-2 text-ink-2">
                  {SESSION_DAYS} gün; kullandıkça uzar. httpOnly, SameSite=Lax. Üretimde yalnızca güvenli bağlantıyla
                  gönderilir.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Çerez onayı">
        <p>
          Analitik, reklam veya takip çerezi kullanmıyoruz. Yalnızca zorunlu çerez kullandığımız için çerez onay bandı
          gösterilmez.
        </p>
      </LegalSection>

      <LegalSection title="Çerezleri silmek">
        <p>
          Çerezleri tarayıcı ayarlarından silebilirsin. Bu durumda oturumun kapanır ve yeniden giriş yapman gerekir.
        </p>
        <p>
          Verilerin hakkında daha fazla bilgi için{" "}
          <Link href="/gizlilik" className="text-pen underline">
            gizlilik politikasına
          </Link>{" "}
          bakabilirsin.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
