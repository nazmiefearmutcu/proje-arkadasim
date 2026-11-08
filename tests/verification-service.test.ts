import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { recordConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { MESSAGES, purgeExpiredMaskedText, verifyDocument } from "@/lib/verification/service";
import { REASON_NAME_MISMATCH, REASON_REUSED } from "@/lib/verification/decision";
import { createUser, resetDb } from "./helpers/db";

// Çıkarılan metin ve mesajların kendisi, yalnızca bu testlerin amaçladığı "XQZMARKER123" gibi
// işaretçiler üzerinden doğrulanır. PDF'ler çalışma anında pdf-lib ile üretilir (ASCII metin).

// Olağan mock sağlayıcı ve sabit pepper: testler dış servise bağlı değildir.
vi.mock("@/lib/verification/extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verification/extract")>();
  return {
    ...actual,
    extractFromImage: vi.fn(async () => ({ text: "", confidence: 10 })),
  };
});

// Yapay zekaya giden girdiyi kaydeder (mock sağlayıcının kendisi değişmez).
const aiInputs = vi.hoisted(() => [] as Array<{ maskedText: string; signals: { pdf?: { producer: string | null; creator: string | null } } }>);
vi.mock("@/lib/verification/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verification/providers")>();
  return {
    ...actual,
    getVerifierProvider: () => {
      const provider = actual.getVerifierProvider();
      if (!provider) return null;
      return {
        ...provider,
        analyze: (input: Parameters<typeof provider.analyze>[0]) => {
          aiInputs.push(input);
          return provider.analyze(input);
        },
      };
    },
  };
});

const PDF_MARKER = "XQZMARKER123";
const TCKN = "10000000146";

function todayDotted(): string {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${now.getUTCFullYear()}`;
}

async function buildStudentPdf(options: { creator?: string; producer?: string } = {}): Promise<Uint8Array> {
  const lines = [
    "T.C.",
    "YUKSEKOGRETIM KURULU BASKANLIGI",
    "OGRENCI BELGESI",
    `T.C. Kimlik No : ${TCKN}`,
    "Adi Soyadi : AYSE NUR KILIC",
    "Baba Adi : MEHMET",
    "Dogum Tarihi : 01.02.2003",
    "Universite : ORTA DOGU TEKNIK UNIVERSITESI",
    "Fakulte / Yuksekokul : MUHENDISLIK FAKULTESI",
    "Program : BILGISAYAR MUHENDISLIGI",
    "Ogrenim Duzeyi : LISANS",
    "Sinif : 3",
    "Ogrenci No : 2345678",
    "Kayit Tarihi : 15.09.2021",
    "Ogrencilik Durumu : AKTIF OGRENCI",
    `Belge Dogrulama Kodu : ${PDF_MARKER}`,
    `Belge Tarihi : ${todayDotted()}`,
  ];
  const doc = await PDFDocument.create();
  if (options.creator) doc.setCreator(options.creator);
  if (options.producer) doc.setProducer(options.producer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }
  return doc.save();
}

async function unverifiedUser(overrides: Parameters<typeof createUser>[0] = {}) {
  return createUser({
    firstName: "Ayşe Nur",
    lastName: "Kılıç",
    verificationStatus: "UNVERIFIED",
    verifiedAt: null,
    academicStatus: null,
    university: null,
    faculty: null,
    department: null,
    disciplineGroup: null,
    ...overrides,
  });
}

describe("belge doğrulama servisi", () => {
  const savedEnv = {
    VERIFIER_PROVIDER: process.env.VERIFIER_PROVIDER,
    DOC_HASH_PEPPER: process.env.DOC_HASH_PEPPER,
  };

  beforeAll(() => {
    process.env.VERIFIER_PROVIDER = "mock";
    process.env.DOC_HASH_PEPPER = "test";
  });

  afterAll(() => {
    process.env.VERIFIER_PROVIDER = savedEnv.VERIFIER_PROVIDER;
    process.env.DOC_HASH_PEPPER = savedEnv.DOC_HASH_PEPPER;
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("rıza varsa onaylar, profili yazar ve kişisel veriyi veritabanına bırakmaz", async () => {
    const user = await unverifiedUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });
    expect(outcome.status).toBe("APPROVED");
    expect(outcome.consumedAttempt).toBe(true);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("VERIFIED");
    expect(refreshed.university).toBe("ORTA DOGU TEKNIK UNIVERSITESI");
    expect(refreshed.department).toBe("BILGISAYAR MUHENDISLIGI");
    expect(refreshed.disciplineGroup).toBe("yazilim");

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("APPROVED");
    expect(attempt.maskedText).toBeNull();

    const dbFiles = ["test.db", "test.db-journal", "test.db-wal"]
      .map((name) => path.resolve(process.cwd(), "prisma", name))
      .filter((file) => existsSync(file));
    expect(dbFiles.length).toBeGreaterThan(0);
    for (const file of dbFiles) {
      const contents = readFileSync(file);
      expect(contents.includes(Buffer.from(TCKN)), `${path.basename(file)} TCKN içermemeli`).toBe(false);
      expect(
        contents.includes(Buffer.from(PDF_MARKER)),
        `${path.basename(file)} işaretçi içermemeli`,
      ).toBe(false);
    }
  });

  it("rıza yoksa manuel incelemeye gider ve maskeli metni süreli saklar", async () => {
    const user = await unverifiedUser();

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });
    expect(outcome.status).toBe("MANUAL_REVIEW");

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("MANUAL_REVIEW");

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.maskedText).toContain("[TCKN]");
    expect(attempt.maskedText).not.toContain(TCKN);
    expect(attempt.maskedTextExpiresAt).not.toBeNull();
  });

  it("ad soyad uyuşmazlığında PDF kaynağı için ret döndürür", async () => {
    const user = await unverifiedUser({ firstName: "Mehmet", lastName: "Demir" });
    await recordConsent(user.id, "CROSS_BORDER_AI", true);

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });
    expect(outcome.status).toBe("REJECTED");
    expect(outcome.message).toBe(REASON_NAME_MISMATCH);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("REJECTED");
  });

  it("aynı belge onaylanmış başka bir hesapta varsa tekrar kullanım olarak reddeder", async () => {
    // Aynı belge bir kez üretilir; her doğrulama kendi kopyasını alır (verifyDocument girdiyi sıfırlar).
    // Ayrı ayrı üretmek, pdf-lib'in tarih meta verisi yüzünden bayt farkı ve kararsız test doğurur.
    const pdfBytes = await buildStudentPdf();

    const first = await unverifiedUser();
    await recordConsent(first.id, "CROSS_BORDER_AI", true);
    const firstOutcome = await verifyDocument({ userId: first.id, bytes: pdfBytes.slice() });
    expect(firstOutcome.status).toBe("APPROVED");

    const second = await unverifiedUser();
    await recordConsent(second.id, "CROSS_BORDER_AI", true);
    const secondOutcome = await verifyDocument({ userId: second.id, bytes: pdfBytes.slice() });
    expect(secondOutcome.status).toBe("REJECTED");
    expect(secondOutcome.message).toBe(REASON_REUSED);
  });

  it("PDF üretici alanındaki kişi adı yapay zekaya maskeli gider", async () => {
    const user = await unverifiedUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    aiInputs.length = 0;

    const outcome = await verifyDocument({
      userId: user.id,
      bytes: await buildStudentPdf({ creator: "Ayse Nur Kilic" }),
    });
    expect(outcome.status).toBe("APPROVED");

    expect(aiInputs).toHaveLength(1);
    const sent = JSON.stringify(aiInputs[0]).toLowerCase();
    expect(sent).not.toContain("ayse");
    expect(sent).not.toContain("kilic");
    expect(sent).not.toContain(TCKN);

    // Serbest metin üretici alanı yapay zekaya ham gitmez; bilinmeyen değer "other" olur.
    expect(aiInputs[0].signals.pdf?.creator).toBe("other");
  });

  it("üçüncü kişi adı ve cihaz adı içeren üretici/yazılım alanları yapay zekaya gitmez", async () => {
    const user = await unverifiedUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    aiInputs.length = 0;

    const outcome = await verifyDocument({
      userId: user.id,
      bytes: await buildStudentPdf({
        creator: "Mehmet Demir",
        producer: "DESKTOP-K3J9 / kullanici aysenur.kilic-laptop",
      }),
    });
    expect(outcome.status).toBe("APPROVED");

    expect(aiInputs).toHaveLength(1);
    const body = JSON.stringify(aiInputs[0]).toLowerCase();
    for (const forbidden of ["mehmet", "demir", "desktop-k3j9", "kullanici", "aysenur", "laptop", "kilic"]) {
      expect(body).not.toContain(forbidden);
    }
    expect(aiInputs[0].signals.pdf?.creator).toBe("other");
    expect(aiInputs[0].signals.pdf?.producer).toBe("other");
  });

  it("bilinen üretici ailesi sabit etiketle gider", async () => {
    const user = await unverifiedUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    aiInputs.length = 0;

    const outcome = await verifyDocument({
      userId: user.id,
      bytes: await buildStudentPdf({ creator: "Microsoft Word - Ayse Nur Kilic.docx", producer: "iText 7.2.1" }),
    });
    expect(outcome.status).toBe("APPROVED");

    expect(aiInputs).toHaveLength(1);
    expect(aiInputs[0].signals.pdf?.creator).toBe("Microsoft");
    expect(aiInputs[0].signals.pdf?.producer).toBe("iText");
    expect(JSON.stringify(aiInputs[0]).toLowerCase()).not.toContain("kilic");
  });

  it("24 saatte 5 denemeden sonra altıncı belgeyi ERROR ile durdurur, deneme kaydetmez", async () => {
    const user = await unverifiedUser();
    await db.verificationAttempt.createMany({
      data: Array.from({ length: 5 }, () => ({
        userId: user.id,
        status: "REJECTED",
        source: "PDF_TEXT",
        docHash: "h",
        nameMatch: false,
        rejectReason: "test",
      })),
    });

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });
    expect(outcome.status).toBe("ERROR");
    expect(outcome.message).toBe(MESSAGES.ATTEMPT_LIMIT);
    expect(outcome.consumedAttempt).toBe(false);

    const count = await db.verificationAttempt.count({ where: { userId: user.id } });
    expect(count).toBe(5);
  });

  it("geçerli PNG başlığı olup okunamayan görseli ERROR ile reddeder", async () => {
    const user = await unverifiedUser();
    const garbage = new Uint8Array(64);
    garbage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (let i = 8; i < garbage.length; i++) garbage[i] = (i * 37) % 251;

    const outcome = await verifyDocument({ userId: user.id, bytes: garbage });
    expect(outcome.status).toBe("ERROR");
    expect(outcome.message).toBe(MESSAGES.OCR_FAILED);
    expect(outcome.consumedAttempt).toBe(false);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("UNVERIFIED");
  });

  it("süresi geçen maskeli metni temizler, güncel olanı korur", async () => {
    const user = await unverifiedUser();
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const expired = await db.verificationAttempt.create({
      data: {
        userId: user.id,
        status: "MANUAL_REVIEW",
        source: "PDF_TEXT",
        docHash: "expired",
        nameMatch: true,
        maskedText: "[AD SOYAD] süresi dolmuş",
        maskedTextExpiresAt: past,
      },
    });
    const fresh = await db.verificationAttempt.create({
      data: {
        userId: user.id,
        status: "MANUAL_REVIEW",
        source: "PDF_TEXT",
        docHash: "fresh",
        nameMatch: true,
        maskedText: "[AD SOYAD] hâlâ geçerli",
        maskedTextExpiresAt: future,
      },
    });

    const cleared = await purgeExpiredMaskedText(new Date());
    expect(cleared).toBe(1);

    const expiredAfter = await db.verificationAttempt.findUniqueOrThrow({ where: { id: expired.id } });
    const freshAfter = await db.verificationAttempt.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(expiredAfter.maskedText).toBeNull();
    expect(freshAfter.maskedText).toBe("[AD SOYAD] hâlâ geçerli");
  });
});
