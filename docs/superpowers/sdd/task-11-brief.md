# Task 11 — Settings, avatar upload, KVKK rights (export, consent withdrawal, account deletion), purge

Read `docs/superpowers/sdd/global-constraints.md` and `docs/design-system.md` first. Spec sections: §4.10, §6.1–6.2 (retention, rights), §7 (cascade on deletion).
Available: auth libs (`verifyPassword`, `hashPassword`, `validatePasswordStrength`, `destroySession`, `destroyAllSessionsForUser`, `requireUser`, `getCurrentUser`), `recordConsent`, `hasActiveConsent`, `toSearchText`, `toListJson`/`parseList`, taxonomy (`CITIES`, `DEGREE_LEVELS`, `disciplineGroupForDepartment`), `avatarUrl` (`src/lib/avatar.ts` builds `/api/avatar/<file>`), `purgeExpiredMaskedText` (task 5), retention constants in `src/config/legal.ts`, `sniffFileType` (task 5). Stub `/ayarlar` exists — replace it. `scripts/purge.ts` placeholder exists — replace it.

## 1. Avatar
- `src/lib/avatar-storage.ts`: `AVATAR_DIR = path.join(process.cwd(), "storage", "avatars")`; `saveAvatar(userId, bytes)` — max 2 MB, `sniffFileType` must be jpeg/png/webp, file name `<userId>-<random 8 hex>.<ext>`, mkdir -p, write, delete the user's previous avatar file, return the file name; `deleteAvatarFile(name)` (ignore missing; reject names containing path separators or "..").
- `src/app/api/avatar/route.ts` — POST multipart field `avatar`, `assertSameOrigin`, verified-or-unverified logged-in user, saves and updates `avatarPath`, returns `{ ok: true, url }` or 400 with Turkish error.
- `src/app/api/avatar/[file]/route.ts` — GET: validate name `^[a-z0-9]+-[a-f0-9]{8}\.(jpg|png|webp)$` (cuid ids are lowercase alphanumerics), stream file with correct content type, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`; 404 otherwise. Avatars are visible to whoever can see the profile/project; that is acceptable (user-chosen image).
- `DELETE` on `/api/avatar` removes the avatar.

## 2. `/ayarlar` — `requireUser("/ayarlar")`
Sections (each a Card with `.t-section` title, own form, own success/error message; this page is long, so add an in-page link list at the top):
1. **Profil** — avatar picker (preview, "Fotoğraf yükle", "Kaldır"); Biyografi (≤ 300, counter); Şehir (select from CITIES, optional); Beceriler (chip input, ≤ 15); İlgi alanları (chip input, ≤ 10); "Proje arıyorum" Switch with helper text ("Açıkken profilinde 'Proje arıyor' görünür ve tanıştırma önerilerinde öne çıkarsın."). For verified users also editable: Fakülte, Bölüm, Öğrenim düzeyi, Sınıf (students) / Mezuniyet yılı (graduates). Üniversite and Durum are read-only with note "Belgenden alındı. Değiştirmek için yeni belge yükle." Ad/Soyad read-only with note "Ad ve soyad belgeyle eşleştiği için değiştirilemez." Save → `updateProfileAction`: zod; refresh `disciplineGroup` from department; refresh `searchText` (names, username, university, faculty, department, skills, interests, city).
2. **Şifre** — mevcut şifre, yeni şifre, tekrar → `changePasswordAction`: verify current; strength; update; destroy all other sessions (keep current: delete sessions of user except the current session id) — add `getCurrentSessionId()` helper in `src/lib/auth/session.ts` if missing.
3. **Gizlilik ve KVKK**:
   - Status line of CROSS_BORDER_AI consent: active → "Yapay zeka ile hızlı belge incelemesine rıza verdin." + button "Açık rızamı geri al" (`withdrawAiConsentAction` → recordConsent false; note: future verifications go to manual review; already completed verification stays). Not active → explanation + "Rıza ver" button linking to `/kvkk/acik-riza` and a form to grant (checkbox + button) → `grantAiConsentAction` (reuse task 6's if it exists in a shared place; otherwise create in `src/lib/settings/actions.ts`).
   - "Verilerimi indir" → `GET /api/me/export`.
   - Links: Aydınlatma metni, Açık rıza metni, Çerez politikası, KVKK başvurusu (`mailto:` LEGAL.email).
4. **Hesabı sil** (danger-soft card) — explanation of what is deleted (profil, projeler, başvurular, davetler, takipler, mesajlar, bildirimler, doğrulama kayıtları, avatar; irreversible), password field + typing the username to confirm → `deleteAccountAction`: verify password; delete avatar file; `db.user.delete` (cascade); destroy session cookie; redirect `/?hesap=silindi` (home shows a small notice for that param — add it to `src/app/(app)/page.tsx` minimally without changing other behaviour).

## 3. Data export — `src/app/api/me/export/route.ts`
GET, logged-in user only; JSON download (`Content-Disposition: attachment; filename="proje-arkadasim-verilerim-<YYYY-MM-DD>.json"`). Include: profile (all User fields except `passwordHash`), consents, verification attempts (status, source, documentType, aiUsed, aiModel, aiConfidence, aiSummary, redFlags, extracted fields, rejectReason, createdAt, reviewedAt — **exclude** `docHash` and `maskedText`), login events (last 100), projects owned (with roles), memberships, join requests, invites sent/received, follows (usernames), messages sent (body, createdAt, conversation id), notifications. Add `exportedAt` and a `notes` field in Turkish explaining that the document itself is never stored.

## 4. Purge
- `src/lib/purge.ts`: `runPurge(now = new Date())` → counts: expired masked texts (`purgeExpiredMaskedText`), expired sessions, used or expired password reset tokens, login events older than `LOGIN_LOG_RETENTION_DAYS` env (default 365).
- `maybeRunPurge()` — runs `runPurge` at most once per hour per process (globalThis timestamp), never throws (log a count-only message on error). Call it from `GET /api/me/counters` (task 3's route) after computing the response (do not await errors into the response).
- `scripts/purge.ts`: runs `runPurge()` and prints counts; `npm run purge`.

## Tests
- `src/lib/settings/actions.test.ts` (DB, mock auth/cookies/navigation/cache): update profile refreshes disciplineGroup + searchText and ignores attempts to change university/name; change password requires the current one and keeps only the current session; delete account requires password + username and cascades (projects, messages, follows gone); withdraw consent writes a granted=false row.
- `tests/export-route.test.ts`: export contains profile and attempts but no `passwordHash`, `docHash`, `maskedText` anywhere in the serialized JSON.
- `src/lib/avatar-storage.test.ts`: rejects non-image bytes and > 2 MB; rejects traversal names; replaces the previous file (use a temp dir by making `AVATAR_DIR` overridable via env `AVATAR_DIR` in tests).
- `src/lib/purge.test.ts`: each category purged, fresh rows kept.

## Done when
All settings flows work in `npm run dev`; export downloads; deleting an account logs out and removes data; checks pass; committed; report written.
