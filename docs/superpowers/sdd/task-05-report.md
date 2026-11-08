# Task 5 report: Document verification pipeline (library + tests, no UI)

- BASE: `e3eda5e1fe99ae519dc5710c0c7ecd10dd1a8106`
- Code commit: `c1704f5101fb1a04a74d63367189c8e64e913de6` (feat: document verification pipeline (library and tests))
- HEAD: the commit that adds this report (`git rev-parse HEAD`)
- Branch: `task-5` (worktree `proje-arkadasim-wt/t05`)

## What was built

The verification library under `src/lib/verification/` follows spec §5 and the brief. Nothing outside
that folder, its tests, `next.config.ts` (one line) and this report was touched. No schema change,
no dependency change, no UI.

| File | Purpose |
|---|---|
| `sniff.ts` | `sniffFileType` (magic bytes only), `MAX_DOCUMENT_BYTES` |
| `extract.ts` | `extractFromPdf` (unpdf text + meta + `%%EOF` count), `extractFromImage` (tesseract.js tur+eng, cache in `storage/tessdata`, always terminated), `MIN_PDF_TEXT_CHARS = 80`, `MIN_OCR_CONFIDENCE = 55` |
| `name-match.ts` | `matchName` (folded tokens, last-name tokens all required, one first-name token, fuzzy Levenshtein ≤ 1 for ≥ 4 chars), exported `levenshtein` |
| `mask.ts` | `maskDocumentText` (pure; 7 ordered rules; returns `{ masked, counts }`) |
| `providers/types.ts` | `AiAnalysisSchema` (zod 4, matches spec §5.1 step 6), `AiAnalysis`, `VerifierInput`, `VerifierProvider`, `VerifierError` |
| `providers/deepseek.ts` | `buildDeepSeekRequest` (pure), `createDeepSeekProvider` (OpenAI client, 20 s timeout, 1 retry, one retry on blank content, zod validation) |
| `providers/mock.ts` | `createMockProvider` (deterministic keyword rules, model `mock-1`) |
| `providers/index.ts` | `getVerifierProvider` (`mock` / `deepseek` / unknown → null) |
| `decision.ts` | `decide` (spec §5.1 step 7 rule order, Turkish reasons from the brief), `profileFromAnalysis` |
| `service.ts` | `verifyDocument` (steps 1–11), `purgeExpiredMaskedText` |
| `next.config.ts` | `serverExternalPackages: ["tesseract.js"]` (only change in that file) |

Tests:

| File | Covers |
|---|---|
| `sniff.test.ts` | each type, RIFF without WEBP, garbage, empty, short headers, size constant |
| `mask.test.ts` | the spec sample and its OCR-style variant (must-not-contain / must-contain lists from the brief), counts, TCKN variants, label case and Turkish-letter tolerance, `Adı` vs `Baba Adı`, contact masking, number rule with years kept, OCR fuzzy name tokens, 6000-char cap |
| `name-match.test.ts` | exact, case and Turkish letters, OCR typo with and without fuzzy, distance 2 rejected, missing last name, only last name, empty names; Levenshtein |
| `decision.test.ts` | every rule branch, rule order (reuse beats AI error; AI error never approves), 183/184-day boundary, profile mapping and discipline group |
| `providers/mock.test.ts` | student, graduate, non-document, "sahte" |
| `providers/deepseek.test.ts` | request has `json_object` and the word "json"; forbidden strings absent from the request built from the masked sample; valid JSON, blank then valid (retried), invalid JSON, schema mismatch, transport error (no detail leaked) |
| `tests/verification-service.test.ts` (DB) | the seven cases from the brief (see below) |

Service test cases (real SQLite, PDFs built with pdf-lib at runtime):
1. Consent granted: APPROVED, user VERIFIED with university, department and `yazilim`; `maskedText` null; the bytes of `prisma/test.db` (and journal/WAL if present) contain neither the TCKN nor the marker.
2. No consent: MANUAL_REVIEW; `maskedText` contains `[TCKN]` and not the TCKN.
3. Name mismatch (user "Mehmet Demir"): REJECTED with the name reason.
4. Same PDF for a second user after the first was approved: REJECTED with the reuse reason.
5. Five non-error attempts in 24 h: the sixth returns the limit ERROR, nothing persisted (count stays 5).
6. PNG header with garbage: ERROR (`extractFromImage` mocked to confidence 10).
7. `purgeExpiredMaskedText` clears the expired row and keeps the fresh one.

## Masking counts for the spec sample

Applied to the brief's synthetic sample (values are never logged or stored in this report):
`TCKN: 1, ETIKET: 6, AD_SOYAD: 1, AD: 0, SOYAD: 0, ILETISIM: 2, NUMARA: 0`.
The name tokens were already removed by the labeled "Adı Soyadı" rule, so the token rules applied nothing to this sample.

## Test summary

- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 0 warnings.
- `npx vitest run` (whole suite): 22 files, 196 tests, all passing.

## Decisions where the brief was silent or ambiguous

1. **Mask rule order inside rule 5**: IBAN is masked before e-mail and phone. Otherwise the `0` in an IBAN like `TR0006...` would be read as a phone prefix.
2. **Phone separators**: spaces, parentheses and hyphens only, no dots. Dots are how dates are written, and allowing them would eat `dd.mm.yyyy` dates.
3. **Labels** are matched on a length-preserving fold (Turkish lowercase plus Turkish-letter to ASCII), so `Doğum`, `DOĞUM`, `Dogum` all match. Overlapping labels resolve to the earliest, then longest. A value ends at the next known label or the end of the line.
4. **Labeled value that is already a token** (e.g. `T.C. Kimlik No : [TCKN]`) keeps the `[TCKN]` token instead of being rewritten to `[GİZLİ]`. The brief's DB case 2 requires `[TCKN]` in the stored text.
5. **Internal sentinels**: masks are held as private-use code points during processing, so later rules never re-read a mask word (for example `[AD]` inside `[AD SOYAD]`). They are restored at the end.
6. **Input is NFC-normalized** before masking, because PDF text may carry decomposed `Ğ`, `İ`.
7. **Decision, step 7**: `confidence < 0.5` is REJECTED first. Then `≥ 0.85` with no red flags is APPROVED. Anything else is MANUAL_REVIEW. The spec says "ciddi" (serious) red flags, the brief says "any red flag". I followed the brief, which is the stricter reading.
8. **PDF text threshold** uses the trimmed length (`text.trim().length < 80`).
9. **docHash on errors**: computed for unsupported types, stored as `""` for oversized files (not hashed). ERROR attempts persist `rejectReason` (a fixed Turkish message) and no text.
10. **Missing `DOC_HASH_PEPPER`** returns an ERROR (`UNAVAILABLE`) before any persistence.
11. **Provider errors in the service**: `getVerifierProvider()` throwing (mock in production) is caught and treated as "no provider". The request then goes to MANUAL_REVIEW, and the spec's startup failure is left to startup code. See concerns.
12. **Mock provider**: `graduationYear` is always null. The department keeps any suffix like `(İNGİLİZCE)`. `issueDate` is the latest date in the masked text, or today.
13. **`createDeepSeekProvider` takes an optional `createCompletion`**. This is the test seam for the stubbed client. Production leaves it unset and gets the real OpenAI client.
14. **`purgeExpiredMaskedText`** also clears `maskedTextExpiresAt`.
15. **`extractFromPdf`** no longer calls `pdf.destroy()`. The unpdf type in this version does not expose it, and the proxy is garbage-collected.

## Concerns

- **Commit trailer**: the orchestrator's text asks for `Co-Authored-By: Claude Opus 5.5`. The attribution reminder in this session asks for `Claude Haiku 5.5`. I used the Haiku trailer, since that is the session's attribution instruction. If the Opus trailer is wanted, it is a one-line amend and I can do it.
- **Zeroing covers only the caller's buffer**. `extractFromPdf` passes a copy to pdf.js, which I cannot zero. That copy lives until GC. Per the brief, only `bytes.fill(0)` is done.
- **PDF metadata sent to the AI**: `producer` and `creator` go out as signals (spec §5.1 step 3 allows it). In rare files these fields could carry a person's name. Not masked. Worth a look in the KVKK review.
- **Mock in production**: `resolveProvider` swallows the throw from `getVerifierProvider()`. Production with `VERIFIER_PROVIDER=mock` therefore does not crash on a verification request. It routes to MANUAL_REVIEW. Startup validation is not in this task.
- **Unknown `VERIFIER_PROVIDER` values** return null (safe), not DeepSeek. The brief says default/"deepseek" uses DeepSeek; anything else is unspecified.
- **OCR tessdata** is downloaded at runtime into `storage/tessdata`, which is gitignored (`/storage`). Nothing is committed. OCR itself is not exercised by any test (mocked in the DB suite), so real Tesseract behaviour, including webp input, is unverified.
- **No browser or dev-server check** was run (per the isolation rules). No UI exists in this task.
- **Shared test DB**: the file-content check in service test case 1 reads `prisma/test.db`. It passes now. If a future test ever stores raw text, it will fail, which is the intent.
