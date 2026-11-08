import { describe, expect, it } from "vitest";
import { createMockProvider } from "./mock";

const provider = createMockProvider();
const TODAY = "2026-11-08";

function analyze(maskedText: string) {
  return provider.analyze({ maskedText, signals: { source: "PDF_TEXT" }, today: TODAY });
}

const STUDENT_TEXT = `T.C.
YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
ÖĞRENCİ BELGESİ
Adı Soyadı : [AD SOYAD]
Üniversite : ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Fakülte / Yüksekokul : MÜHENDİSLİK FAKÜLTESİ
Program : BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)
Öğrenim Düzeyi : LİSANS
Sınıf : 3
Kayıt Tarihi : 15.09.2021
Belge Tarihi : 01.11.2026`;

describe("mock sağlayıcı", () => {
  it("öğrenci belgesini STUDENT olarak tanır ve alanları çıkarır", async () => {
    const result = await analyze(STUDENT_TEXT);
    expect(result.isEducationDocument).toBe(true);
    expect(result.documentType).toBe("OGRENCI_BELGESI");
    expect(result.academicStatus).toBe("STUDENT");
    expect(result.institution).toBe("ORTA DOĞU TEKNİK ÜNİVERSİTESİ");
    expect(result.faculty).toBe("MÜHENDİSLİK FAKÜLTESİ");
    expect(result.department).toBe("BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)");
    expect(result.degreeLevel).toBe("LISANS");
    expect(result.classYear).toBe(3);
    expect(result.isTurkishHigherEducation).toBe(true);
    expect(result.issueDate).toBe("2026-11-01");
    expect(result.confidence).toBe(0.92);
    expect(result.redFlags).toEqual([]);
  });

  it("mezun belgesini GRADUATE olarak tanır", async () => {
    const result = await analyze("MEZUN BELGESİ\nÜniversite : ANKARA ÜNİVERSİTESİ\nProgram : HUKUK\nLisans\nBelge Tarihi : 01.06.2025");
    expect(result.documentType).toBe("MEZUN_BELGESI");
    expect(result.academicStatus).toBe("GRADUATE");
    expect(result.isEducationDocument).toBe(true);
    expect(result.issueDate).toBe("2025-06-01");
  });

  it("eğitim belgesi olmayan metni DIGER olarak işaretler", async () => {
    const result = await analyze("Bu bir fatura. Toplam tutar 120 TL.");
    expect(result.documentType).toBe("DIGER");
    expect(result.isEducationDocument).toBe(false);
    expect(result.institution).toBeNull();
    expect(result.confidence).toBe(0.4);
    expect(result.issueDate).toBe(TODAY);
  });

  it("'sahte' geçen metni düşük güven ve kırmızı bayrakla işaretler", async () => {
    const result = await analyze(`${STUDENT_TEXT}\nSAHTE TEST`);
    expect(result.confidence).toBe(0.3);
    expect(result.redFlags).toEqual(["Test belgesi sahte olarak işaretlenmiş"]);
  });

  it("model adı mock-1 ve sağlayıcı adı mock'tur", () => {
    expect(provider.model).toBe("mock-1");
    expect(provider.name).toBe("mock");
  });
});
