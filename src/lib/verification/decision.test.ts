import { describe, expect, it } from "vitest";
import {
  decide,
  profileFromAnalysis,
  REASON_NAME_MISMATCH,
  REASON_NOT_EDUCATION,
  REASON_REUSED,
  REASON_REVIEW,
  REASON_STUDENT_TOO_OLD,
  REASON_UNVERIFIED,
} from "./decision";
import type { DecisionInput } from "./decision";
import type { AiAnalysis } from "./providers/types";

const TODAY = new Date("2026-11-08T12:00:00Z");

function analysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    isEducationDocument: true,
    documentType: "OGRENCI_BELGESI",
    academicStatus: "STUDENT",
    institution: "ORTA DOĞU TEKNİK ÜNİVERSİTESİ",
    isTurkishHigherEducation: true,
    faculty: "MÜHENDİSLİK FAKÜLTESİ",
    department: "BİLGİSAYAR MÜHENDİSLİĞİ",
    degreeLevel: "LISANS",
    classYear: 3,
    graduationYear: null,
    issueDate: "2026-11-01",
    issuer: "E_DEVLET",
    redFlags: [],
    confidence: 0.95,
    summary: "Öğrenci belgesi tutarlı.",
    ...overrides,
  };
}

function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    analysis: analysis(),
    aiError: false,
    nameMatch: true,
    source: "PDF_TEXT",
    docHashUsedByOtherVerifiedUser: false,
    today: TODAY,
    ...overrides,
  };
}

describe("decide: kural sırası", () => {
  it("tekrar kullanım, AI hatasının ve diğer her kuralın önündedir", () => {
    const result = decide(
      input({
        docHashUsedByOtherVerifiedUser: true,
        aiError: true,
        analysis: null,
        nameMatch: false,
      }),
    );
    expect(result).toEqual({ status: "REJECTED", reason: REASON_REUSED });
  });

  it("AI hatası, onaylanabilecek bir analizi bile onaylatmaz", () => {
    const result = decide(input({ aiError: true }));
    expect(result).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("belge türü DIGER olan belge, düşük güvenden önce öğrenci-belgesi hatasıyla reddedilir", () => {
    const result = decide(input({ analysis: analysis({ documentType: "DIGER", confidence: 0.1 }) }));
    expect(result).toEqual({ status: "REJECTED", reason: REASON_NOT_EDUCATION });
  });
});

describe("decide: kurallar", () => {
  it("AI analizi yoksa (rıza yok ya da sağlayıcı yok) manuel incelemeye gider", () => {
    expect(decide(input({ analysis: null }))).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("eğitim belgesi değilse reddeder", () => {
    const result = decide(input({ analysis: analysis({ isEducationDocument: false }) }));
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toBe(REASON_NOT_EDUCATION);
  });

  it("PDF kaynağında ad uyuşmazlığı reddedilir", () => {
    const result = decide(input({ nameMatch: false, source: "PDF_TEXT" }));
    expect(result).toEqual({ status: "REJECTED", reason: REASON_NAME_MISMATCH });
  });

  it("OCR kaynağında ad uyuşmazlığı manuel incelemeye gider", () => {
    const result = decide(input({ nameMatch: false, source: "OCR" }));
    expect(result).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("yabancı kurum manuel incelemeye gider", () => {
    const result = decide(input({ analysis: analysis({ isTurkishHigherEducation: false }) }));
    expect(result).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("6 aydan eski öğrenci belgesi reddedilir", () => {
    const result = decide(input({ analysis: analysis({ issueDate: "2026-04-01" }) }));
    expect(result).toEqual({ status: "REJECTED", reason: REASON_STUDENT_TOO_OLD });
  });

  it("tam 183 günlük öğrenci belgesi hâlâ kabul edilir, 184 gün reddedilir", () => {
    // 2026-05-09'dan 2026-11-08'e 183 gün; 2026-05-08'den 184 gün.
    const day183 = decide(input({ analysis: analysis({ issueDate: "2026-05-09" }) }));
    expect(day183.status).toBe("APPROVED");
    const day184 = decide(input({ analysis: analysis({ issueDate: "2026-05-08" }) }));
    expect(day184).toEqual({ status: "REJECTED", reason: REASON_STUDENT_TOO_OLD });
  });

  it("öğrenci belgesinde tarih yoksa manuel incelemeye gider", () => {
    const result = decide(input({ analysis: analysis({ issueDate: null }) }));
    expect(result).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("mezun belgesinde eski tarih reddedilmez", () => {
    const result = decide(
      input({ analysis: analysis({ documentType: "MEZUN_BELGESI", academicStatus: "GRADUATE", issueDate: "2015-01-01" }) }),
    );
    expect(result).toEqual({ status: "APPROVED", reason: null });
  });

  it("güven ≥ 0.85 ve bayrak yoksa onaylar", () => {
    expect(decide(input({ analysis: analysis({ confidence: 0.85 }) }))).toEqual({ status: "APPROVED", reason: null });
  });

  it("güven 0.5 ile 0.85 arasındaysa manuel incelemeye gider", () => {
    expect(decide(input({ analysis: analysis({ confidence: 0.84 }) }))).toEqual({
      status: "MANUAL_REVIEW",
      reason: REASON_REVIEW,
    });
    expect(decide(input({ analysis: analysis({ confidence: 0.5 }) })).status).toBe("MANUAL_REVIEW");
  });

  it("güven yüksek olsa bile herhangi bir kırmızı bayrak otomatik onayı engeller", () => {
    const result = decide(input({ analysis: analysis({ confidence: 0.99, redFlags: ["Tarih tutarsız"] }) }));
    expect(result).toEqual({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
  });

  it("güven 0.5'in altındaysa doğrulanamadı diye reddeder", () => {
    const result = decide(input({ analysis: analysis({ confidence: 0.49 }) }));
    expect(result).toEqual({ status: "REJECTED", reason: REASON_UNVERIFIED });
  });
});

describe("profileFromAnalysis", () => {
  it("öğrenci belgesinden eğitim alanlarını ve disiplin grubunu çıkarır", () => {
    const profile = profileFromAnalysis(analysis({ department: "BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)" }));
    expect(profile).toEqual({
      university: "ORTA DOĞU TEKNİK ÜNİVERSİTESİ",
      faculty: "MÜHENDİSLİK FAKÜLTESİ",
      department: "BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)",
      academicStatus: "STUDENT",
      degreeLevel: "LISANS",
      classYear: 3,
      graduationYear: null,
      disciplineGroup: "yazilim",
    });
  });

  it("mezun belgesi ve diplomada academicStatus GRADUATE olur", () => {
    const mezun = profileFromAnalysis(analysis({ documentType: "MEZUN_BELGESI", academicStatus: "STUDENT" }));
    expect(mezun.academicStatus).toBe("GRADUATE");
    const diploma = profileFromAnalysis(analysis({ documentType: "DIPLOMA", academicStatus: "UNKNOWN" }));
    expect(diploma.academicStatus).toBe("GRADUATE");
  });

  it("UNKNOWN derece ve durum değerleri null olur", () => {
    const profile = profileFromAnalysis(analysis({ degreeLevel: "UNKNOWN", academicStatus: "UNKNOWN", documentType: "TRANSKRIPT" }));
    expect(profile.degreeLevel).toBeNull();
    expect(profile.academicStatus).toBeNull();
  });

  it("bölüm tanınmazsa disiplin grubu null olur", () => {
    expect(profileFromAnalysis(analysis({ department: "Bilinmeyen Bölüm" })).disciplineGroup).toBeNull();
  });
});
