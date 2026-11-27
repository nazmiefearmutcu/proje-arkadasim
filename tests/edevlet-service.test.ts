import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setEDevletClientForTests } from "@/lib/verification/edevlet";
import type { EDevletClient, EDevletQuery, EDevletResult } from "@/lib/verification/edevlet";
import { BARCODE_MESSAGES, invalidDocumentMessage, verifyBarcode } from "@/lib/verification/edevlet/service";
import { REASON_NAME_MISMATCH, REASON_REUSED, REASON_REVIEW } from "@/lib/verification/decision";
import { createUser, resetDb } from "./helpers/db";

// Gerçek kişiye ait olmayan, kontrol haneleri tutan test numarası.
const TCKN = "10000000146";
const BARCODE = "YOKOB-1234-ABCD-5678";

const STUDENT_TEXT = (name: string, date = todayTr()) => `ÖĞRENCİ BELGESİ
Adı Soyadı: ${name}
Üniversite: ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Fakülte: MÜHENDİSLİK FAKÜLTESİ
Program: BİLGİSAYAR MÜHENDİSLİĞİ
Sınıfı: 3
Öğrenim Düzeyi: Lisans
Öğrencilik Durumu: Aktif Öğrenci
Belge Tarihi: ${date}`;

// YÖK'ün e-Devlet öğrenci belgesinin PDF metni (düzen gerçek belgeden; kişi bilgileri uydurma).
// Etiketler ve değerler ayrı satırlara dağılır; program satırı iki satıra bölünür.
const YOK_TEXT = (name: string, issued: string, registered: string) => `YOKOGABCDEFGHIJKL
ANKARA
T.C.
YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
${issued}
ÖĞRENCİ BELGESİ
Adı / Soyadı ${name}
Anne Adı FATMA
ALİBaba Adı
Doğum Tarihi / Uyruğu
Kayıt Tarihi
Eğitim Türü / Öğrenim Süresi
01.01.2005 / TÜRKİYE CUMHURİYETİ
${registered}
ÖRGÜN ÖĞRETİM / 4
${TCKN}T.C. Kimlik No
İLGİLİ MAKAMA
:
:
:
AKTİF ÖĞRENCİ:Öğrencilik Durumu
Sınıf : 2. SINIF
Program ESKİŞEHİR TEKNİK ÜNİVERSİTESİ/FEN FAKÜLTESİ/BİYOLOJİ
BÖLÜMÜ/BİYOLOJİ PR./
:
Yukarıda kimlik bilgileri yer alan kişinin Eskişehir Teknik Üniversitesi tarafından yukarıda belirtilen
programın kayıtlı öğrencisi olduğu bildirilmiştir.`;

function todayTr(offsetDays = 0): string {
  const date = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
}

class StubClient implements EDevletClient {
  readonly queries: EDevletQuery[] = [];
  constructor(private readonly respond: (query: EDevletQuery) => EDevletResult) {}
  async verify(query: EDevletQuery): Promise<EDevletResult> {
    this.queries.push(query);
    return this.respond(query);
  }
}

function useClient(respond: (query: EDevletQuery) => EDevletResult): StubClient {
  const client = new StubClient(respond);
  setEDevletClientForTests(client);
  return client;
}

const saved = { pepper: process.env.DOC_HASH_PEPPER, toggle: process.env.EDEVLET_VERIFICATION };

describe("verifyBarcode (e-Devlet barkodu)", () => {
  beforeAll(() => {
    process.env.DOC_HASH_PEPPER = "test";
  });
  afterAll(() => {
    process.env.DOC_HASH_PEPPER = saved.pepper;
    process.env.EDEVLET_VERIFICATION = saved.toggle;
  });
  beforeEach(async () => {
    await resetDb();
    delete process.env.EDEVLET_VERIFICATION;
    (globalThis as { __rateLimitEntries?: Map<string, unknown> }).__rateLimitEntries?.clear();
  });
  afterEach(() => {
    setEDevletClientForTests(null);
  });

  async function unverified(firstName = "Ayşe Nur", lastName = "Yılmaz") {
    return createUser({ firstName, lastName, verificationStatus: "UNVERIFIED", university: null, department: null, verifiedAt: null });
  }

  it("e-Devlet'in bulduğu ve adı tutan öğrenci belgesini anında onaylar, profili yazar", async () => {
    const user = await unverified();
    const client = useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("AYŞE NUR YILMAZ"), pdf: null }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE.toLowerCase(), tckn: TCKN });

    expect(outcome).toEqual({ status: "APPROVED", message: BARCODE_MESSAGES.APPROVED });
    expect(client.queries).toEqual([{ barcode: BARCODE, tckn: TCKN }]);
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated).toMatchObject({
      verificationStatus: "VERIFIED",
      academicStatus: "STUDENT",
      university: "Orta Doğu Teknik Üniversitesi",
      faculty: "Mühendislik Fakültesi",
      department: "Bilgisayar Mühendisliği",
      degreeLevel: "LISANS",
      classYear: 3,
    });
    expect(updated.disciplineGroup).not.toBeNull();

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt).toMatchObject({ status: "APPROVED", source: "EDEVLET", nameMatch: true, maskedText: null });
    // Ne barkod ne de kimlik no düz metin olarak saklanır.
    const stored = JSON.stringify(attempt);
    expect(stored).not.toContain(TCKN);
    expect(stored).not.toContain("1234-ABCD");
    expect(await db.notification.count({ where: { userId: user.id, type: "VERIFICATION_RESULT" } })).toBe(1);
  });

  it("ad tutmazsa reddeder", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("MEHMET KAYA"), pdf: null }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "REJECTED", message: REASON_NAME_MISMATCH });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).verificationStatus).toBe("REJECTED");
  });

  it("tanımsız barkodu ve tutmayan kimlik noyu alan hatasıyla reddeder", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "NOT_FOUND", message: "tanımlı değil" }));
    expect(await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN })).toMatchObject({
      status: "REJECTED",
      fieldErrors: { barcode: BARCODE_MESSAGES.NOT_FOUND },
    });

    useClient(() => ({ kind: "MISMATCH", message: "uyuşmuyor" }));
    expect(await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN })).toMatchObject({
      status: "REJECTED",
      fieldErrors: { tckn: BARCODE_MESSAGES.MISMATCH },
    });
    expect(await db.verificationAttempt.count({ where: { userId: user.id } })).toBe(2);
  });

  it("YÖK öğrenci belgesi düzenindeki (Program: ÜNİVERSİTE/FAKÜLTE/BÖLÜM) belgeyi onaylar", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "FOUND", text: YOK_TEXT("AYŞE NUR YILMAZ", todayTr(3), todayTr(400)), pdf: null }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "APPROVED", message: BARCODE_MESSAGES.APPROVED });
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      verificationStatus: "VERIFIED",
      academicStatus: "STUDENT",
      university: "Eskişehir Teknik Üniversitesi",
      faculty: "Fen Fakültesi",
      department: "Biyoloji",
      degreeLevel: "LISANS",
      classYear: 2,
    });
  });

  it("e-Devlet belgeyi geçersiz sayarsa e-Devlet'in açıklamasıyla reddeder", async () => {
    const user = await unverified();
    const warning = "Bilgileriniz değiştiğinden belge geçersizdir. Belgeyi yeniden oluşturunuz.";
    useClient(() => ({ kind: "INVALID", message: warning }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "REJECTED", message: invalidDocumentMessage(warning) });
    expect(outcome.message).toContain(warning);
    expect(await db.verificationAttempt.count({ where: { userId: user.id, status: "REJECTED" } })).toBe(1);
  });

  it("e-Devlet'e ulaşılamazsa deneme saymaz ve belge yükleme yolunu önerir", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "UNAVAILABLE", reason: "captcha" }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "ERROR", message: BARCODE_MESSAGES.UNAVAILABLE });
    expect(await db.verificationAttempt.count()).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).verificationStatus).toBe("UNVERIFIED");
  });

  it("geçersiz girdide e-Devlet'e hiç sormaz", async () => {
    const user = await unverified();
    const client = useClient(() => ({ kind: "NOT_FOUND", message: "" }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: "ab", tckn: "12345678901" });

    expect(outcome.status).toBe("ERROR");
    expect(outcome.fieldErrors).toEqual({ barcode: BARCODE_MESSAGES.INVALID_BARCODE, tckn: BARCODE_MESSAGES.INVALID_TCKN });
    expect(client.queries).toHaveLength(0);
  });

  it("bilgiler okunamazsa editör incelemesine gönderir", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "FOUND", text: "ÖĞRENCİ BELGESİ\nAYŞE NUR YILMAZ\nbelgenin geri kalanı okunamadı", pdf: null }));

    const outcome = await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "MANUAL_REVIEW", message: REASON_REVIEW });
    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("MANUAL_REVIEW");
    expect(attempt.maskedText).not.toBeNull();
    expect(attempt.maskedText).not.toContain("YILMAZ");
  });

  it("kaydı silinmiş öğrenciyi ve 6 aydan eski öğrenci belgesini reddeder", async () => {
    const user = await unverified();
    useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("AYŞE NUR YILMAZ").replace("Aktif Öğrenci", "Kaydı Silinmiş"), pdf: null }));
    expect(await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN })).toEqual({
      status: "REJECTED",
      message: BARCODE_MESSAGES.INACTIVE,
    });

    useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("AYŞE NUR YILMAZ", todayTr(200)), pdf: null }));
    expect(await verifyBarcode({ userId: user.id, barcode: "YOKOB-9999-ABCD-0000", tckn: TCKN })).toEqual({
      status: "REJECTED",
      message: BARCODE_MESSAGES.TOO_OLD,
    });
  });

  it("başka doğrulanmış hesapta kullanılan barkod için e-Devlet'e sormadan reddeder", async () => {
    const first = await unverified();
    useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("AYŞE NUR YILMAZ"), pdf: null }));
    expect((await verifyBarcode({ userId: first.id, barcode: BARCODE, tckn: TCKN })).status).toBe("APPROVED");

    const second = await unverified();
    const client = useClient(() => ({ kind: "FOUND", text: STUDENT_TEXT("AYŞE NUR YILMAZ"), pdf: null }));
    const outcome = await verifyBarcode({ userId: second.id, barcode: BARCODE, tckn: TCKN });

    expect(outcome).toEqual({ status: "REJECTED", message: REASON_REUSED });
    expect(client.queries).toHaveLength(0);
  });

  it("EDEVLET_VERIFICATION=off iken kapalıdır", async () => {
    const user = await unverified();
    process.env.EDEVLET_VERIFICATION = "off";
    const client = useClient(() => ({ kind: "NOT_FOUND", message: "" }));

    expect(await verifyBarcode({ userId: user.id, barcode: BARCODE, tckn: TCKN })).toEqual({
      status: "ERROR",
      message: BARCODE_MESSAGES.DISABLED,
    });
    expect(client.queries).toHaveLength(0);
  });
});
