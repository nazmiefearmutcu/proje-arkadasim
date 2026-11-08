import { describe, expect, it } from "vitest";
import { maskDocumentText } from "./mask";

// Tamamen uydurulmuş, e-Devlet benzeri örnek metin. TCKN 10000000146 sağlama kuralından geçer.
const SAMPLE = `T.C.
YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
ÖĞRENCİ BELGESİ
T.C. Kimlik No : 10000000146
Adı Soyadı : AYŞE NUR KILIÇ
Baba Adı : MEHMET
Doğum Yeri : KONYA
Doğum Tarihi : 01.02.2003
Üniversite : ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Fakülte / Yüksekokul : MÜHENDİSLİK FAKÜLTESİ
Program : BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)
Öğrenim Düzeyi : LİSANS
Sınıf : 3
Öğrenci No : 2345678
Kayıt Tarihi : 15.09.2021
Öğrencilik Durumu : AKTİF ÖĞRENCİ
5070 sayılı Elektronik İmza Kanunu uyarınca güvenli elektronik imza ile imzalanmıştır.
Belge Doğrulama Kodu : ABC1-DEF2-GHI3
Barkod No : YOK-2026-ABCDEF12345
İletişim: ogrenci@example.com 0 (532) 123 45 67
Belge Tarihi : 01.11.2026`;

// OCR çıktısını taklit eden varyant: Türkçe harfler düşmüş, TCKN boşluklu, ad satırı bozuk.
const OCR_SAMPLE = `T.C.
YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
ÖĞRENCİ BELGESİ
TC Kimlik No: 1000 0000 146
Adi Soyadi: AYSE NUR KlLIC
Baba Adi: MEHMET
Dogum Yeri: KONYA
Dogum Tarihi: 01.02.2003
Üniversite : ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Fakülte / Yüksekokul : MÜHENDİSLİK FAKÜLTESİ
Program : BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)
Öğrenim Düzeyi : LİSANS
Sınıf : 3
Ogrenci No : 2345678
Kayıt Tarihi : 15.09.2021
Öğrencilik Durumu : AKTİF ÖĞRENCİ
5070 sayılı Elektronik İmza Kanunu uyarınca güvenli elektronik imza ile imzalanmıştır.
Belge Dogrulama Kodu : ABC1-DEF2-GHI3
Barkod No : YOK-2026-ABCDEF12345
İletişim: ogrenci@example.com 0 (532) 123 45 67
Belge Tarihi : 01.11.2026`;

const PERSON = { firstName: "Ayşe Nur", lastName: "Kılıç" };

// Çıktıda ASLA görünmemesi gereken değerler.
const FORBIDDEN = [
  "10000000146",
  "AYŞE",
  "AYSE",
  "NUR",
  "KILIÇ",
  "KILIC",
  "KlLIC",
  "MEHMET",
  "KONYA",
  "01.02.2003",
  "2345678",
  "ABC1-DEF2-GHI3",
  "YOK-2026-ABCDEF12345",
  "ogrenci@example.com",
  "532",
];

// Çıktıda BULUNMASI gereken, işe yarayan alanlar.
const REQUIRED = [
  "ORTA DOĞU TEKNİK ÜNİVERSİTESİ",
  "BİLGİSAYAR MÜHENDİSLİĞİ",
  "LİSANS",
  "Sınıf : 3",
  "15.09.2021",
  "01.11.2026",
  "AKTİF ÖĞRENCİ",
  "5070",
  "ÖĞRENCİ BELGESİ",
];

describe("maskDocumentText", () => {
  it("örnek belgede kişisel verileri çıkarır, işe yarayan alanları korur", () => {
    const { masked } = maskDocumentText(SAMPLE, PERSON);
    for (const forbidden of FORBIDDEN) {
      expect(masked, `içermemeli: ${forbidden}`).not.toContain(forbidden);
    }
    for (const required of REQUIRED) {
      expect(masked, `içermeli: ${required}`).toContain(required);
    }
  });

  it("OCR tarzı varyantta da aynı garantiler geçerlidir", () => {
    const { masked } = maskDocumentText(OCR_SAMPLE, PERSON);
    for (const forbidden of FORBIDDEN) {
      expect(masked, `içermemeli: ${forbidden}`).not.toContain(forbidden);
    }
    for (const required of REQUIRED) {
      expect(masked, `içermeli: ${required}`).toContain(required);
    }
  });

  it("TCKN, etiket ve ad maskelerini kullanır", () => {
    const { masked } = maskDocumentText(SAMPLE, PERSON);
    expect(masked).toContain("[TCKN]");
    expect(masked).toContain("[AD SOYAD]");
    expect(masked).toContain("[GİZLİ]");
  });

  it("maske türü sayımlarını döndürür, değerleri döndürmez", () => {
    const { counts } = maskDocumentText(SAMPLE, PERSON);
    expect(counts.TCKN).toBe(1);
    expect(counts.AD_SOYAD).toBe(1);
    expect(counts.ILETISIM).toBeGreaterThanOrEqual(2);
    expect(counts.NUMARA).toBe(0);
    for (const value of Object.values(counts)) {
      expect(typeof value).toBe("number");
    }
  });

  it("TCKN'yi sağlama algoritmasından bağımsız olarak maskeler", () => {
    const { masked } = maskDocumentText("Kayıt 11111111111 numarası", PERSON);
    expect(masked).not.toContain("11111111111");
    expect(masked).toContain("[TCKN]");
  });

  it("nokta ve tire ile bölünmüş TCKN varyantlarını maskeler", () => {
    expect(maskDocumentText("No 100-000-001-46 kayıt", PERSON).masked).not.toContain("100-000-001-46");
    expect(maskDocumentText("No 100.000.001.46 kayıt", PERSON).masked).not.toMatch(/100\.000\.001\.46/);
  });

  it("etiketli değeri tırnak ve Türkçe harf farkı olmadan da maskeler", () => {
    const { masked } = maskDocumentText("DOĞUM TARİHİ : 01.02.2003\nDogum tarihi: 04.05.1999", PERSON);
    expect(masked).not.toContain("01.02.2003");
    expect(masked).not.toContain("04.05.1999");
  });

  it("'Adı' etiketini ve 'Baba Adı' etiketini ayırt eder", () => {
    const { masked } = maskDocumentText("Baba Adı : Hasan\nAdı : Zeynep", PERSON);
    expect(masked).toContain("Baba Adı : [GİZLİ]");
    expect(masked).toContain("Adı : [AD SOYAD]");
    expect(masked).not.toContain("Hasan");
    expect(masked).not.toContain("Zeynep");
  });

  it("e-posta, Türkiye telefonu ve IBAN'ı maskeler", () => {
    const text = "E-posta: a.b@ornek.com\nTelefon: +90 532 123 45 67\nIBAN TR33 0006 1005 1978 6457 8413 26";
    const { masked } = maskDocumentText(text, PERSON);
    expect(masked).not.toContain("a.b@ornek.com");
    expect(masked).not.toContain("532");
    expect(masked).not.toContain("0006 1005");
  });

  it("6 ve üzeri hanelik sayıları maskeler; 4 haneli yılları ve tarihleri korur", () => {
    const { masked } = maskDocumentText("Ref 9876543 Yıl 2026 Tarih 12.03.2025", PERSON);
    expect(masked).toContain("[NUMARA]");
    expect(masked).not.toContain("9876543");
    expect(masked).toContain("2026");
    expect(masked).toContain("12.03.2025");
  });

  it("OCR gürültüsündeki ad parçalarını Levenshtein ≤ 1 ile yakalar", () => {
    const { masked } = maskDocumentText("Sayın AYSA NUR KILIC bilgilerinize", PERSON);
    expect(masked).toContain("[AD]");
    expect(masked).toContain("[SOYAD]");
    expect(masked).not.toContain("KILIC");
  });

  it("çıktıyı 6000 karakterle sınırlar", () => {
    const { masked } = maskDocumentText("Bilgi satırı ".repeat(1000), PERSON);
    expect(masked.length).toBeLessThanOrEqual(6000);
  });

  it("satır sonlarını korur", () => {
    const { masked } = maskDocumentText("Üniversite : ABC\nProgram : XYZ", PERSON);
    expect(masked.split("\n")).toHaveLength(2);
  });
});

describe("maskDocumentText — spec §5.1 etiketleri (yalın ve iyelik biçimleri)", () => {
  const OTHER = { firstName: "Zeynep", lastName: "Arslan" };
  const SECRET = "GIZLIDEGER";

  // Her satır: etiket ve beklenen maske. Değer her seferinde aynı sabit metindir.
  const LABELS: Array<[string, string]> = [
    ["Baba Adı", "[GİZLİ]"],
    ["Anne Adı", "[GİZLİ]"],
    ["Ana Adı", "[GİZLİ]"],
    ["Doğum Yeri", "[GİZLİ]"],
    ["Doğum Tarihi", "[GİZLİ]"],
    ["Doğum Yeri / Tarihi", "[GİZLİ]"],
    ["Öğrenci No", "[GİZLİ]"],
    ["Öğrenci Numarası", "[GİZLİ]"],
    ["Uyruk", "[GİZLİ]"],
    ["Uyruğu", "[GİZLİ]"],
    ["Adres", "[GİZLİ]"],
    ["Adresi", "[GİZLİ]"],
    ["İkamet Adresi", "[GİZLİ]"],
    ["Telefon", "[GİZLİ]"],
    ["Telefonu", "[GİZLİ]"],
    ["Cep Telefonu", "[GİZLİ]"],
    ["Telefon No", "[GİZLİ]"],
    ["E-posta", "[GİZLİ]"],
    ["E-posta Adresi", "[GİZLİ]"],
    ["Seri No", "[GİZLİ]"],
    ["Seri Numarası", "[GİZLİ]"],
    ["Barkod", "[GİZLİ]"],
    ["Barkod No", "[GİZLİ]"],
    ["Doğrulama Kodu", "[GİZLİ]"],
    ["Belge Doğrulama Kodu", "[GİZLİ]"],
    ["Kimlik No", "[GİZLİ]"],
    ["Kimlik Numarası", "[GİZLİ]"],
    ["T.C. Kimlik Numarası", "[GİZLİ]"],
    ["(T.C.) Kimlik Numarası", "[GİZLİ]"],
    ["Kimlik", "[GİZLİ]"],
    ["Adı Soyadı", "[AD SOYAD]"],
    ["Adı", "[AD SOYAD]"],
    ["Soyadı", "[AD SOYAD]"],
  ];

  for (const [label, mask] of LABELS) {
    it(`'${label} :' değerini ${mask} ile maskeler`, () => {
      for (const variant of [`${label} : ${SECRET}`, `${label.toLocaleUpperCase("tr-TR")}: ${SECRET}`]) {
        const { masked } = maskDocumentText(`Üniversite : ABC\n${variant}\nProgram : XYZ`, OTHER);
        expect(masked, variant).not.toContain(SECRET);
        expect(masked, variant).toContain(mask);
        expect(masked, variant).toContain("Üniversite : ABC");
        expect(masked, variant).toContain("Program : XYZ");
      }
    });
  }

  it("ikamet adresini ve önek almamış cep telefonunu maskeler", () => {
    const text = "İkamet Adresi : Kızılay Mah. Atatürk Bulvarı No: 5 Çankaya/ANKARA\nCep Telefonu : 532 123 45 67";
    const { masked } = maskDocumentText(text, OTHER);
    expect(masked).not.toContain("Kızılay");
    expect(masked).not.toContain("ANKARA");
    expect(masked).not.toContain("532");
    expect(masked).toContain("İkamet Adresi : [GİZLİ]");
    expect(masked).toContain("Cep Telefonu : [GİZLİ]");
  });

  it("seri numarasını ve e-posta adresi etiketini maskeler", () => {
    const { masked } = maskDocumentText("Seri No : A12B34567\nE-posta Adresi : kisi@ornek.com", OTHER);
    expect(masked).not.toContain("A12B34567");
    expect(masked).not.toContain("kisi@ornek.com");
    expect(masked).toContain("E-posta Adresi : [GİZLİ]");
  });

  it("'(T.C.) Kimlik Numarası' satırında 11 haneli değer [TCKN] olur, etiket korunur", () => {
    const { masked } = maskDocumentText("(T.C.) Kimlik Numarası : 10000000146", OTHER);
    expect(masked).toBe("(T.C.) Kimlik Numarası : [TCKN]");
  });

  it("çıplak 'Kimlik' yalnız satır başında ve ':' ile etikettir; cümle içinde maskelenmez", () => {
    const text = "Kimlik : AB123\nKimlik bilgileri e-Devlet üzerinden doğrulanmıştır.";
    const { masked } = maskDocumentText(text, OTHER);
    expect(masked).not.toContain("AB123");
    expect(masked).toContain("Kimlik : [GİZLİ]");
    expect(masked).toContain("Kimlik bilgileri e-Devlet üzerinden doğrulanmıştır.");
  });
});

describe("maskDocumentText — 'Adı' etiketi yalnız satır başında", () => {
  const PERSON_2 = { firstName: "Ayşe Nur", lastName: "Kılıç" };

  it("kurum/program adı satırlarının değerini korur", () => {
    const text = [
      "Program Adı : BİLGİSAYAR MÜHENDİSLİĞİ",
      "Üniversite Adı : ORTA DOĞU TEKNİK ÜNİVERSİTESİ",
      "Fakülte Adı : MÜHENDİSLİK FAKÜLTESİ",
      "Bölüm Adı : MAKİNE MÜHENDİSLİĞİ",
    ].join("\n");
    const { masked, counts } = maskDocumentText(text, PERSON_2);
    expect(masked).toBe(text);
    expect(counts.AD_SOYAD).toBe(0);
  });

  it("'Adı geçen öğrenci' cümlesini korur, kayıtlı adı yine maskeler", () => {
    const text = "Adı geçen öğrenci AYŞE NUR KILIÇ Bilgisayar Mühendisliği Bölümü 3. sınıf öğrencisidir.";
    const { masked } = maskDocumentText(text, PERSON_2);
    expect(masked).toBe(
      "Adı geçen öğrenci [AD] [AD] [SOYAD] Bilgisayar Mühendisliği Bölümü 3. sınıf öğrencisidir.",
    );
  });

  it("satır başındaki 'Adı :' ve 'Soyadı :' etiketlerini maskelemeye devam eder", () => {
    const { masked } = maskDocumentText("  Adı : Zeynep\nSoyadı: Demir\nAnne Kızlık Soyadı : Yılmaz", PERSON_2);
    expect(masked).toBe("Adı : [AD SOYAD]\nSoyadı: [AD SOYAD]\nAnne Kızlık Soyadı : [AD SOYAD]");
  });

  it("'Adı/Soyadı' biçimini de ad etiketi sayar", () => {
    const { masked } = maskDocumentText("Öğrencinin Adı/Soyadı : Zeynep Demir", PERSON_2);
    expect(masked).toBe("Öğrencinin Adı/Soyadı : [AD SOYAD]");
  });

  it("CRLF satır sonlarıyla da satır başını tanır", () => {
    const { masked } = maskDocumentText("Program Adı : X\r\nAdı : Zeynep\r\nSınıf : 3", PERSON_2);
    expect(masked).toBe("Program Adı : X\nAdı : [AD SOYAD]\nSınıf : 3");
  });
});

describe("maskDocumentText — rakam içeren OCR ad belirteçleri", () => {
  it("'AYŞE K1LIÇ' içindeki soyadı maskeler", () => {
    const { masked } = maskDocumentText("Sayın AYŞE K1LIÇ 2023 yılında", { firstName: "Ayşe", lastName: "Kılıç" });
    expect(masked).toBe("Sayın [AD] [SOYAD] 2023 yılında");
  });

  it("'ÖZT0RK' soyadını maskeler, yılları ve sayıları olduğu gibi bırakır", () => {
    const { masked } = maskDocumentText("Öğrenci MEHMET ÖZT0RK 2023 - 2024", { firstName: "Mehmet", lastName: "Öztürk" });
    expect(masked).toBe("Öğrenci [AD] [SOYAD] 2023 - 2024");
  });
});

describe("maskDocumentText — TCKN ayırıcı varyantları", () => {
  it("çift boşluklu ve sekmeli TCKN'leri maskeler", () => {
    for (const text of ["TC Kimllk No: 1000  0000 146", "No\t100\t000\t001\t46 kayıt", "No 100 - 000 - 001 - 46"]) {
      const { masked, counts } = maskDocumentText(text, PERSON);
      expect(masked, text).toContain("[TCKN]");
      expect(masked, text).not.toMatch(/146|46 kayıt$/);
      expect(counts.TCKN, text).toBe(1);
    }
  });

  it("tarih aralıklarını TCKN olarak maskelemez", () => {
    for (const range of ["15.09.2023 - 15.09.2024", "01.01.2000-01.01.2001", "2021 - 2022 / 2023 - 2024"]) {
      const { masked, counts } = maskDocumentText(`Dönem : ${range}`, PERSON);
      expect(masked, range).toBe(`Dönem : ${range}`);
      expect(counts.TCKN, range).toBe(0);
    }
  });
});
