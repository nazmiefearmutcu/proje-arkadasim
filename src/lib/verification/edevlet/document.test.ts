import { describe, expect, it } from "vitest";
import { parseEDevletDocument, profileFromDocument, titleCaseTr } from "./document";

// Örnek metinler e-Devlet YÖK belgelerinin genel düzenini taklit eder; kişiler kurgudur.
const STUDENT_TABLE = `
Öğrenci Belgesi
Adı Soyadı
AYŞE NUR YILMAZ
Üniversite
ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Fakülte / Yüksekokul / MYO
MÜHENDİSLİK FAKÜLTESİ
Program
BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)
Sınıfı
3
Öğrenim Düzeyi
Lisans
Öğrencilik Durumu
Aktif Öğrenci
Belgenin Oluşturulma Tarihi: 20.11.2026
`;

const GRADUATE_INLINE = `
T.C. YÜKSEKÖĞRETİM KURULU
MEZUN BELGESİ
Adı Soyadı: MEHMET KAYA
Üniversite: Hacettepe Üniversitesi
Fakülte: İktisadi ve İdari Bilimler Fakültesi
Bölüm: İşletme
Mezuniyet Tarihi: 28.06.2024
`;

describe("parseEDevletDocument", () => {
  it("tablo düzenindeki öğrenci belgesini okur", () => {
    const doc = parseEDevletDocument(STUDENT_TABLE);
    expect(doc).toMatchObject({
      kind: "STUDENT_CERT",
      status: "STUDENT",
      university: "Orta Doğu Teknik Üniversitesi",
      faculty: "Mühendislik Fakültesi",
      department: "Bilgisayar Mühendisliği (İngilizce)",
      degreeLevel: "LISANS",
      classYear: 3,
    });
    expect(doc.issueDate?.toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("satır içi mezun belgesini okur", () => {
    const doc = parseEDevletDocument(GRADUATE_INLINE);
    expect(doc).toMatchObject({
      kind: "GRADUATE_CERT",
      status: "GRADUATE",
      university: "Hacettepe Üniversitesi",
      faculty: "İktisadi ve İdari Bilimler Fakültesi",
      department: "İşletme",
      graduationYear: 2024,
    });
  });

  it("kaydı silinmiş öğrenciyi INACTIVE okur", () => {
    const doc = parseEDevletDocument(STUDENT_TABLE.replace("Aktif Öğrenci", "Kaydı Silinmiş"));
    expect(doc.status).toBe("INACTIVE");
  });

  it("lise (MEB) belgesini üniversite belgesi saymaz", () => {
    const doc = parseEDevletDocument("T.C. MİLLİ EĞİTİM BAKANLIĞI\nÖĞRENCİ BELGESİ\nOkul: Atatürk Lisesi\nSınıfı: 11");
    expect(doc.kind).toBe("SCHOOL");
    expect(doc.university).toBeNull();
  });

  it("etiketsiz metinde üniversite adını kendi satırından bulur, cümle içinden almaz", () => {
    const own = parseEDevletDocument("ÖĞRENCİ BELGESİ\nAYŞE NUR YILMAZ\nİSTANBUL TEKNİK ÜNİVERSİTESİ\nöğrencisidir.");
    expect(own.university).toBe("İstanbul Teknik Üniversitesi");
    expect(own.department).toBeNull();

    const sentence = parseEDevletDocument("ÖĞRENCİ BELGESİ\nAYŞE NUR YILMAZ İSTANBUL TEKNİK ÜNİVERSİTESİ ELEKTRİK BÖLÜMÜNDE okumaktadır.");
    expect(sentence.university).toBeNull();
  });

  it("öğrenim düzeyini doğru ayırır", () => {
    expect(parseEDevletDocument("Öğrenim Düzeyi: Yüksek Lisans").degreeLevel).toBe("YUKSEK_LISANS");
    expect(parseEDevletDocument("Öğrenim Düzeyi: Ön Lisans").degreeLevel).toBe("ONLISANS");
    expect(parseEDevletDocument("Lisansüstü Eğitim Enstitüsü Doktora").degreeLevel).toBe("DOKTORA");
  });
});

describe("profileFromDocument", () => {
  it("öğrenci için sınıfı, mezun için mezuniyet yılını yazar ve disiplin grubunu bulur", () => {
    const student = profileFromDocument(parseEDevletDocument(STUDENT_TABLE), new Date("2026-11-27"));
    expect(student).toMatchObject({ academicStatus: "STUDENT", classYear: 3, graduationYear: null });
    expect(student.disciplineGroup).not.toBeNull();

    const graduate = profileFromDocument(parseEDevletDocument(GRADUATE_INLINE), new Date("2026-11-27"));
    expect(graduate).toMatchObject({ academicStatus: "GRADUATE", classYear: null, graduationYear: 2024 });
  });
});

describe("titleCaseTr", () => {
  it("büyük harfli Türkçe metni başlık biçimine çevirir, karışık metne dokunmaz", () => {
    expect(titleCaseTr("İKTİSADİ VE İDARİ BİLİMLER FAKÜLTESİ")).toBe("İktisadi ve İdari Bilimler Fakültesi");
    expect(titleCaseTr("Hacettepe Üniversitesi")).toBe("Hacettepe Üniversitesi");
  });
});
