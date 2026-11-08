# Final fix wave — packet "verification-pipeline"

Scope: commit integrity, extraction bounds, provider and startup checks.
Branch `task-21` (worktree `proje-arkadasim-wt/t21`).

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- HEAD: the commit that adds this report (the last code commit is `1ab6952`)

Status: all 12 items fixed. No existing file outside the packet was edited. New files: `src/instrumentation.ts`,
`src/lib/startup-check.ts` (+ test), `src/lib/verification/image-size.ts` (+ test),
`src/lib/verification/extract.test.ts`, `src/lib/verification/providers/index.test.ts`.
No schema change, no dependency change.

## Items

### R4 — Mock provider in production fails at startup (also M11)
- `src/lib/startup-check.ts`: pure `productionConfigProblem(env)`. It returns a Turkish + English message when
  `NODE_ENV === "production"` and `VERIFIER_PROVIDER`, trimmed and lowercased, is `mock`. Otherwise it returns null.
- `src/instrumentation.ts`: `register()` returns early outside `NEXT_RUNTIME === "nodejs"` and throws the message
  when there is a problem. Next propagates the error from `prepare()`, so `next start` fails. Next itself skips
  `register()` during `next build` (`NEXT_PHASE === "phase-production-build"` in
  `instrumentation-globals.external.js`), so a local `.env` with `mock` cannot break the build.
- The service keeps `resolveProvider()` → MANUAL_REVIEW as the second line of defence (comment updated).
- Tests: `src/lib/startup-check.test.ts` covers mock + production, mock + development/test/unset, deepseek, empty or
  unset provider in production, casing and whitespace variants, and `register()` in the nodejs and edge runtimes.

### F1a — Document reuse re-checked at commit time
- `service.ts`: steps 9–10 now run in an interactive `db.$transaction(async (tx) => …)`. For an APPROVED decision
  the reuse query (same docHash, APPROVED, other user, user VERIFIED) runs again on `tx`. If it finds a row, the
  decision becomes `{ status: "REJECTED", reason: REASON_REUSED }`. In that case no profile is written, the user
  becomes REJECTED, and the notification and outcome carry the downgraded result.
- The commit section is also serialised per docHash with a module-level promise-chain lock
  (`withDocHashLock`, a `Map<string, Promise<void>>`), because SQLite may let two deferred transactions both read
  before either writes. The reuse query is shared (`isReusedByOtherVerifiedUser`) by step 4 and the commit.
- Test: two users upload the same bytes at the same time (`Promise.all`, mock approves). A barrier inside
  `analyze()` makes both requests pass step 4 before either commits, so the race window opens on every run. The
  test asserts exactly one APPROVED and one REJECTED/REASON_REUSED (outcomes, attempts and user statuses), no
  profile on the rejected account, and one notification per user with the right status. A mutation check
  (re-check disabled) makes this test fail.

### F15 — Final status write is guarded
- In the same transaction the attempt row is always created. The user is written with
  `tx.user.updateMany({ where: { id, verificationStatus: { notIn: guard } } })`, where `guard` is `["VERIFIED"]`
  for APPROVED/MANUAL_REVIEW and `["VERIFIED", "MANUAL_REVIEW"]` for REJECTED.
- When `count` is 0, no VERIFICATION_RESULT notification is sent. If the user is VERIFIED, the outcome is
  `APPROVED` + `MESSAGES.ALREADY_VERIFIED`. Otherwise (a pending manual review) it is `MANUAL_REVIEW` +
  `REASON_REVIEW`. `consumedAttempt` is true in both cases, because a non-ERROR attempt row was stored.
- Tests: (1) `analyze()` sets the user VERIFIED, and the upload then ends REJECTED (name mismatch). The user
  stays VERIFIED, the attempt is stored as REJECTED and no notification is sent. (2) Same flow with MANUAL_REVIEW
  set during analysis: the user stays MANUAL_REVIEW. A mutation check (empty guard) makes both tests fail.

### F3 — Per-user in-flight guard and ERROR cap (also M12, M13)
- Module-level `inFlight: Set<string>`. The check and insert happen before the first `await`. A second
  concurrent call for the same user returns ERROR + `MESSAGES.IN_PROGRESS` ("Önceki belgen hâlâ işleniyor. Sonucu
  bekle."), `consumedAttempt: false`, and records no row. The second request's bytes are still zeroed. The entry
  is removed in `finally`, together with `bytes.fill(0)`. This also closes M13's count-then-create race within
  the single Node process.
- Step 2b counts ERROR rows in the same 24 h window. At `MAX_ERROR_ATTEMPTS_PER_WINDOW = 20` (exported) the call
  returns ERROR + `MESSAGES.ERROR_LIMIT` ("Çok fazla okunamayan dosya yükledin. 24 saat sonra tekrar dene.") with
  no extraction and no row. ERROR still does not consume the spec's 5 attempts.
- Tests: with 20 seeded ERROR rows → ERROR_LIMIT, `extractFromPdf`/`extractFromImage` spies not called, row count
  unchanged. With 20 old (25 h) rows plus 19 recent ones, the upload still proceeds. Two concurrent calls for the
  same user → the second gets IN_PROGRESS and only one row exists. After the first call finishes, the lock is
  released.

### F21 — Extraction bounds and buffer hygiene (also M10)
- `extract.ts / extractFromPdf`: after `getDocumentProxy`, `numPages > MAX_PDF_PAGES (5)` throws
  `DocumentTooLargeError("pdf-pages")` before any text is extracted. `finally` destroys the document and zeroes
  the copy only when `copy.byteLength > 0` (detached-buffer guard). The copy is zeroed even if
  `getDocumentProxy` throws.
- Correction to M10: at runtime this pdf.js has no `PDFDocumentProxy.destroy()`. The `destroy(): Promise<void>`
  declared in unpdf's `api.d.ts` belongs to `PDFDocumentLoadingTask`, and calling `pdf.destroy()` threw
  `TypeError`. The fix uses `pdf.loadingTask.destroy()`.
- `extractFromImage`: the new pure helper `readImageDimensions` (`image-size.ts`; PNG IHDR, JPEG SOFn with marker
  and fill-byte handling, WebP VP8/VP8L/VP8X) reads the size first. A side > 8000 px or an area > 40 MP throws
  `DocumentTooLargeError("image-pixels")` before tesseract starts. An unreadable header throws a plain error, which
  becomes READ_FAILED. The `Buffer` passed to `recognize()` is kept in a variable and zeroed in `finally`.
- `service.ts` maps the typed errors to ERROR rows with `MESSAGES.PDF_TOO_MANY_PAGES` ("PDF en fazla 5 sayfa
  olabilir. e-Devlet PDF'ini yükle.") and `MESSAGES.IMAGE_TOO_LARGE` ("Fotoğraf çok büyük. Daha küçük bir fotoğraf
  yükle.").
- Tests: `image-size.test.ts` covers every format, progressive JPEG, SOS before SOF, truncated and garbage input.
  `extract.test.ts` checks that a 5-page pdf-lib PDF passes, a 6-page one is rejected with the typed error, the
  caller's bytes are untouched, and oversize images are rejected before `createWorker`. The service test runs a
  6-page PDF end to end (ERROR row, no attempt consumed) and checks the IMAGE_TOO_LARGE, OCR_UNAVAILABLE and
  READ_FAILED mappings.

### F20a — Local tessdata, bounded worker lifetime
- Language directory: `process.env.TESSDATA_LANG_PATH || <cwd>/storage/tessdata` (`tessdataDir()`).
- Verified in `node_modules/tesseract.js/src/worker-script/index.js`: the worker first reads the cache
  `${cachePath}/${lang}.traineddata` (uncompressed). It then falls back to `${langPath}/${lang}.traineddata[.gz]`
  depending on `gzip`. For OEM 1 (LSTM only) without `langPath`, it downloads
  `https://cdn.jsdelivr.net/npm/@tesseract.js-data/<lang>/4.0.0_best_int/<lang>.traineddata.gz`.
- Before `createWorker`, `tur.traineddata` and `eng.traineddata` must exist in the directory. A missing file is
  downloaded once from that URL: fetch with a 15 s AbortController, gunzip (also accepts already-plain data),
  size-capped, written to a temp file and renamed into place. Concurrent requests share one download. On failure
  the error is `OcrUnavailableError` and no temp file is left behind. `Promise.allSettled` makes sure no download
  keeps running after the request ends.
- `createWorker(["tur","eng"], 1, { langPath: dir, cachePath: dir, gzip: false, errorHandler })`. The worker reads
  only the local files, in the same format as the existing tesseract cache, so existing `storage/tessdata` files
  are reused. Without `errorHandler`, tesseract.js rethrows a worker rejection inside its message listener, which
  is an uncaught exception that crashes the process. Now the handler is set: while no worker exists yet, it turns
  a load/initialise rejection into an immediate `OcrUnavailableError`, since `createWorker` itself never settles in
  that case. `createWorker + recognize` race a 45 s timeout (`OCR_TIMEOUT_MS`). The worker is terminated in
  `finally`, and a worker that resolves after the timeout is terminated when it arrives.
- `service.ts` maps `OcrUnavailableError` (missing data, download failure, load failure, timeout) to ERROR with
  `MESSAGES.OCR_UNAVAILABLE` ("Fotoğraf okuma şu an kullanılamıyor. e-Devlet PDF'ini yükle."), not READ_FAILED.
  Recognition errors on a bad image stay READ_FAILED.
- Tests (mocked `tesseract.js`, temp `TESSDATA_LANG_PATH`):
  - Options passed and the buffer zeroed.
  - With fake timers, a `createWorker` that never resolves rejects exactly at 45 s, not 1 ms earlier.
  - A late worker is terminated and never used.
  - A load error reported through `errorHandler` fails fast.
  - A recognition error is not turned into OCR_UNAVAILABLE.
  - A missing file is downloaded, gunzipped, written once and reused (URLs asserted, no temp files).
  - A 503 download and a hanging download (aborted at 15 s with fake timers) both raise `OcrUnavailableError`
    without spawning a worker.
- Manual probe (not committed, no network): I ran the real tesseract.js against a directory with bogus
  `tur/eng.traineddata`. The worker read the files from the configured directory, failed initialisation, deleted
  the corrupt files itself (so the next request downloads them again), and `extractFromImage` rejected with
  `OcrUnavailableError` in about 0.5 s instead of hanging.

### F24 — DeepSeek: one deadline, no SDK retry, real-client tests
- `clientCompletion` uses `maxRetries: 0` on the client and per request. `analyze()` sets
  `deadline = start + timeoutMs`. Each request gets the remaining time as `timeout` plus one shared `AbortSignal`.
  The call also races a deadline timer that aborts the signal, so the 20 s bound holds even if the SDK or the fetch
  ignores its own timeout (for example a stalled body). The empty-content retry is skipped when less than
  `MIN_RETRY_BUDGET_MS` (2 s) remains.
- New seams in `DeepSeekOptions`: `fetch?: typeof fetch` (passed to `new OpenAI({ fetch })`) and
  `timeoutMs?: number`. `CompletionFn` now receives `{ timeoutMs, signal }` as a second argument; existing
  one-argument fakes still type-check.
- Tests through the real OpenAI client with a fake fetch:
  - A valid reply is parsed. The URL is checked, and the body is masked (no TCKN, names and other forbidden values).
  - A fetch that never resolves but honours the signal → VerifierError in about 100 ms, fetch called once.
  - A fetch that ignores the signal → VerifierError at the deadline.
  - Empty content twice → VerifierError after two requests.
  - Invalid JSON → VerifierError.
  - An HTTP 500 is not retried by the SDK.

  Unit tests also check that the retry is skipped when the budget is too small and that each request gets the
  remaining time and the shared signal. A mutation check (`maxRetries: 1`) makes the 500 test fail.

### F23 — Acceptance criterion 3 really tested
- `tests/verification-service.test.ts` copies the raw PDF bytes before `verifyDocument` zeroes them (and asserts
  they were zeroed). It builds needles from 64-byte windows taken from the middle of the file: raw bytes, the
  middle of the full file's base64, and lower- and upper-case hex.
- Before and after the call it snapshots the project root recursively (including `storage/` and `prisma/`, but not
  `node_modules`, `.git`, `.next` or `storage/tessdata`) and the top level of `os.tmpdir()`. Temp subfolders
  created during the call are scanned in full. Every new or changed file, plus `prisma/test.db`, `-journal` and
  `-wal`, must contain none of the needles. A self-check proves the detector catches the raw, base64 and hex forms,
  so the test cannot pass vacuously.
- This runs for the auto-approved path and for the no-consent MANUAL_REVIEW path, where masked text is stored.
  The old TCKN and marker checks on the DB files are kept.

### M71a — searchText includes the city
- The step-1 select adds `city: true`. Auto-approval builds `toSearchText(first, last, username, university,
  faculty, department, skills, interests, city)`, in the same order as `settings/actions.ts`.
- Test: the approval test user has `city: "Ankara"` and skills `["React"]`. After auto-approval, `searchText`
  contains `ankara`, `react` and the university.

### F9c — Year ranges in profileFromAnalysis
- `classYear` is kept only when it is an integer in `1..CLASS_YEAR_MAX`. `graduationYear` is kept only when it is
  an integer in `GRADUATION_YEAR_MIN (1950)..currentYear + 1`. Both constants are imported from
  `src/lib/settings/limits.ts`, which was not edited. `profileFromAnalysis(analysis, now = new Date())` uses
  `getFullYear()` like the settings validation. The service passes its `now`.
- Tests in `decision.test.ts`: the boundaries 1 and 8; the values 0, -1, 9 and 12; 1950, 2023 and 2027 accepted;
  1949, 2028 and 0 rejected; nulls; other profile fields unaffected.

### F51 — Middleware matcher
- Matcher: `/((?!_next/static|_next/image|favicon.ico|icon.svg|api/avatar|api/verification).*)`. `src/app/icon.svg`
  is the only static icon file under `src/app`. Both API routes read the session themselves through
  `getCurrentUser`.
- `src/middleware.test.ts` compiles `config.matcher` with Next's own `getMiddlewareMatchers` (internal API, loaded
  with `createRequire`). It asserts that pages and other API routes match, and that `/api/verification`,
  `/api/avatar`, `/api/avatar/<file>`, `/_next/static/*`, `/_next/image`, `/favicon.ico` and `/icon.svg` do not.

### F57 — Provider gate tests
- `src/lib/verification/providers/index.test.ts` (`vi.stubEnv`) covers:
  - mock + production throws, including the ` MOCK ` variant.
  - mock + development returns the mock provider.
  - deepseek or empty without a key returns null.
  - With a key, a `deepseek` provider is returned with the default model or `DEEPSEEK_MODEL`.
  - Unknown values (`openai`, `mocks`, `moc`, `random`) return null, not the mock.
- Service test: the provider module mock's `analyze` throws `VerifierError`. The test asserts a MANUAL_REVIEW
  attempt with `aiUsed: false`, user status MANUAL_REVIEW, no profile, and `maskedText` kept (masked TCKN) with a
  future `maskedTextExpiresAt`.

## Items not fixed
None.

## Residual notes and concerns
- If tesseract.js fails while loading or initialising, `createWorker` never settles and does not expose the worker
  thread, so that one thread cannot be terminated. The request no longer hangs (errorHandler and the 45 s
  timeout). The trigger is much rarer now: local files are checked first, and tesseract deletes corrupt cache
  files, so the next request downloads them again. A worker that resolves late is terminated.
- The in-process locks (`inFlight`, `docHashLocks`) assume one Node process, as the brief states. A multi-instance
  deployment would need a DB-level guard, for example a unique constraint, which is a schema change and out of
  scope here.
- tesseract.js `loadImage` and pdf.js make internal copies of the bytes that we cannot zero. They live only until
  garbage collection.
- The 40 MP cap rejects full-resolution 48/50 MP phone photos; the message asks for a smaller photo. Phones save
  12 MP by default.
- `TESSDATA_LANG_PATH` is documented by packet auth-legal-docs (F20c). README and `.env.example` were not touched
  here.
- Real OCR with real traineddata was not run end to end: no network download in this session. The real worker's
  file loading and fast failure were checked with the manual probe above.
- The new middleware test depends on Next's internal `getMiddlewareMatchers`. If a Next upgrade moves it, the
  test fails visibly rather than silently.

## Checks
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass, no warnings.
- `npx vitest run`: 55 files, 535 tests passed (baseline at BASE: 51 files, 477 tests).

## Commits
- `ca680bf` fix: stop production startup when VERIFIER_PROVIDER=mock (R4, F57)
- `952a8b0` fix: bound PDF and image extraction, keep OCR language data local (F21, F20a, M10)
- `9cee87f` fix: make verification commit race-safe and cap unreadable uploads (F1a, F15, F3, F21/F20a mapping, M71a, F23, F57)
- `a2d73b4` fix: drop out-of-range class and graduation years from AI profile (F9c)
- `da15f04` fix: enforce one 20 s deadline for DeepSeek analysis (F24)
- `1ab6952` fix: keep session middleware off upload, avatar and icon routes (F51)
- docs commit adding this report
