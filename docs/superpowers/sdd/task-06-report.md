# Task 6 report: Verification UI, upload API, admin panel

- BASE: `84d853723513ee00b181f219c1e87fa2ba47b0ed` (`merge: task 5`)
- Code commit: `dfeff0765f4095292b1896a19616ea25d7ea375c` (feat: verification upload API, verification page and admin panel)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after the last commit)
- Branch: `task-6` (worktree `proje-arkadasim-wt/t06`)

## What was built

### Upload API
- `src/app/api/verification/route.ts`: `POST`, `runtime = "nodejs"`, `maxDuration = 60`, `dynamic = "force-dynamic"`.
  - `assertSameOrigin` first (a thrown `Response` is caught and returned as 403).
  - No user: 401 `{ error: "Önce giriş yapmalısın." }`.
  - `content-length` above `MAX_DOCUMENT_BYTES + 64 KB`: 413 before the body is read.
  - Missing or non-`File` `belge` field: 400 `{ error }`. Unreadable form body: 400.
  - File above 10 MB after parsing: 413.
  - Success: `{ status, message, consumedAttempt }` from `verifyDocument`.
  - Any thrown error: 500 `{ status: "ERROR", message: "Belge şu an işlenemedi. Birazdan tekrar dene.", consumedAttempt: false }`. The internal error text is not returned.
  - The file and its name are never logged.

### Verification page
- `src/app/(app)/dogrulama/page.tsx` (Server Component, `requireUser("/dogrulama")`). Loads the last decision (APPROVED, REJECTED or MANUAL_REVIEW), the number of non-ERROR attempts in the last 24 h, and whether `CROSS_BORDER_AI` consent is active.
  - `?hosgeldin=1` welcome card.
  - Status cards: UNVERIFIED (neutral), MANUAL_REVIEW/PENDING (warn-soft), REJECTED (danger-soft with the last reason and a "Yeni belge yükle" link to the uploader), VERIFIED (stamp-soft with `VerifiedStamp size="lg"`, education fields, "Ana sayfaya git" and "Bilgilerini düzenle" → `/ayarlar`).
  - Accepted-documents help box with the e-Devlet hint, privacy note and link to `/kvkk/aydinlatma`.
  - "Bugün <n> deneme hakkın kaldı." line.
  - Uploader and consent panel are shown only when the status is UNVERIFIED or REJECTED. The consent panel is shown only when consent is not active. When consent is active a note says so.

### Uploader (client)
- `src/components/verification/uploader.tsx`: large dashed drop/tap zone with a visually hidden `<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp">` (no `capture`). Drag and drop is also handled.
  - Two-line hint: "PDF, JPEG, PNG veya WebP" / "En fazla 10 MB".
  - Client pre-check (`precheckFile`) with the same messages as the server.
  - After selection: name, size, "Belgeyi gönder", "Değiştir".
  - Upload uses `fetch("/api/verification", { method: "POST", body: FormData })` with field `belge`.
  - Four-step list (Belge okunuyor → Kişisel veriler maskeleniyor → Yapay zeka inceliyor → Sonuç). Steps advance at 0.8 s and 1.6 s, then hold on step 3 until the response arrives.
  - APPROVED: stamp success card, `router.refresh()` after 1.2 s.
  - MANUAL_REVIEW: warn card with a "Durumu güncelle" button.
  - REJECTED or ERROR: danger card with "Tekrar dene".
  - The status region is `aria-live="polite"`.

### AI consent
- `src/components/verification/consent-panel.tsx` (client, `useActionState`): checkbox (required), link to `/kvkk/acik-riza`, "Rızamı kaydet".
- `src/lib/verification/actions.ts` (`'use server'`): `grantAiConsentAction(previous, formData)`. Requires the checkbox value, calls `recordConsent(..., "CROSS_BORDER_AI", true)` and revalidates `/dogrulama`.

### Admin
- `src/app/(app)/admin/layout.tsx`: `requireAdmin()` (404 for non-admins), then the tab bar.
- `src/components/admin/admin-tabs.tsx` (client): Genel bakış, Doğrulamalar, Şikayetler. See decision 1.
- `src/app/(app)/admin/page.tsx`: counts (users, verified, manual-review queue, open reports, open projects) and the masked-text purge button.
- `src/app/(app)/admin/dogrulamalar/page.tsx`: MANUAL_REVIEW attempts, oldest first, limit 50. Each item shows name, username, email, relative time, source, nameMatch, AI model, confidence, summary and red flags. A `<details>` shows the masked text in a `<pre>`. Each page view writes `VIEW_VERIFICATION_QUEUE` to `AdminAuditLog`.
  - `src/components/admin/review-form.tsx` (client): editable fields prefilled from `extractedJson` (university, faculty, department, status, degree level, class year, graduation year), "Onayla", and "Reddet" with a required reason (min 10 characters).
- `src/app/(app)/admin/sikayetler/page.tsx`: open reports (newest first, limit 100) and the last 20 resolved reports in a collapsed `<details>`. Targets: USER links to `/u/<username>`, PROJECT links to `/projeler/<id>`, MESSAGE shows a 200-character excerpt and the two participants' usernames. Deleted targets show a plain "silinmiş" note. Each page view writes `VIEW_REPORTS`.
  - `src/components/admin/resolve-report-button.tsx` (client): "Çözüldü olarak işaretle".
- `src/components/admin/purge-button.tsx` (client): calls `purgeMaskedTextAction` and shows the count.

### Admin actions
- `src/lib/admin/actions.ts` (`'use server'`). Each action checks `getCurrentUser()` and `isAdmin()` (role only). Non-admins get `{ ok: false, error: "Bu işlem için yönetici yetkin yok." }` and nothing changes.
  - `approveAttemptAction(attemptId, fields)`: zod validation (`EducationFieldsSchema`, not exported because a `'use server'` file may only export async functions). In one interactive transaction, the attempt moves from MANUAL_REVIEW to APPROVED only if it is still MANUAL_REVIEW (`updateMany` with a status guard). The user becomes VERIFIED with the fields, `disciplineGroup` from `disciplineGroupForDepartment`, `verifiedAt` and a refreshed `searchText`. The masked text is cleared. `APPROVE_VERIFICATION` is written to the audit log. Then `notify` sends `VERIFICATION_RESULT {status: "APPROVED"}`.
  - `rejectAttemptAction(attemptId, reason)`: reason 10 to 500 characters. Same status guard. The attempt becomes REJECTED with `rejectReason` and the masked text is cleared. The user becomes REJECTED. `REJECT_VERIFICATION` is written. Then `notify` sends `{status: "REJECTED"}`.
  - `resolveReportAction(reportId)`: status RESOLVED plus `RESOLVE_REPORT` in one transaction.
  - `purgeMaskedTextAction()`: calls the existing `purgeExpiredMaskedText` and writes `PURGE_MASKED_TEXT`. Returns `{ count }`.
  - All write paths revalidate the admin paths.

## Files

Added:
- `src/app/api/verification/route.ts`
- `src/app/(app)/admin/layout.tsx`
- `src/lib/verification/actions.ts`
- `src/lib/admin/actions.ts`
- `src/lib/admin/actions.test.ts`
- `src/components/verification/uploader.tsx`
- `src/components/verification/consent-panel.tsx`
- `src/components/admin/admin-tabs.tsx`
- `src/components/admin/review-form.tsx`
- `src/components/admin/purge-button.tsx`
- `src/components/admin/resolve-report-button.tsx`
- `tests/verification-route.test.ts`
- `docs/superpowers/sdd/task-06-report.md`

Replaced stubs:
- `src/app/(app)/dogrulama/page.tsx`
- `src/app/(app)/admin/page.tsx`
- `src/app/(app)/admin/dogrulamalar/page.tsx`
- `src/app/(app)/admin/sikayetler/page.tsx`

Not touched: `prisma/schema.prisma` (frozen), `package.json`, `src/lib/verification/service.ts`, `src/components/ui/tabs.tsx`, and everything outside the names in the brief.

## Decisions where the brief was silent or ambiguous

1. **Admin tabs are a custom link nav, not the `Tabs` component.** `Tabs` builds `basePath?sekme=<value>` links, but the admin sections are separate routes. The new `AdminTabs` (client, `usePathname`) has the same look (2 px pen underline, 44 px targets, focus ring). The shared `Tabs` component is unchanged.
2. **The consent text is written here, not copied from registration.** The registration page is still a stub in this worktree, so there was no text to match. Task 4 must use the same wording, or the two should move to one shared constant. The checkbox links to `/kvkk/acik-riza` as the brief asks.
3. **Privacy copy is corrected.** The brief's copy says the document "hiçbir yere kaydedilmez" (is saved nowhere). But masked text is stored for manual review for `MASKED_TEXT_RETENTION_DAYS` (30). The page says the document is kept in memory only while it is reviewed, and that only the masked text of manual-review cases is kept for up to 30 days. The retention number comes from `src/config/legal.ts`.
4. **Daily limit constant is duplicated.** `DAILY_ATTEMPT_LIMIT = 5` is defined in the verification page. `MAX_ATTEMPTS_PER_WINDOW` in `service.ts` is not exported, and I did not change the task 5 file. Exporting it would remove the duplicate.
5. **Status card for REJECTED uses the last non-ERROR decision.** ERROR attempts (too large, unsupported type, no text) do not change the user's status, so they are skipped when choosing the reason to show.
6. **Uploader is replaced by a notice when no attempts remain** (remaining = 0). The server would return the limit error anyway.
7. **PENDING is shown like MANUAL_REVIEW.** The service never writes PENDING, but the taxonomy has it.
8. **Approve and reject are guarded against double processing.** The attempt status is changed inside a transaction with `updateMany({ where: { status: "MANUAL_REVIEW" } })`. A second click gets "artık inceleme bekleyen durumda değil" and writes no second audit row.
9. **Admin reviewer may edit "Üniversite" and "Durum".** The brief's review form includes them. The spec's restriction (user cannot edit those two fields) applies to the user's own profile edit, not to the admin.
10. **Review queue limit is 50, oldest first.** No pagination in this task.
11. **Admin report page shows message content.** Reported message bodies are shown as a 200-character excerpt, with participants. Each page view is audited as `VIEW_REPORTS`. Reason values are shown as stored, because the spec does not list them.
12. **Route error shapes.** 401, 400 and 413 return `{ error }` as the brief says. Results and the 500 return `{ status, message, consumedAttempt }`. The client accepts either shape.
13. **Pre-check on size uses `content-length` only.** If a client omits `content-length`, the body is parsed before the 10 MB check (see concerns).
14. **Commit trailer.** The commits use `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, which is the session attribution reminder. The orchestrator's ruling asked for Opus 5.5. It is a one-line change if Opus is required. This is the same choice made in task 5.

## Test summary

- `npx tsc --noEmit`: clean.
- `npm run lint`: clean, no output.
- `npx vitest run` (whole suite): 28 files, 252 tests, all passing. New in this task: 16 tests.
  - `src/lib/admin/actions.test.ts` (10 tests, real SQLite): approve sets VERIFIED with fields, discipline group, cleared masked text, audit row and notification; a second approve is refused; invalid fields return field errors and change nothing; non-admin cannot approve and nothing changes; no session cannot approve; reject sets REJECTED with reason, user REJECTED, audit and notification; a short reason is refused; non-admin cannot reject; report resolve writes the audit row; purge clears expired masked text and returns the count.
  - `tests/verification-route.test.ts` (6 tests): cross-origin 403 (`verifyDocument` not called); no session 401; missing file 400; oversized `content-length` 413 with the body not read; valid PDF returns the outcome JSON with the user id passed through; unexpected error returns the generic 500 without leaking the internal message.
- Not run: `npm run dev`, `next build` and any browser check, per the isolation rules. The pages have not been seen rendered.

## Concerns

- **`content-length` is only a declared-size check.** A request without `content-length` (chunked transfer) is parsed by `req.formData()` before the 10 MB check. Next.js's default body limits apply, but this task does not add its own streaming cap. Worth a look in the final review.
- **Consent copy must match registration** (decision 2). The two texts are not shared yet.
- **Privacy wording** (decision 3) differs from the brief's copy on purpose. Confirm with the KVKK review.
- **Limit 5 is duplicated** (decision 4).
- **Admin queue and reports have no pagination.** Limits are 50 and 100 open items plus 20 resolved. Lists beyond that are cut off silently. A pagination task is needed once volume grows.
- **Tabs component not reused** (decision 1). Small visual duplication of the tab styles.
- **Admin reviewer edits to university and status** are allowed by the brief. The spec's restriction is on the user's own profile edit, so this is consistent, but the final review may want an audit diff.
- **Layout-level and page-level `requireAdmin` both run.** Harmless (one extra cookie read per request, cached by `getSessionUser`).
- **Visual check not done.** Phone width, focus rings and the uploader's drag state were not seen in a browser. The orchestrator's post-merge browser check should cover `/dogrulama` and `/admin/*` at 375 px.

## Fix round 1

- BASE (`git rev-parse HEAD` before the fix): `2fac49e1b2f6979ac93903234d801f1169049aee`
- Code commit: `c5ba594ac58629d284b599227fc598e24146cdf6` (fix: guard verification decisions, block Enter approval, split admin meta strings)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it)

### Findings fixed

1. **Approve and reject overwrote a user's status without a check (Important).** Fixed in `src/lib/admin/actions.ts`.
   - `approveAttemptAction`: the attempt update and the user update run in one transaction. The user update is now `updateMany` with `verificationStatus: "MANUAL_REVIEW"`. If the attempt or the user is no longer pending, the transaction is rolled back (internal `ClaimLost` error, never returned) and the action returns a Turkish error. A second approval of a stale attempt for an already verified user is refused and writes nothing.
   - `rejectAttemptAction`: the attempt update is guarded as before. The user update is conditional on `MANUAL_REVIEW`. A stale rejection of a user who is already VERIFIED records the attempt as REJECTED with its reason and the audit row, leaves the user VERIFIED, and sends no REJECTED notification.
   - Second upload: `src/app/api/verification/route.ts` returns 409 `{ status: "MANUAL_REVIEW", message, consumedAttempt: false }` when the current user is in `MANUAL_REVIEW`, before the body is read or `verifyDocument` runs. The uploader already renders any `status`/`message` body, so a MANUAL_REVIEW response shows the warn card. `src/lib/verification/service.ts` (task 5) is not changed. The reviewer suggested it could be changed there; the route was chosen to keep the task 5 file frozen.
   - Known limit: the route check is a read, so two requests that arrive at the same time can both pass it. The approve/reject guards still keep the decisions consistent.
2. **Enter submitted the review form and approved (Important).** Fixed in `src/components/admin/review-form.tsx`. "Onayla" is now `type="button"` with `onClick={approve}`. The form's `onSubmit` only calls `preventDefault()`, so Enter cannot approve. "Reddet" is unchanged.
3. **Dot-separated meta strings (Important).** Fixed in:
   - `src/app/(app)/admin/dogrulamalar/page.tsx`: username, email and time are three separate lines.
   - `src/app/(app)/admin/sikayetler/page.tsx`: the open-report bullet separator is replaced by two chips (type, time). The resolved-report line `{type} · {time}` is split into two lines.
   - A grep of the admin, verification and admin-action files finds no ` · ` or ` • ` left.

No finding was disputed. No spec gap was listed by the reviewer, so none was changed beyond the above.

### Tests added

- `src/lib/admin/actions.test.ts`, new describe "aynı kullanıcıya ait eski inceleme kayıtları": (a) rejecting an older pending attempt after a newer one was approved leaves the user VERIFIED with no REJECTED notification; (b) a second pending attempt cannot be approved for a verified user, and the attempt stays MANUAL_REVIEW.
- `tests/verification-route.test.ts`: a user in MANUAL_REVIEW gets 409 and `verifyDocument` is not called. The session mock type now carries an optional `verificationStatus`.

### Test results (worktree `t06`, after the fix)

- `npx tsc --noEmit`: exit 0, no output.
- `npm run lint`: exit 0, no output.
- `npx vitest run` (whole suite): 28 files, 255 tests, all passing. Before the fix it was 252 tests; the 3 new tests are the two admin tests and the route test.
- The `test.db` database reported "already in sync with the Prisma schema". No `prisma` command was run. `prisma/schema.prisma` is unchanged.

### Concerns and decisions

- **Attribution.** The commit uses `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, not the Opus 5.5 trailer from the orchestrator ruling. The session's attribution reminder says Haiku 5.5 for commits from here on. This is the same choice as task 5. If Opus is required, amend the trailer with a one-line change.
- **Route check is not atomic** (see fix 1). A strict guarantee would need a check inside `verifyDocument` or a unique constraint, both outside this task's files.
- **Reject for an already verified user** sends no notification and leaves the profile unchanged. This is a decision made here; the brief did not cover it.
- **Visual check** is still not done. The orchestrator's browser check should cover `/admin/dogrulamalar` and `/admin/sikayetler` at 375 px, since the chips and split lines were changed.
