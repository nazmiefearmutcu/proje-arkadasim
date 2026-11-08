import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { recordConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import {
  MAX_ERROR_ATTEMPTS_PER_WINDOW,
  MESSAGES,
  purgeExpiredMaskedText,
  verifyDocument,
} from "@/lib/verification/service";
import { REASON_NAME_MISMATCH, REASON_REUSED, REASON_REVIEW } from "@/lib/verification/decision";
import {
  DocumentTooLargeError,
  extractFromImage,
  extractFromPdf,
  OcrUnavailableError,
} from "@/lib/verification/extract";
import { createUser, resetDb } from "./helpers/db";

// Çıkarılan metin ve mesajların kendisi, yalnızca bu testlerin amaçladığı "XQZMARKER123" gibi
// işaretçiler üzerinden doğrulanır. PDF'ler çalışma anında pdf-lib ile üretilir (ASCII metin).

// Olağan mock sağlayıcı ve sabit pepper: testler dış servise bağlı değildir. PDF çıkarımı gerçektir,
// yalnızca çağrıları sayılır.
vi.mock("@/lib/verification/extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verification/extract")>();
  return {
    ...actual,
    extractFromPdf: vi.fn(actual.extractFromPdf),
    extractFromImage: vi.fn(async () => ({ text: "", confidence: 10 })),
  };
});

type AiInput = { maskedText: string; signals: { pdf?: { producer: string | null; creator: string | null } } };

// Yapay zekaya giden girdiyi kaydeder (mock sağlayıcının kendisi değişmez). Kancalar, analiz
// sırasında veritabanını değiştirmeye ya da sağlayıcı hatası üretmeye yarar.
const aiInputs = vi.hoisted(() => [] as AiInput[]);
const providerHooks = vi.hoisted(() => ({
  beforeAnalyze: null as null | ((input: AiInput) => Promise<void>),
  failAnalyze: false,
}));
vi.mock("@/lib/verification/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verification/providers")>();
  return {
    ...actual,
    getVerifierProvider: () => {
      const provider = actual.getVerifierProvider();
      if (!provider) return null;
      return {
        ...provider,
        analyze: async (input: Parameters<typeof provider.analyze>[0]) => {
          aiInputs.push(input);
          if (providerHooks.beforeAnalyze) await providerHooks.beforeAnalyze(input);
          if (providerHooks.failAnalyze) throw new actual.VerifierError("Sağlayıcı isteği başarısız oldu.");
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

async function buildStudentPdf(
  options: { creator?: string; producer?: string; extraPages?: number } = {},
): Promise<Uint8Array> {
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
  for (let i = 0; i < (options.extraPages ?? 0); i++) doc.addPage([595, 842]);
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

// --- Kabul kriteri 3 (spec §12): belge baytları diskte ya da veritabanında kalmaz. ---

const PROJECT_ROOT = process.cwd();
const MAX_SCANNED_FILE_BYTES = 64 * 1024 * 1024;
// Proje kökünde taranmayan klasörler: bağımlılıklar, git ve OCR dil verisi önbelleği.
const SKIPPED_DIRS = new Set(
  ["node_modules", ".git", ".next", path.join("storage", "tessdata")].map((dir) => path.join(PROJECT_ROOT, dir)),
);

type Snapshot = Map<string, { size: number; mtimeMs: number }>;

/** Dosyaların boyut ve değişiklik zamanını toplar. Okunamayan girdiler (kilitli, silinmiş) atlanır. */
function collectFiles(dir: string, depth: number, into: Snapshot, skip: (dir: string) => boolean): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        if (depth > 0 && !skip(full)) collectFiles(full, depth - 1, into, skip);
      } else if (entry.isFile()) {
        const stat = statSync(full);
        into.set(full, { size: stat.size, mtimeMs: stat.mtimeMs });
      }
    } catch {
      // Eşzamanlı silinen ya da erişilemeyen dosya.
    }
  }
}

interface FsSnapshot {
  project: Snapshot;
  tmpTop: Snapshot;
  tmpDirs: Set<string>;
}

function takeSnapshot(): FsSnapshot {
  const project: Snapshot = new Map();
  // Proje kökü (storage/ ve prisma/ dahil) özyinelemeli; bağımlılıklar ve dil verisi hariç.
  collectFiles(PROJECT_ROOT, 12, project, (dir) => SKIPPED_DIRS.has(dir));
  // Geçici klasörün yalnız üst düzeyi: binlerce girdi olabilir. Yeni alt klasörler sonra taranır.
  const tmpTop: Snapshot = new Map();
  collectFiles(os.tmpdir(), 0, tmpTop, () => true);
  const tmpDirs = new Set<string>();
  try {
    for (const entry of readdirSync(os.tmpdir(), { withFileTypes: true })) {
      if (entry.isDirectory()) tmpDirs.add(path.join(os.tmpdir(), entry.name));
    }
  } catch {
    // Geçici klasör okunamıyorsa yalnız proje taranır.
  }
  return { project, tmpTop, tmpDirs };
}

/** Belgenin ortasından alınan 64 baytlık pencere; ham, base64 ve hex biçimleriyle. */
function documentNeedles(original: Buffer): Buffer[] {
  const window = (text: string, half: number) => {
    const mid = Math.floor(text.length / 2);
    return text.slice(mid - half, mid + half);
  };
  const mid = Math.floor(original.length / 2);
  const hex = window(original.toString("hex"), 64);
  return [
    Buffer.from(original.subarray(mid - 32, mid + 32)),
    Buffer.from(window(original.toString("base64"), 32)),
    Buffer.from(hex),
    Buffer.from(hex.toUpperCase()),
  ];
}

function containsAny(contents: Buffer, needles: Buffer[]): boolean {
  return needles.some((needle) => contents.includes(needle));
}

function dbFilePaths(): string[] {
  return ["test.db", "test.db-journal", "test.db-wal"]
    .map((name) => path.resolve(PROJECT_ROOT, "prisma", name))
    .filter((file) => existsSync(file));
}

/** Yeni ya da değişmiş her dosyada ve SQLite dosyalarında belge penceresi aranır. */
function assertDocumentNotPersisted(original: Buffer, before: FsSnapshot): void {
  const needles = documentNeedles(original);
  // Dedektörün kendisi: aynı baytların her biçimi yakalanmalı (test boşa geçmesin).
  expect(containsAny(original, needles)).toBe(true);
  expect(containsAny(Buffer.from(original.toString("base64")), needles)).toBe(true);
  expect(containsAny(Buffer.from(original.toString("hex")), needles)).toBe(true);

  const after = takeSnapshot();
  const changed = new Set<string>(dbFilePaths());
  const consider = (snapshotBefore: Snapshot, snapshotAfter: Snapshot) => {
    for (const [file, stamp] of snapshotAfter) {
      const old = snapshotBefore.get(file);
      if (!old || old.size !== stamp.size || old.mtimeMs !== stamp.mtimeMs) changed.add(file);
    }
  };
  consider(before.project, after.project);
  consider(before.tmpTop, after.tmpTop);
  // Çağrı sırasında geçici klasörde açılan yeni alt klasörler de taranır.
  for (const dir of after.tmpDirs) {
    if (before.tmpDirs.has(dir)) continue;
    const inner: Snapshot = new Map();
    collectFiles(dir, 3, inner, () => false);
    for (const file of inner.keys()) changed.add(file);
  }

  for (const file of changed) {
    let contents: Buffer;
    try {
      if (statSync(file).size > MAX_SCANNED_FILE_BYTES) continue;
      contents = readFileSync(file);
    } catch {
      continue;
    }
    expect(containsAny(contents, needles), `${file} belge baytlarını içermemeli`).toBe(false);
  }
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
    aiInputs.length = 0;
    providerHooks.beforeAnalyze = null;
    providerHooks.failAnalyze = false;
    vi.mocked(extractFromPdf).mockClear();
    vi.mocked(extractFromImage).mockClear();
  });

  afterEach(() => {
    providerHooks.beforeAnalyze = null;
    providerHooks.failAnalyze = false;
  });

  it("rıza varsa onaylar, profili yazar ve kişisel veriyi veritabanına bırakmaz", async () => {
    const user = await unverifiedUser({ city: "Ankara", skillsJson: JSON.stringify(["React"]) });
    await recordConsent(user.id, "CROSS_BORDER_AI", true);

    const bytes = await buildStudentPdf();
    const original = Buffer.from(bytes);
    const before = takeSnapshot();

    const outcome = await verifyDocument({ userId: user.id, bytes });
    expect(outcome.status).toBe("APPROVED");
    expect(bytes.every((byte) => byte === 0)).toBe(true);
    expect(outcome.consumedAttempt).toBe(true);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("VERIFIED");
    expect(refreshed.university).toBe("ORTA DOGU TEKNIK UNIVERSITESI");
    expect(refreshed.department).toBe("BILGISAYAR MUHENDISLIGI");
    expect(refreshed.disciplineGroup).toBe("yazilim");

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("APPROVED");
    expect(attempt.maskedText).toBeNull();

    // Otomatik onay arama metnini ayarlar kaydıyla aynı alanlarla (şehir dahil) yeniden kurar.
    expect(refreshed.searchText).toContain("ankara");
    expect(refreshed.searchText).toContain("react");
    expect(refreshed.searchText).toContain("orta dogu teknik universitesi");

    // Kabul kriteri 3: belge dosyası veritabanında ya da diskte bulunmaz.
    const dbFiles = dbFilePaths();
    expect(dbFiles.length).toBeGreaterThan(0);
    for (const file of dbFiles) {
      const contents = readFileSync(file);
      expect(contents.includes(Buffer.from(TCKN)), `${path.basename(file)} TCKN içermemeli`).toBe(false);
      expect(
        contents.includes(Buffer.from(PDF_MARKER)),
        `${path.basename(file)} işaretçi içermemeli`,
      ).toBe(false);
    }
    assertDocumentNotPersisted(original, before);
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

  it("rıza yokken (manuel inceleme) de belge baytları diskte ya da veritabanında kalmaz", async () => {
    const user = await unverifiedUser();
    const bytes = await buildStudentPdf();
    const original = Buffer.from(bytes);
    const before = takeSnapshot();

    const outcome = await verifyDocument({ userId: user.id, bytes });
    expect(outcome.status).toBe("MANUAL_REVIEW");

    assertDocumentNotPersisted(original, before);
  });

  it("aynı belge iki hesapta eşzamanlı yüklenirse yalnızca biri onaylanır", async () => {
    const pdfBytes = await buildStudentPdf();
    const first = await unverifiedUser();
    const second = await unverifiedUser();
    await recordConsent(first.id, "CROSS_BORDER_AI", true);
    await recordConsent(second.id, "CROSS_BORDER_AI", true);

    // İki istek de adım 4'teki ilk denetimi geçip analize gelmeden hiçbiri devam etmez:
    // yarış penceresi her çalıştırmada açık olur.
    let arrived = 0;
    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    providerHooks.beforeAnalyze = async () => {
      arrived += 1;
      if (arrived === 2) openGate();
      await gate;
    };

    const outcomes = await Promise.all([
      verifyDocument({ userId: first.id, bytes: pdfBytes.slice() }),
      verifyDocument({ userId: second.id, bytes: pdfBytes.slice() }),
    ]);

    expect(arrived).toBe(2);
    const statuses = outcomes.map((o) => o.status).sort();
    expect(statuses).toEqual(["APPROVED", "REJECTED"]);
    const rejected = outcomes.find((o) => o.status === "REJECTED");
    expect(rejected?.message).toBe(REASON_REUSED);
    expect(rejected?.consumedAttempt).toBe(true);

    const users = await db.user.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { verificationStatus: true, university: true },
    });
    const verified = users.filter((u) => u.verificationStatus === "VERIFIED");
    const rejectedUsers = users.filter((u) => u.verificationStatus === "REJECTED");
    expect(verified).toHaveLength(1);
    expect(rejectedUsers).toHaveLength(1);
    // Reddedilen hesaba profil yazılmaz.
    expect(rejectedUsers[0].university).toBeNull();

    const attempts = await db.verificationAttempt.findMany({ where: { userId: { in: [first.id, second.id] } } });
    expect(attempts.map((a) => a.status).sort()).toEqual(["APPROVED", "REJECTED"]);
    const rejectedAttempt = attempts.find((a) => a.status === "REJECTED");
    expect(rejectedAttempt?.rejectReason).toBe(REASON_REUSED);
    expect(rejectedAttempt?.maskedText).toBeNull();

    const notifications = await db.notification.findMany({
      where: { userId: { in: [first.id, second.id] }, type: "VERIFICATION_RESULT" },
    });
    expect(notifications.map((n) => JSON.parse(n.dataJson).status).sort()).toEqual(["APPROVED", "REJECTED"]);
  });

  it("analiz sürerken doğrulanan kullanıcı sonradan gelen retle düşürülmez, deneme yine kaydedilir", async () => {
    // Ad uyuşmazlığı: bu yükleme PDF kaynağında REJECTED ile biter.
    const user = await unverifiedUser({ firstName: "Mehmet", lastName: "Demir" });
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    providerHooks.beforeAnalyze = async () => {
      // Aynı anda başka bir sekmedeki yükleme onaylanmış gibi.
      await db.user.update({ where: { id: user.id }, data: { verificationStatus: "VERIFIED", verifiedAt: new Date() } });
    };

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });

    expect(outcome.status).toBe("APPROVED");
    expect(outcome.message).toBe(MESSAGES.ALREADY_VERIFIED);
    expect(outcome.consumedAttempt).toBe(true);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("VERIFIED");

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("REJECTED");
    expect(attempt.rejectReason).toBe(REASON_NAME_MISMATCH);

    const notifications = await db.notification.count({ where: { userId: user.id, type: "VERIFICATION_RESULT" } });
    expect(notifications).toBe(0);
  });

  it("sonradan gelen ret bekleyen manuel incelemeyi ezmez", async () => {
    const user = await unverifiedUser({ firstName: "Mehmet", lastName: "Demir" });
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    providerHooks.beforeAnalyze = async () => {
      await db.user.update({ where: { id: user.id }, data: { verificationStatus: "MANUAL_REVIEW" } });
    };

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });

    expect(outcome.status).toBe("MANUAL_REVIEW");
    expect(outcome.message).toBe(REASON_REVIEW);
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("MANUAL_REVIEW");
    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("REJECTED");
    expect(await db.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  it("sağlayıcı hata verirse manuel incelemeye gider ve maskeli metni süreli saklar", async () => {
    const user = await unverifiedUser();
    await recordConsent(user.id, "CROSS_BORDER_AI", true);
    providerHooks.failAnalyze = true;

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });

    expect(aiInputs).toHaveLength(1);
    expect(outcome.status).toBe("MANUAL_REVIEW");
    expect(outcome.message).toBe(REASON_REVIEW);
    expect(outcome.consumedAttempt).toBe(true);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("MANUAL_REVIEW");
    expect(refreshed.university).toBeNull();

    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("MANUAL_REVIEW");
    expect(attempt.aiUsed).toBe(false);
    expect(attempt.maskedText).toContain("[TCKN]");
    expect(attempt.maskedText).not.toContain(TCKN);
    expect(attempt.maskedTextExpiresAt).not.toBeNull();
    expect(attempt.maskedTextExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("aynı kullanıcının eşzamanlı ikinci yüklemesi IN_PROGRESS ile reddedilir, kayıt eklenmez", async () => {
    const user = await unverifiedUser();
    const pdfBytes = await buildStudentPdf();
    const secondBytes = pdfBytes.slice();

    const [first, second] = await Promise.all([
      verifyDocument({ userId: user.id, bytes: pdfBytes.slice() }),
      verifyDocument({ userId: user.id, bytes: secondBytes }),
    ]);

    expect(first.status).toBe("MANUAL_REVIEW");
    expect(second).toMatchObject({ status: "ERROR", message: MESSAGES.IN_PROGRESS, consumedAttempt: false });
    expect(secondBytes.every((byte) => byte === 0)).toBe(true);
    expect(await db.verificationAttempt.count({ where: { userId: user.id } })).toBe(1);

    // İlk istek bittikten sonra kilit bırakılır.
    const third = await verifyDocument({ userId: user.id, bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03]) });
    expect(third.message).toBe(MESSAGES.UNSUPPORTED_TYPE);
  });

  it("24 saatte 20 okunamayan dosyadan sonra çıkarım yapmadan ERROR_LIMIT döner, kayıt eklemez", async () => {
    const user = await unverifiedUser();
    await db.verificationAttempt.createMany({
      data: Array.from({ length: MAX_ERROR_ATTEMPTS_PER_WINDOW }, () => ({
        userId: user.id,
        status: "ERROR",
        source: "OCR",
        docHash: "h",
        nameMatch: false,
        rejectReason: "test",
      })),
    });

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });

    expect(outcome).toMatchObject({ status: "ERROR", message: MESSAGES.ERROR_LIMIT, consumedAttempt: false });
    expect(extractFromPdf).not.toHaveBeenCalled();
    expect(extractFromImage).not.toHaveBeenCalled();
    expect(await db.verificationAttempt.count({ where: { userId: user.id } })).toBe(MAX_ERROR_ATTEMPTS_PER_WINDOW);
  });

  it("24 saatten eski ERROR kayıtları ve sınırın altı yüklemeyi durdurmaz", async () => {
    const user = await unverifiedUser();
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.verificationAttempt.createMany({
      data: [
        ...Array.from({ length: MAX_ERROR_ATTEMPTS_PER_WINDOW }, () => ({
          userId: user.id,
          status: "ERROR",
          source: "OCR",
          docHash: "eski",
          nameMatch: false,
          createdAt: old,
        })),
        ...Array.from({ length: MAX_ERROR_ATTEMPTS_PER_WINDOW - 1 }, () => ({
          userId: user.id,
          status: "ERROR",
          source: "OCR",
          docHash: "yeni",
          nameMatch: false,
        })),
      ],
    });

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf() });
    expect(outcome.status).toBe("MANUAL_REVIEW");
  });

  it("5 sayfadan uzun PDF'i ERROR ile reddeder ve deneme hakkı yemez", async () => {
    const user = await unverifiedUser();

    const outcome = await verifyDocument({ userId: user.id, bytes: await buildStudentPdf({ extraPages: 5 }) });

    expect(outcome).toMatchObject({ status: "ERROR", message: MESSAGES.PDF_TOO_MANY_PAGES, consumedAttempt: false });
    const attempt = await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } });
    expect(attempt.status).toBe("ERROR");
    expect(attempt.rejectReason).toBe(MESSAGES.PDF_TOO_MANY_PAGES);
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.verificationStatus).toBe("UNVERIFIED");
  });

  it("çok büyük fotoğraf ve kullanılamayan OCR ayrı, eyleme dönük ERROR mesajlarına gider", async () => {
    const user = await unverifiedUser();
    const pngHeader = () => {
      const bytes = new Uint8Array(64);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      return bytes;
    };

    vi.mocked(extractFromImage).mockRejectedValueOnce(new DocumentTooLargeError("image-pixels"));
    const tooLarge = await verifyDocument({ userId: user.id, bytes: pngHeader() });
    expect(tooLarge).toMatchObject({ status: "ERROR", message: MESSAGES.IMAGE_TOO_LARGE, consumedAttempt: false });

    vi.mocked(extractFromImage).mockRejectedValueOnce(new OcrUnavailableError("OCR zaman aşımına uğradı."));
    const unavailable = await verifyDocument({ userId: user.id, bytes: pngHeader() });
    expect(unavailable).toMatchObject({ status: "ERROR", message: MESSAGES.OCR_UNAVAILABLE, consumedAttempt: false });

    vi.mocked(extractFromImage).mockRejectedValueOnce(new Error("bozuk görsel"));
    const unreadable = await verifyDocument({ userId: user.id, bytes: pngHeader() });
    expect(unreadable).toMatchObject({ status: "ERROR", message: MESSAGES.READ_FAILED, consumedAttempt: false });

    const reasons = (
      await db.verificationAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })
    ).map((a) => [a.status, a.source, a.rejectReason]);
    expect(reasons).toEqual([
      ["ERROR", "OCR", MESSAGES.IMAGE_TOO_LARGE],
      ["ERROR", "OCR", MESSAGES.OCR_UNAVAILABLE],
      ["ERROR", "OCR", MESSAGES.READ_FAILED],
    ]);
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
