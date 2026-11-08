# Task 5 — Document verification pipeline (library + tests, no UI)

Read `docs/superpowers/sdd/global-constraints.md` first. **Spec §5 is the authority for this task — read all of it**, plus §6 (KVKK). This is the most privacy-sensitive code in the project: correctness and tests matter more than speed.
Available: Prisma models `User`, `VerificationAttempt`, `Consent`; `db`, `foldTr`, `toSearchText`, `parseList`, `toListJson`, `hasActiveConsent`, `notify`, `disciplineGroupForDepartment`, `MASKED_TEXT_RETENTION_DAYS`, test helpers. Dependencies installed: `unpdf`, `tesseract.js`, `openai`, `pdf-lib` (dev), `zod`.

All files under `src/lib/verification/`.

## 1. `sniff.ts`
`sniffFileType(buf: Uint8Array): "pdf" | "jpeg" | "png" | "webp" | null` — magic bytes only: `%PDF-` at offset 0, JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF` at 0 and `WEBP` at 8. `MAX_DOCUMENT_BYTES = 10 * 1024 * 1024`.

## 2. `extract.ts`
- `extractFromPdf(buf: Uint8Array): Promise<{ text: string; signals: PdfSignals }>` using `unpdf` (`getDocumentProxy`, `extractText(pdf, { mergePages: true })`, `getMeta`). `PdfSignals = { producer: string | null; creator: string | null; createdAt: string | null; modifiedAt: string | null; incrementalUpdates: number; pageCount: number }` — `incrementalUpdates` = occurrences of `%%EOF` in the raw bytes minus 1 (min 0). Pass a **copy** of the bytes to pdf.js (it may detach the buffer).
- `extractFromImage(buf: Uint8Array): Promise<{ text: string; confidence: number }>` using `tesseract.js` `createWorker(["tur", "eng"], 1, { cachePath: <project>/storage/tessdata })` (create dir if missing), `recognize(Buffer.from(buf))`, always `terminate()` in finally. Confidence is 0–100 from `data.confidence`.
- `MIN_PDF_TEXT_CHARS = 80`, `MIN_OCR_CONFIDENCE = 55`.
- Add `serverExternalPackages: ["tesseract.js"]` to `next.config.ts` (only that change in that file).

## 3. `name-match.ts`
`matchName(text: string, firstName: string, lastName: string, opts: { fuzzy: boolean }): boolean` — tokens of `foldTr(text)`; every last-name token must be found, and at least one first-name token; with `fuzzy`, tokens of length ≥ 4 may match at Levenshtein distance ≤ 1 (implement `levenshtein(a,b)` here, exported).

## 4. `mask.ts`
`maskDocumentText(text: string, person: { firstName: string; lastName: string }): { masked: string; counts: Record<string, number> }` — pure function, applied in this order:
1. 11-digit numbers including variants split by spaces, dots or hyphens (e.g. `1000 0000 146`, `100-000-001-46`) → `[TCKN]` (mask all 11-digit sequences regardless of checksum).
2. Labeled values (label match is Turkish-case-insensitive and tolerant of missing Turkish letters, e.g. "Dogum Tarihi", "DOĞUM TARİHİ", "Doğum tarihi"): Baba Adı, Anne Adı, Ana Adı, Doğum Yeri, Doğum Tarihi, Doğum Yeri/Tarihi, Öğrenci No, Öğrenci Numarası, Uyruğu, Uyruk, Adres, Telefon, E-posta, Seri No, Barkod, Barkod No, Doğrulama Kodu, Belge Doğrulama Kodu, Kimlik No, T.C. Kimlik No → keep the label, replace the value (rest of the line, or up to the next known label on the same line) with `[GİZLİ]`.
3. "Adı Soyadı", "Ad Soyad", "Adı", "Soyadı" labeled values → `[AD SOYAD]`.
4. Remaining word tokens (`/\p{L}+/gu`) whose fold equals a first-name token → `[AD]`, last-name token → `[SOYAD]` (with Levenshtein ≤ 1 for tokens ≥ 4 chars to catch OCR noise).
5. E-mail addresses, Turkish phone numbers (`+90`, `0` prefixed 10–11 digits, with spaces/parentheses), IBAN `TR` + 24 digits (spaces allowed) → `[GİZLİ]`.
6. Remaining digit sequences of length ≥ 6 → `[NUMARA]`. Keep 4-digit years and dates `dd.mm.yyyy` / `dd/mm/yyyy` (dates were already removed where labeled as birth dates).
7. Normalise whitespace (keep line breaks), cap at 6000 chars.
`counts` tells how many of each mask kind were applied (for logs/tests, never the values).

## 5. Providers — `providers/`
- `types.ts`: `AiAnalysisSchema` (zod) exactly matching the JSON in spec §5.1 step 6 (enums as z.enum; `classYear`/`graduationYear` nullable ints; `issueDate` nullable `YYYY-MM-DD` string; `confidence` 0–1; `redFlags` string array max 10; `summary` max 400). `type AiAnalysis`. `type VerifierInput = { maskedText: string; signals: { source: "PDF_TEXT" | "OCR"; pdf?: PdfSignals; ocrConfidence?: number }; today: string }`. `interface VerifierProvider { name: string; model: string; analyze(input: VerifierInput): Promise<AiAnalysis> }`.
- `deepseek.ts`:
  - `buildDeepSeekRequest(input: VerifierInput, model: string)` — pure; returns the params object for `chat.completions.create`: `model`, `temperature: 0`, `max_tokens: 800`, `response_format: { type: "json_object" }`, messages: a Turkish system prompt (role: verification assistant for Turkish higher-education documents; text is masked — never guess masked fields; decide if it is a student certificate / graduate certificate / diploma of a Turkish higher-education institution; list red flags such as inconsistent dates, non-existent institution/department, content not matching the document type, editing traces in PDF signals (producer mismatch, incremental updates); answer **only json** using the example schema, which you include in the prompt), and one user message containing `JSON.stringify({ belgeMetni: input.maskedText, sinyaller: input.signals, bugun: input.today })`. If `process.env.DEEPSEEK_THINKING` is "enabled" or "disabled", add `thinking: { type: value }`.
  - `createDeepSeekProvider({ apiKey, model, baseURL })` — `new OpenAI({ apiKey, baseURL, timeout: 20_000, maxRetries: 1 })`; `analyze` calls create, takes `choices[0].message.content`; if blank/whitespace, retry once; parse JSON; validate with `AiAnalysisSchema`; throw `VerifierError` on failure.
- `mock.ts`: `createMockProvider()` — deterministic, based on `foldTr(maskedText)`: "ogrenci belgesi" → OGRENCI_BELGESI/STUDENT; "mezun belgesi" or "mezuniyet" → MEZUN_BELGESI/GRADUATE; "diploma" → DIPLOMA/GRADUATE; otherwise DIGER, isEducationDocument false. institution = value after ":" on the first line containing "universite" (original casing), faculty from a line containing "fakulte", department from a line containing "program" or "bolum"; degreeLevel LISANS if "lisans" present (YUKSEK_LISANS if "yuksek lisans", DOKTORA if "doktora", ONLISANS if "on lisans"), classYear from "sinif : N"; issueDate = latest date found (dd.mm.yyyy → ISO) else today; isTurkishHigherEducation = text contains "universitesi" or "yuksekogretim"; confidence 0.92 when type and institution found else 0.4; if text contains "sahte": confidence 0.3 and redFlags ["Test belgesi sahte olarak işaretlenmiş"]. model "mock-1".
- `index.ts`: `getVerifierProvider(): VerifierProvider | null` — `VERIFIER_PROVIDER` "mock" → mock (throw Error if `NODE_ENV === "production"`); default/"deepseek" → DeepSeek when `DEEPSEEK_API_KEY` is set, else `null`.

## 6. `decision.ts`
`decide(input: { analysis: AiAnalysis | null; aiError: boolean; nameMatch: boolean; source: "PDF_TEXT" | "OCR"; docHashUsedByOtherVerifiedUser: boolean; today: Date }): { status: "APPROVED" | "REJECTED" | "MANUAL_REVIEW"; reason: string | null }` — implement spec §5.1 step 7 rules **in that order**, with these user-facing Turkish reasons:
- reuse → "Bu belge başka bir hesabın doğrulamasında kullanılmış."
- AI unavailable / no consent / invalid → MANUAL_REVIEW, reason "Belgen ekibimiz tarafından incelenecek. Sonucu en geç 24 saat içinde bildireceğiz."
- not an education document → "Yüklediğin dosya öğrenci belgesi veya mezun belgesi gibi görünmüyor. e-Devlet'ten aldığın belgeyi yükle."
- name mismatch (PDF) → "Belgedeki ad ve soyad hesabındaki adla eşleşmedi. Adını belgendeki gibi düzeltip tekrar dene."; (OCR) → MANUAL_REVIEW with the 24-hour reason.
- foreign institution → MANUAL_REVIEW, 24-hour reason.
- student certificate older than 183 days → "Öğrenci belgen 6 aydan eski. e-Devlet'ten güncel tarihli bir belge al ve tekrar yükle."; missing issue date on a student certificate → MANUAL_REVIEW.
- confidence ≥ 0.85 and no red flags → APPROVED (reason null); 0.5–0.85 or any red flag → MANUAL_REVIEW; < 0.5 → "Belgen doğrulanamadı. Daha net bir kopya veya e-Devlet PDF'i yükle."
Also export `profileFromAnalysis(analysis)` → `{ university, faculty, department, academicStatus ("GRADUATE" for MEZUN_BELGESI/DIPLOMA, else from analysis), degreeLevel (null if UNKNOWN), classYear, graduationYear, disciplineGroup: disciplineGroupForDepartment(department) }`.

## 7. `service.ts`
`verifyDocument(params: { userId: string; bytes: Uint8Array }): Promise<VerificationOutcome>` where
`VerificationOutcome = { status: "APPROVED" | "REJECTED" | "MANUAL_REVIEW" | "ERROR"; message: string; consumedAttempt: boolean; processingMs: number }`. Steps (spec §5.1):
1. Load user; if VERIFIED → `{ status: "APPROVED", message: "Belgen zaten doğrulanmış.", consumedAttempt: false }`.
2. Attempt limit: ≥ 5 attempts with status ≠ "ERROR" in the last 24 h → ERROR "24 saat içinde en fazla 5 belge yükleyebilirsin. Daha sonra tekrar dene." (not persisted).
3. Size and `sniffFileType` → unsupported → ERROR "Yalnızca PDF, JPEG, PNG veya WebP yükleyebilirsin." / too big → ERROR "Dosya 10 MB'tan büyük olamaz."
4. `docHash` = HMAC-SHA256(`DOC_HASH_PEPPER`, bytes) hex. Reused by another user whose verificationStatus is VERIFIED and who has an APPROVED attempt with that hash → decision handles it.
5. Extract. PDF text < MIN_PDF_TEXT_CHARS → ERROR "Bu PDF'te okunabilir metin yok (taranmış olabilir). Belgenin fotoğrafını veya e-Devlet PDF'ini yükle." OCR confidence < MIN → ERROR "Fotoğraf okunamadı. Belgeyi düz bir zeminde, iyi ışıkta ve tamamı görünecek şekilde tekrar çek."
6. `nameMatch` (fuzzy only for OCR), `maskDocumentText`.
7. If `hasActiveConsent(userId, "CROSS_BORDER_AI")` and a provider exists → `analyze` (catch errors → aiError true). Else analysis null.
8. `decide(...)`.
9. Persist `VerificationAttempt` (status, source, docHash, nameMatch, documentType, aiUsed, aiModel, aiConfidence, aiSummary, redFlagsJson, extractedJson = profileFromAnalysis(...) or {}, maskedText + maskedTextExpiresAt = now + MASKED_TEXT_RETENTION_DAYS **only for MANUAL_REVIEW**, rejectReason, processingMs). ERROR outcomes from steps 3/5 are persisted with status "ERROR", no docHash content beyond the hash, no text.
10. Update user: APPROVED → VERIFIED + profile fields + `verifiedAt` + refreshed `searchText` (`toSearchText(firstName, lastName, username, university, faculty, department, parseList(skillsJson), parseList(interestsJson))`); MANUAL_REVIEW → "MANUAL_REVIEW"; REJECTED → "REJECTED".
11. `notify({ userId, type: "VERIFICATION_RESULT", data: { status } })` for APPROVED/REJECTED/MANUAL_REVIEW.
12. In `finally`: `bytes.fill(0)` and drop references. Never `console.log` text, masked text or bytes.
- Also export `purgeExpiredMaskedText(now = new Date()): Promise<number>` (sets maskedText null where expired) and `decideManualReview(...)` is NOT here (task 6 does admin decisions).

## Tests (Vitest)
- `sniff.test.ts`: each type + garbage + empty.
- `mask.test.ts` — use this synthetic e-Devlet-like text (fake data; TCKN 10000000146 passes the checksum):
  ```
  T.C.
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
  Belge Tarihi : 01.11.2026
  ```
  Person: firstName "Ayşe Nur", lastName "Kılıç". Masked output must NOT contain: 10000000146, AYŞE, NUR, KILIÇ, MEHMET, KONYA, 01.02.2003, 2345678, ABC1-DEF2-GHI3, YOK-2026-ABCDEF12345, ogrenci@example.com, 532. It MUST contain: ORTA DOĞU TEKNİK ÜNİVERSİTESİ, BİLGİSAYAR MÜHENDİSLİĞİ, LİSANS, Sınıf : 3, 15.09.2021, 01.11.2026, AKTİF ÖĞRENCİ, 5070, ÖĞRENCİ BELGESİ. Also an OCR-style variant without Turkish letters and with a spaced TCKN ("TC Kimlik No: 1000 0000 146", "Adi Soyadi: AYSE NUR KlLIC") — same guarantees.
- `name-match.test.ts`: exact, case/Turkish-letter differences, OCR typo with fuzzy, missing last name false, only last name false.
- `decision.test.ts`: one test per rule branch and the rule order (e.g. reuse beats everything; AI error never approves).
- `deepseek.test.ts`: `buildDeepSeekRequest` output contains `response_format` json_object and the word "json", and `JSON.stringify(params)` contains none of the forbidden strings when built from the masked sample; `analyze` with a stubbed OpenAI client (inject a fake `create`) handles: valid JSON → parsed; blank content then valid → retried; invalid JSON → VerifierError; schema mismatch → VerifierError.
- `mock.test.ts`: student, graduate, non-document, "sahte".
- `tests/verification-service.test.ts` (DB): build PDFs at runtime with `pdf-lib` (StandardFonts.Helvetica; use ASCII-only text because WinAnsi lacks ı/ş/ğ — e.g. "OGRENCI BELGESI", "ORTA DOGU TEKNIK UNIVERSITESI", "Adi Soyadi : AYSE NUR KILIC", TCKN 10000000146, a marker "XQZMARKER123", today-ish "Belge Tarihi : <today dd.mm.yyyy>"). Set `VERIFIER_PROVIDER=mock`, `DOC_HASH_PEPPER=test`. Cases:
  1. consent granted → APPROVED, user VERIFIED with university/department/disciplineGroup "yazilim"; attempt.maskedText null; then read the bytes of `test.db` (and `test.db-journal`/`-wal` if present) and assert they contain neither "10000000146" nor "XQZMARKER123".
  2. no consent → MANUAL_REVIEW; attempt.maskedText contains "[TCKN]" and not "10000000146".
  3. name mismatch (user registered as "Mehmet Demir") → REJECTED with the name reason.
  4. same PDF for a second user after the first was approved → REJECTED reuse.
  5. 5 non-error attempts in 24 h → 6th returns the limit ERROR.
  6. PNG of random bytes with valid PNG header but garbage → ERROR (mock `extractFromImage` via `vi.mock` to return confidence 10 to keep the test fast).
  7. `purgeExpiredMaskedText` clears an expired row and keeps a fresh one.

## Done when
All tests pass (`npx vitest run`), tsc + lint pass, committed, report written (include the masking counts from the sample in the report, never values).
