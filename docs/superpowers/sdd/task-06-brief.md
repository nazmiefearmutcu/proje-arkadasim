# Task 6 — Verification UI, upload API, admin panel (verification queue + reports)

Read `docs/superpowers/sdd/global-constraints.md` and `docs/design-system.md` first. Spec sections: §4.2 (verification page), §5 (pipeline), §6.2 (admin audit), §2 (admin rights).
Available from task 5: `verifyDocument({ userId, bytes })` → `{ status, message, consumedAttempt, processingMs }`, `MAX_DOCUMENT_BYTES`, `purgeExpiredMaskedText`, `profileFromAnalysis` in `src/lib/verification/*`. Also `requireUser`, `requireAdmin`, `getCurrentUser`, `isAdmin`, `assertSameOrigin`, `recordConsent`, `hasActiveConsent`, `notify`, `toSearchText`, `disciplineGroupForDepartment`, taxonomy (`VERIFICATION_STATUSES`, `ACADEMIC_STATUSES`, `DEGREE_LEVELS`), UI primitives, `VerifiedStamp`.

## 1. Upload API — `src/app/api/verification/route.ts`
- `POST`, `runtime = "nodejs"`, `maxDuration = 60`, `dynamic = "force-dynamic"`.
- `assertSameOrigin`; no user → 401 JSON `{ error: "Önce giriş yapmalısın." }`.
- Reject `content-length` > `MAX_DOCUMENT_BYTES + 64KB` with 413 before reading the body.
- `formData()`, field `belge` must be a `File`; size check again; `new Uint8Array(await file.arrayBuffer())` → `verifyDocument`. Never log the file or its name.
- Response JSON: the outcome (`status`, `message`, `consumedAttempt`). Errors → 500 `{ status: "ERROR", message: "Belge şu an işlenemedi. Birazdan tekrar dene." }`.

## 2. Verification page — `src/app/(app)/dogrulama/page.tsx`
Server Component: `requireUser("/dogrulama")`. Loads user status, last attempt (status, rejectReason, createdAt), whether CROSS_BORDER_AI consent is active, and attempts used in last 24 h (non-ERROR).
- `?hosgeldin=1` → welcome card "Hesabın oluşturuldu. Son adım: öğrenci veya mezun belgeni yükle."
- Status card by state, using tokens: UNVERIFIED (neutral), MANUAL_REVIEW (warn-soft: "Belgen inceleniyor. En geç 24 saat içinde sonucu bildireceğiz."), REJECTED (danger-soft with last reason + "Yeni belge yükle"), VERIFIED (stamp-soft with `VerifiedStamp size="lg"`, the education fields, link "Ana sayfaya git" and "Bilgilerini düzenle" → `/ayarlar`).
- When not VERIFIED and not MANUAL_REVIEW: the uploader.
- Accepted documents help box: "En hızlı yol: e-Devlet'te 'Öğrenci Belgesi Sorgulama' (öğrenciler) veya 'YÖK Mezun Belgesi Sorgulama' (mezunlar) hizmetinden PDF'i indir ve buraya yükle. Fotoğraf da yükleyebilirsin." Privacy note: "Belgen sunucumuzda yalnızca incelenirken, birkaç saniye bellekte tutulur ve hiçbir yere kaydedilmez." with link to `/kvkk/aydinlatma`.
- Consent panel when CROSS_BORDER_AI is not active: explains that the document will be reviewed manually within 24 hours and offers fast review by granting consent: checkbox with the same text as registration (link `/kvkk/acik-riza`) + button "Rızamı kaydet" → server action `grantAiConsentAction` (records consent, revalidates). When active: a small note "Hızlı inceleme açık. Rızanı Ayarlar'dan geri alabilirsin."
- Remaining attempts: "Bugün <n> deneme hakkın kaldı."
## 3. Uploader — `src/components/verification/uploader.tsx` ('use client')
- Large drop/tap zone (dashed `line` border, radius 16): icon, "Belgeni seç", "PDF, JPEG, PNG veya WebP · en fazla 10 MB" — write this as two lines, not a dot-joined string. `<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp">` (no `capture`, so phones offer both camera and files). Client-side size/type pre-check with the same messages as the server.
- After choosing: file name + size + "Belgeyi gönder" button (+ "Değiştir").
- While uploading: the 4-step progress list from spec §4.2 (Belge okunuyor → Kişisel veriler maskeleniyor → Yapay zeka inceliyor → Sonuç), a real sequence so numbered/checked steps are fine. Steps advance on timers (0.8 s, 1.6 s, then hold on step 3 until the response). This is the one orchestrated motion moment on this page; respect reduced motion.
- Result: APPROVED → success state with stamp, then `router.refresh()` after 1.2 s; MANUAL_REVIEW → warn state; REJECTED/ERROR → message + "Tekrar dene" (resets). Use `fetch("/api/verification", { method: "POST", body: formData })`.
- Accessible: `aria-live="polite"` on the progress/result region.

## 4. Admin — layout and pages
- `src/app/(app)/admin/layout.tsx`: `requireAdmin()`; simple tab bar (Genel bakış, Doğrulamalar, Şikayetler) using `Tabs`.
- `src/app/(app)/admin/page.tsx`: counts — users total, verified, manual-review queue size, open reports, projects open; plus "Süresi dolan maskeli metinleri temizle" button → action calling `purgeExpiredMaskedText` (shows count).
- `src/app/(app)/admin/dogrulamalar/page.tsx`: list of attempts with status MANUAL_REVIEW, oldest first: user full name + username + email, created relative time, source, nameMatch (Evet/Hayır), AI used + confidence + summary + red flags (if any), and a "Maskeli metni göster" `<details>` with the masked text in a `<pre>` (wrap, small text). Each page view writes one `AdminAuditLog` row with `action: "VIEW_VERIFICATION_QUEUE"` (the masked texts are rendered server-side, so the page view is the access event).
  Each item has a form (client component `src/components/admin/review-form.tsx`): editable fields prefilled from `extractedJson` — Üniversite, Fakülte, Bölüm, Durum (Öğrenci/Mezun), Öğrenim düzeyi, Sınıf, Mezuniyet yılı — and two buttons: "Onayla" and "Reddet" (reject requires a reason textarea, min 10 chars, shown to the user).
- `src/lib/admin/actions.ts` (`'use server'`, every action calls `requireAdmin`-equivalent check returning an error for non-admins):
  - `approveAttemptAction(attemptId, fields)` — zod-validate; transaction: attempt → status APPROVED, reviewedById, reviewedAt, maskedText null, maskedTextExpiresAt null, extractedJson = fields; user → VERIFIED + fields + disciplineGroup (from department) + verifiedAt + refreshed searchText; `AdminAuditLog` "APPROVE_VERIFICATION"; `notify` VERIFICATION_RESULT {status:"APPROVED"}.
  - `rejectAttemptAction(attemptId, reason)` — attempt → REJECTED with rejectReason, maskedText null; user → REJECTED; audit "REJECT_VERIFICATION"; notify {status:"REJECTED"}.
  - `resolveReportAction(reportId)` — status RESOLVED; audit "RESOLVE_REPORT".
  - `purgeMaskedTextAction()`.
- `src/app/(app)/admin/sikayetler/page.tsx`: open reports newest first: reporter, target type, a link to the target (USER → `/u/<username>`, PROJECT → `/projeler/<id>`, MESSAGE → show the message body excerpt and conversation participants' usernames), reason, details, "Çözüldü olarak işaretle". Resolved reports in a collapsed section (last 20).

## Tests
- `src/lib/admin/actions.test.ts` (DB; mock `next/headers`/`next/cache` and the current-user lookup): approve sets VERIFIED + fields + clears maskedText + audit row + notification; reject sets REJECTED + reason; non-admin gets an error and nothing changes.
- `tests/verification-route.test.ts`: call the route's `POST` with a `Request` built from `FormData` (mock auth to return a user): missing file → 400 JSON; oversized content-length → 413; cross-origin `Origin` header → 403.

## Done when
In `npm run dev` with `VERIFIER_PROVIDER=mock`: a newly registered user can upload a generated test PDF and gets a result in seconds; an admin (email in `ADMIN_EMAILS`) sees and decides manual-review items. Checks pass, committed, report written.
