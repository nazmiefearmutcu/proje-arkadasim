# Final fix wave — packet "admin-verification-ui"

Branch `task-22` (worktree `proje-arkadasim-wt/t22`), created from `main`.

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- Code commits:
  - `9317151` fix(admin): no self-review, block document reuse on approval, add revoke and close actions
  - `ff23bdc` feat(admin-ui): duplicate-document warning, real counts, revoke and close on reports
  - `75b0caf` fix(verification-ui): consent-aware steps, refresh after every consumed attempt, upload timeout
- HEAD: the commit that adds this report (see `git log -1` on `task-22`).

All 11 items are fixed. No item was left unfixed. No existing file outside the packet was edited; new files are listed below.

## Items

### R6 — No self-review by admins (Important)
- **Change:** `approveAttemptAction` and `rejectAttemptAction` return `fail("Kendi belgeni inceleyemezsin.")` right after loading the attempt when `attempt.userId === admin.id`. This happens before any write, so nothing changes and no audit row or notification is written. The new `revokeVerificationAction` refuses the admin's own account with `"Kendi doğrulamanı geri alamazsın."`. On `/admin/dogrulamalar`, the admin's own queued document shows "Bu belge senin. Başka bir yönetici incelemeli." in place of the review form, and `/admin/sikayetler` does not offer the revoke form on the admin's own account. Both actions also enforce the rule on the server.
- **Files:** `src/lib/admin/actions.ts`, `src/app/(app)/admin/dogrulamalar/page.tsx`, `src/app/(app)/admin/sikayetler/page.tsx`
- **Tests (`src/lib/admin/actions.test.ts`):** approve self, reject self, and revoke self. Each asserts the attempt and user keep their state (MANUAL_REVIEW, or VERIFIED for revoke), there are 0 `AdminAuditLog` rows and no VERIFICATION_RESULT notification.

### F1b — Document reuse on manual approval (Important)
- **Change:** `approveAttemptAction` now selects `docHash`. Inside the transaction, after the conditional attempt claim (so the write lock is held and two concurrent approvals serialize), it runs `findFirst({ docHash, status: "APPROVED", userId: { not: attempt.userId }, user: { verificationStatus: "VERIFIED" } })` when the hash is non-empty. A hit throws the internal `DocumentReused` error, which rolls the transaction back and maps to `fail("Bu belge başka bir doğrulanmış hesapta kullanılmış. Belgeyi reddet.")`. The queue page loads, in one query, other accounts' attempts with the same hashes: MANUAL_REVIEW attempts, or APPROVED attempts on a VERIFIED account, which is the same condition the action blocks on. Matching cards show "Bu belge başka bir hesapta da yüklendi: onaylı" (danger tone) or "… incelemede" (warn tone). The hash value is never rendered or returned to the page. The lookup is in a new module, `src/lib/admin/document-reuse.ts`.
- **Files:** `src/lib/admin/actions.ts`, `src/app/(app)/admin/dogrulamalar/page.tsx`, new `src/lib/admin/document-reuse.ts`
- **Tests:**
  - `actions.test.ts`: both accounts in review with the same hash. Approving A succeeds; approving B is refused, and B's attempt stays MANUAL_REVIEW with masked text kept, B stays MANUAL_REVIEW, there is 1 audit row and B gets no notification. B can still be rejected.
  - `actions.test.ts`: an AI-approved VERIFIED account holds the hash, so the pending account's approval is refused.
  - `actions.test.ts`: another account's REJECTED attempt with the same hash does not block.
  - New `src/lib/admin/document-reuse.test.ts` (4 tests):
    - two in-review accounts → both "incelemede"
    - APPROVED on a VERIFIED account → "onaylı", which wins over "incelemede"
    - not counted: the same user's own attempts, REJECTED attempts, and APPROVED attempts on a non-verified account
    - empty hash or empty list → empty result

### F2 — Admin revocation and project closing (Important)
- **Change:**
  - `revokeVerificationAction(userId, reason)`:
    - Order of checks: admin check, `validId`, self refusal (R6), `ReasonSchema` (10–500 characters, error returned as `fieldErrors.reason`), then the user must exist.
    - Writes, in one transaction:
      - `user.updateMany({ id, verificationStatus: "VERIFIED" } → { verificationStatus: "REJECTED", verifiedAt: null })`. A count of 0 returns `"Bu kullanıcı doğrulanmış durumda değil."` and writes nothing.
      - The user's latest APPROVED attempt becomes `REJECTED` with `rejectReason = reason`, `reviewedById` and `reviewedAt`, so `/dogrulama` shows the reason.
      - An audit row `REVOKE_VERIFICATION` with `targetUserId`, and `targetId` = the revoked attempt.
    - After the transaction: `notify({ type: "VERIFICATION_RESULT", data: { status: "REJECTED" } })` (existing type and copy, no notify or format change), then revalidate `/admin`, `/admin/sikayetler` and `/u/<username>`.
  - `adminCloseProjectAction(projectId)`: admin check, `validId`, the project must exist. In one transaction, `project.updateMany({ id, status: "OPEN" } → CLOSED)` (a count of 0 returns "Bu proje zaten kapalı." with no audit row) and audit `CLOSE_PROJECT` with `targetId`. Then revalidate `/admin/sikayetler`, `/projeler` and `/projeler/<id>`.
  - New client components:
    - `src/components/admin/revoke-verification-form.tsx`: a reason textarea (max 500, client-side minimum of 10), a `window.confirm`, and a danger md button "Doğrulamayı geri al".
    - `src/components/admin/close-project-button.tsx`: "Projeyi kapat", secondary md, with `window.confirm`.
  - `/admin/sikayetler` now also selects `verificationStatus` for users and `status` for projects. It renders the revoke form on open reports whose USER target is VERIFIED and is not the acting admin, and the close button on OPEN PROJECT targets. The resolve button stays.
- **Files:** `src/lib/admin/actions.ts`, `src/app/(app)/admin/sikayetler/page.tsx`, new `src/components/admin/revoke-verification-form.tsx`, new `src/components/admin/close-project-button.tsx`
- **Tests (`actions.test.ts`):**
  - Revoke:
    - success: the user becomes REJECTED with `verifiedAt` null; only the latest APPROVED attempt becomes REJECTED, with the reason, reviewer and time; 1 audit row with the target user and attempt; a REJECTED notification is sent
    - after a revoke, the same document no longer blocks another account's approval
    - non-admin refused
    - self refused
    - an unverified target gives the error with no audit row or notification
    - a short reason gives a field error
    - an unknown user gives an error
  - Close:
    - an open project closes with an audit row
    - an already closed project gives an error with no audit row
    - non-admin refused
    - an unknown project gives an error

### F9b — Class year range matches settings (Important)
- **Change:** `classYear: optionalYear(1, CLASS_YEAR_MAX, "Sınıf")`, importing `CLASS_YEAR_MAX` (8) from `src/lib/settings/limits.ts`, which was not edited. `review-form.tsx` has no `max` or `hint` attribute on the class field, so it needed no change. The server error "Sınıf 1-8 arasında olmalı." is shown under the field through `fieldErrors`.
- **Files:** `src/lib/admin/actions.ts`
- **Tests:** classYear "8" is accepted and stored as 8; "9" is refused with `fieldErrors.classYear === "Sınıf 1-8 arasında olmalı."` and the attempt is unchanged.

### M71b — Approval keeps the city in searchText (Minor)
- **Change:** `city` was added to the `attempt.user` select and is passed as the last `toSearchText` argument, in the same order as `settings/actions.ts`.
- **Files:** `src/lib/admin/actions.ts`
- **Tests:** a pending user with city "İzmir" has `searchText` containing "izmir" (and the department) after approval.

### M26 — Capped lists shown as totals (Minor)
- **Change:**
  - The queue header uses `db.verificationAttempt.count({ where: { status: "MANUAL_REVIEW" } })`. When the list is at its limit and the total is larger, it reads "N belge inceleme bekliyor. En eski 50 tanesi gösteriliyor, en eskisi üstte."
  - The open-reports heading uses `db.report.count({ where: { status: "OPEN" } })`. When capped, a line says "En yeni 100 şikayet gösteriliyor." The wording is "en yeni" because this list is newest first.
- **Files:** `src/app/(app)/admin/dogrulamalar/page.tsx`, `src/app/(app)/admin/sikayetler/page.tsx`
- **Tests:** server-component copy only; not unit-testable in the node test environment. Verified by tsc and lint.

### M27 — 44 px touch targets (Important)
- **Change:** removed `size="sm"` from "Çözüldü olarak işaretle" and from the uploader's "Durumu güncelle", so both use the default md size (`h-11`). The new buttons ("Doğrulamayı geri al", "Projeyi kapat") also use md.
- **Files:** `src/components/admin/resolve-report-button.tsx`, `src/components/verification/uploader.tsx`
- **Tests:** markup only (tsc and lint).

### F11 — Step list without AI consent, consent panel position (Minor)
- **Change:** `dogrulama/page.tsx` passes `<Uploader aiConsent={aiConsent} remaining={remaining} />`. Without consent, step 3 reads "Ekibimizin incelemesine hazırlanıyor" and the other steps are unchanged. `<ConsentPanel />` now renders above the Uploader, below the "Kabul edilen belgeler" card. The step lists are in the new module `src/components/verification/upload-flow.ts` (`stepsFor`).
- **Note:** the spec §4.2 step list ("… → Yapay zeka inceliyor → Sonuç") describes the consented flow. Without CROSS_BORDER_AI consent the service never calls the AI (spec §5.1 step 6, §6.2), so the UI must not claim it does.
- **Files:** `src/app/(app)/dogrulama/page.tsx`, `src/components/verification/uploader.tsx`, new `src/components/verification/upload-flow.ts`
- **Tests (new `src/components/verification/upload-flow.test.ts`):** with consent the list is the spec list; without consent step 3 is the team-review label, no step mentions "yapay zeka", and the other steps are unchanged.

### M36 — Dead anchor and stale counts after upload (Important)
- **Change:** the REJECTED status card renders "Yeni belge yükle" only when `remaining > 0`. The limit card in the Uploader also carries `id="belge-yukle"`, so the anchor can never dangle. The Uploader calls `router.refresh()` after `REFRESH_DELAY_MS` whenever `result.consumedAttempt` is true (APPROVED, REJECTED, MANUAL_REVIEW). It also refreshes for the existing "already verified" APPROVED response, which consumes no attempt, as before. `consumedAttempt` is now read from the API response.
- **Files:** `src/app/(app)/dogrulama/page.tsx`, `src/components/verification/uploader.tsx`, `src/components/verification/upload-flow.ts`
- **Tests (`upload-flow.test.ts`):**
  - `readUploadResult` reads status, message and `consumedAttempt`, and falls back to the generic error.
  - `shouldRefreshAfter` is true for every consumed result and for APPROVED, and false for non-consuming ERROR and for the 409 MANUAL_REVIEW reply.

### F31 — "Manuel incelemede" label on the status card (Minor)
- **Change:** the status card heading is `labelOf(VERIFICATION_STATUSES, status)`: "Manuel incelemede" for MANUAL_REVIEW and "İnceleniyor" for PENDING. This matches the result card and the avatar menu.
- **Files:** `src/app/(app)/dogrulama/page.tsx`
- **Tests:** server-component copy (tsc and lint). The label values come from the taxonomy.

### F20b — Upload request timeout (Important)
- **Change:** the new `postDocument(body, { controller, timeoutMs = 90_000 })` in `upload-flow.ts` starts a 90 s timer that aborts the controller, and clears it in `finally` on every path. It returns `{ kind: "aborted" }` when the signal was aborted, and otherwise the parsed result (a network error becomes the generic error result). The Uploader keeps the controller in a ref and aborts it on unmount. On abort it shows `GENERIC_ERROR_MESSAGE` ("Belge şu an işlenemedi. Birazdan tekrar dene.") and returns to the "selected" phase with the same file, so the user can press "Belgeyi gönder" again or pick another file.
- **Files:** `src/components/verification/uploader.tsx`, `src/components/verification/upload-flow.ts`
- **Tests (`upload-flow.test.ts`, fake timers):**
  - A hanging fetch is not aborted at 89 999 ms, is aborted at 90 000 ms, returns "aborted" and leaves 0 timers.
  - A caller abort (unmount) returns "aborted" and leaves 0 timers.
  - A successful response is parsed, leaves 0 timers, and the fetch received the signal.
  - A network error gives the generic error result.

## New files
- `src/components/admin/revoke-verification-form.tsx`, `src/components/admin/close-project-button.tsx` (named by F2)
- `src/lib/admin/document-reuse.ts` + `document-reuse.test.ts` (F1b queue lookup, testable without rendering)
- `src/components/verification/upload-flow.ts` + `upload-flow.test.ts` (F11, M36 and F20b logic, testable in the node environment)

No existing file outside the packet was edited. `src/lib/settings/limits.ts` is only imported. Schema, notify and notification format are unchanged.

## Residual notes (not defects of this packet, no action taken)
- **Owner can reopen an admin-closed project.** Admin closing uses the same `status` column the owner toggles ("Başvurulara aç"). Locking it would need a schema field, which is out of bounds. The stronger control already exists: revoking the owner's verification blocks every verified-only action, reopening included. Every admin close is in the audit log.
- **Revocation keeps the education fields** (university, department, …), because the ruling limits the write to `verificationStatus`/`verifiedAt`. They are overwritten on re-verification. While the account is unverified it drops out of people search (`search.ts` filters VERIFIED) and loses every verified-only permission. A verified viewer who opens `/u/<username>` directly still sees the stored education fields, but without the verified stamp. Clearing the fields on revoke would be a product decision outside this ruling.
- **Revoked users with no APPROVED attempt:** every app path to VERIFIED leaves an APPROVED attempt (service auto-approval, admin approval, and the seed's verified users). An account set to VERIFIED by hand in the database has none, so after a revoke `/dogrulama` shows the generic rejection text and the reason is not stored (`AdminAuditLog` has no reason column). The revoke itself still works and is audited.
- `/dogrulama` picks `lastDecision` by `createdAt`. In the rare concurrent-upload case where a newer attempt was rejected after an older one was approved, a later revoke would show the newer attempt's reason. This was left as is, since the page query belongs to the verification flow and the case needs two concurrent uploads (M37).

## Checks
- `npx tsc --noEmit`: pass (no output)
- `npm run lint`: pass (no warnings)
- `npx vitest run`: **53 files, 510 tests passed**. In this packet: `src/lib/admin/actions.test.ts` 31 (was 12), `src/lib/admin/document-reuse.test.ts` 4 (new), `src/components/verification/upload-flow.test.ts` 10 (new).
