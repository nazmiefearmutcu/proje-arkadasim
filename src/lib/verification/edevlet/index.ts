import { HttpEDevletClient } from "./client";
import type { EDevletClient, EDevletQuery, EDevletResult } from "./client";

export type { EDevletClient, EDevletQuery, EDevletResult } from "./client";

/** Barkod yolu açık mı. `EDEVLET_VERIFICATION=off` kapatır; varsayılan açıktır. */
export function edevletEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.EDEVLET_VERIFICATION ?? "").trim().toLowerCase() !== "off";
}

/**
 * Yerel geliştirme için sahte istemci. "TEST" ile başlayan barkodlar tanınır:
 * - `TEST-OGRENCI-...`: aktif öğrenci belgesi; ad soyad `EDEVLET_MOCK_NAME` (varsayılan seed kullanıcısı).
 * - `TEST-MEZUN-...`: mezun belgesi.
 * - `TEST-HATA-...`: e-Devlet'e ulaşılamadı.
 * Diğer her barkod "tanımlı değil" döner. T.C. kimlik no "10000000146" değilse "uyuşmadı" döner.
 */
export class MockEDevletClient implements EDevletClient {
  constructor(private readonly name = process.env.EDEVLET_MOCK_NAME ?? "AYŞE NUR YILMAZ") {}

  async verify(query: EDevletQuery): Promise<EDevletResult> {
    if (query.barcode.startsWith("TEST-HATA")) return { kind: "UNAVAILABLE", reason: "mock" };
    if (!query.barcode.startsWith("TEST-OGRENCI") && !query.barcode.startsWith("TEST-MEZUN")) {
      return { kind: "NOT_FOUND", message: "Girilen barkod numarası e-Devlet Kapısında tanımlı değildir." };
    }
    if (query.tckn !== "10000000146") {
      return { kind: "MISMATCH", message: "Girdiğiniz bilgiler belge bilgileri ile uyuşmamaktadır." };
    }
    const today = new Date();
    const date = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
    const text = query.barcode.startsWith("TEST-MEZUN")
      ? `MEZUN BELGESİ\nAdı Soyadı: ${this.name}\nÜniversite: HACETTEPE ÜNİVERSİTESİ\nFakülte: MÜHENDİSLİK FAKÜLTESİ\nBölüm: ELEKTRİK VE ELEKTRONİK MÜHENDİSLİĞİ\nMezuniyet Tarihi: 28.06.2024\nBelge Tarihi: ${date}`
      : `ÖĞRENCİ BELGESİ\nAdı Soyadı: ${this.name}\nÜniversite: ORTA DOĞU TEKNİK ÜNİVERSİTESİ\nFakülte: MÜHENDİSLİK FAKÜLTESİ\nProgram: BİLGİSAYAR MÜHENDİSLİĞİ\nSınıfı: 3\nÖğrenim Düzeyi: Lisans\nÖğrencilik Durumu: Aktif Öğrenci\nBelge Tarihi: ${date}`;
    return { kind: "FOUND", text, pdf: null };
  }
}

let override: EDevletClient | null = null;

/** Testler için istemciyi değiştirir; null verilirse varsayılana döner. */
export function setEDevletClientForTests(client: EDevletClient | null): void {
  override = client;
}

/**
 * Kullanılacak istemci. Üretimde her zaman gerçek istemcidir; `EDEVLET_CLIENT=mock` yalnız üretim
 * dışında sahte istemciyi seçer.
 */
export function getEDevletClient(): EDevletClient {
  if (override) return override;
  if (process.env.NODE_ENV !== "production" && process.env.EDEVLET_CLIENT === "mock") {
    return new MockEDevletClient();
  }
  return new HttpEDevletClient();
}
