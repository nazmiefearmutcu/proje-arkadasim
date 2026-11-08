# Final fix wave: auth-legal-docs (auth mail, consent wording, legal texts, README, env, seed)

Branch `task-27` (worktree `proje-arkadasim-wt/t27`), created from `main`.

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- HEAD: the commit that adds this report (see `git log`). The code commits before it are
  `ac2d59d`, `b556bff`, `f52199b`, `ddef38b`, `c76bd86`, `4c93f35`.

All 17 packet items are fixed. No item was left unfixed. No existing file outside the packet was changed.

## Items

### R1 (Important): dev-only reset link in the console mailer
- `src/lib/mailer.ts`: `MailInput` gains the optional `devLink`. Only the console branch (not production and no
  `SMTP_URL`) prints it, unredacted, in a separate `console.info("Geliştirme bağlantısı: …")` call after the
  redacted body. The SMTP path passes only `{ from, to, subject, text }` to nodemailer and logs nothing. Production
  without SMTP throws before any output.
- `src/lib/auth/password-reset-action.ts`: `issueResetLink` passes the reset URL as `devLink`.
- Tests: new `src/lib/mailer.test.ts` (nodemailer mocked). Dev without SMTP logs the full `/sifre-sifirla/<token>`
  URL exactly once and the body shows `[gizlendi]`. Without `devLink` the token never appears. Production without
  SMTP throws and writes nothing to any console method. With `SMTP_URL` set (development and production) nodemailer
  receives no `devLink` and there is no console output. `password-reset-action.test.ts` checks that `devLink` equals
  the URL in the text and runs one end-to-end case through the real mailer (the console shows the link once, and the
  body stays redacted).

### R5 (Important): one AI consent statement naming DeepSeek and China
- `src/config/legal.ts`: `AI_CONSENT_STATEMENT`, verbatim from spec §4.1 ("… (DeepSeek, Çin) …").
- New `src/components/legal/ai-consent-link.tsx`: the shared `Açık rıza metnini oku` link to `/kvkk/acik-riza`
  (44 px, focus ring, new tab so the form state survives).
- The checkbox label is the constant, followed by that link, in `register-form.tsx`, `consent-panel.tsx` (the
  link used to sit inside the label; it is now a separate element after it) and `ayarlar/ai-consent-panel.tsx`. The
  divergent wordings ("Belgemin maskelenmiş metninin … yurt dışına gönderilmesine …" and "(DeepSeek, Çin Halk
  Cumhuriyeti)") are gone. The existing buttons and actions stay, including the brief-mandated `Rıza ver` button
  in `/ayarlar` (M44).
- `/kvkk/acik-riza` "Rıza beyanı" now quotes the same constant and says all three forms use it.
- Test: `src/config/legal.test.ts` pins the constant to the spec text.

### R7 (Important): remove unused env variables
- `SESSION_SECRET` and `ADMIN_EMAILS` are removed from `.env.example` and README (env table rows, setup step 3,
  go-live item 7). README now states that admin rights come only from `role = ADMIN`. The guards test that proves
  `ADMIN_EMAILS` grants nothing is kept, and a `requireAdmin` case was added for it as well.

### F25 (Critical): seed wipes production data
- `src/lib/seed-guard.ts`: exports `PUBLISHED_EXAMPLE_USER_PASSWORD`, which production now rejects the same way as
  the admin password. New `seedWipeProblem(existingUsers, argv)` and `SEED_WIPE_FLAG = "--wipe"`.
- `prisma/seed.ts` `main()`: counts users before hashing and wiping. With rows and no `--wipe` it stops with a message
  that names `npm run seed -- --wipe` and `npm run make-admin -- <e-posta>`. This holds even when `NODE_ENV` is not
  exported in the shell. `prisma migrate reset` and the first `prisma migrate dev` seed an empty database, so
  `db:reset` and setup keep working. The header comment and final console line are updated.
- New production admin bootstrap: `src/lib/admin/make-admin.ts` (`makeAdmin(email)`) plus `scripts/make-admin.ts` and
  the `package.json` script `make-admin` (`npm run make-admin -- <email>`). The script normalises the e-mail with the
  existing `emailSchema`, refuses an unknown or invalid e-mail and changes nothing in that case. It sets
  `role = "ADMIN"` and writes a `GRANT_ADMIN_CLI` `AdminAuditLog` row (adminId null, targetUserId set) in one
  transaction. It is a no-op for an existing admin. It prints only `@username`, and adds a note when the account is
  not verified. It never prints a password, hash, token or e-mail.
- README: go-live item 6, the `SEED_ALLOW_PRODUCTION` row, the `seed` and `db:reset` command rows, setup and the demo
  accounts text all say the seed is for development only and deletes all data. The production bootstrap is
  documented. `.env.example` seed comment: the seed deletes every table, then loads demo data.
- Tests: `seed-guard.test.ts` (user password rejected in production, accepted in dev; `seedWipeProblem` for empty DB,
  populated DB, `--wipe`, near-miss flags); new `src/lib/admin/make-admin.test.ts` (promotes and audits; case and
  space insensitive e-mail; unknown e-mail changes nothing; invalid e-mail; already admin writes no audit row;
  unverified account flagged; result carries no hash or e-mail).
- Manual check on a scratch SQLite file (`prisma db push --skip-generate` to a scratchpad DB, never the main
  checkout): the seed ran on the empty DB, refused a second run with exit 1 ("Veritabanında 19 kullanıcı var …"),
  and ran with `--wipe`. `make-admin` printed usage on no arguments, refused an unknown e-mail (exit 1), promoted
  `Elif.Yilmaz@ornek.edu.tr`, was a no-op on the second run, and printed the unverified note for `yeni.kullanici`.

### F22 (Important): APP_URL fallback in production
- `password-reset-action.ts`: new `resetLinkBase()`. It uses only `APP_URL` (trimmed, trailing slashes removed), and
  falls back to `http://localhost:3000` only outside production. In production with an empty `APP_URL`,
  `issueResetLink` logs exactly `[şifre sıfırlama] APP_URL tanımlı değil; bağlantı gönderilmedi` (no address, no
  token) and creates no token row and no e-mail. The origin is never derived from Host or X-Forwarded-Host, and a
  comment says why.
- README: `APP_URL` is marked "Üretimde evet", and there is a new go-live item 10. `.env.example`: a comment, and the
  example value is now empty, so a copied `http://localhost:3000` cannot reach production unnoticed (development
  still defaults to localhost).
- Tests: production without `APP_URL` → `sendMail` called 0 times, 0 token rows, one fixed `console.error`. Production
  with `APP_URL` → the link uses it. A dev test passes `APP_URL` with a trailing slash.

### F26 (Important): KVKK e-mail placeholder and DraftNotice
- `legal.ts`: `email: "[KVKK başvuru e-postası]"` with an "operatör doldurur" comment. New `hasLegalPlaceholders()`
  checks controllerName, address, email, kep and hostingCountry (VERBİS is "varsa", so it is excluded).
- `legal-document.tsx`: `DraftNotice` uses `hasLegalPlaceholders()`, so the banner stays while any of those fields is
  still a placeholder.
- README go-live item 2 now lists e-posta (a real address that can receive mail) and barındırma ülkesi, and explains
  the banner.
- Tests: `legal.test.ts` covers the template values, all fields filled, and each field left as a placeholder on its own.

### M14 (Minor): hosting country
- `legal.ts`: `hostingCountry: "[Barındırma ülkesi]"` with an "operatör doldurur" comment. It is covered by the
  DraftNotice check and README item 2. `/gizlilik` now reads "Verilerin [Barındırma ülkesi] içinde barındırılır."
  until the operator fills it in.

### M15 (Minor): step 1 button
- `register-form.tsx`: `Devam et` → `Onaylara geç`.

### F44c (Minor): register consent error accessibility
- `register-form.tsx`: the step 2 error has `id="reg-consent-error"` and `role="alert"`. While the error shows, both
  required checkboxes get `aria-describedby="reg-consent-error"`, each gets `aria-invalid` when its own consent is
  missing, and both carry `required` (the form keeps `noValidate`; this only exposes the required state).

### F29 (Minor): KVKK notice inventory
- `kvkk/aydinlatma/page.tsx`: the consent row's retention is now "Hesap silinene kadar", which matches the cascade
  delete. "Rıza kayıtları: hesap silinene kadar." is added to the Saklama süreleri list. New rows:
  - Profile photo, bio, city, skills (UI label "beceriler") and interests: shown to verified members, photo also on
    project cards to guests; m.5/2-c; kept while the account exists and editable or removable in settings.
  - Block records: m.5/2-c; kept until unblocked or the account is deleted (cascade).
  - Report records: m.5/2-ç, m.5/2-f; kept after account deletion with the reporter link removed (SetNull).
- Spec conflict: §6.1 says consent records are kept "Hesap süresince + ispat süresi", but §7 cascades every
  user-linked row except AdminAuditLog and Report, and so does the schema. The notice follows the code (§7). If proof
  must outlive the account, that needs a schema change (SetNull or a separate proof table), which this packet must
  not make.

### F50 (Minor): help FAQ
- `yardim/page.tsx`: "Ayarlar sayfasındaki Hesabı sil bölümünden şifreni ve kullanıcı adını yazarak silebilirsin."

### F58 (Minor): guard tests
- `guards.test.ts`: mocks `./session` `getSessionUser` and `next/navigation` (`redirect` and `notFound` throw
  sentinels). It asserts `getCurrentUser` with and without a session; `requireUser` for a guest
  (`/giris?next=%2Fprojeler%2Fabc%3Fsekme%3Dekip`), for no `next` (`/giris`), for an unsafe `//evil.com` (`/giris`),
  and that logged-in users pass; `requireVerified` for a guest (login first), UNVERIFIED, PENDING, MANUAL_REVIEW and
  REJECTED (`/dogrulama`), and that VERIFIED passes; `requireAdmin` for a guest and a non-admin (`notFound`, never
  `redirect`), that ADMIN_EMAILS does not open it, and that an admin passes.

### F54 (Minor): PostgreSQL steps
- README: a new step 3 moves `prisma/migrations` aside, keeping a copy (`mv` and PowerShell `Move-Item`), because
  `migration_lock.toml` pins sqlite (P3019). Step 4 runs `migrate dev --name init_postgres`, which creates a new
  postgresql lock, and says to use `migrate deploy` and no seed in production. Step 5 says the tests are SQLite-bound:
  `vitest.config.ts` and `tests/global-setup.ts` build a `file:` URL and `db push` it. After the switch, both need a
  separate PostgreSQL test database, never the dev or production one, because the tests empty every table.

### F55 (Minor): missing env entries
- `.env.example`: commented entries for `DEEPSEEK_THINKING`, `AVATAR_DIR` (must be on persistent disk),
  `TESSDATA_LANG_PATH` and `SEED_ALLOW_PRODUCTION`, using the README wording. README: a new `TESSDATA_LANG_PATH`
  row, a persistence note on `AVATAR_DIR`, and a sentence saying `.env.example` lists every variable (optional ones
  commented) and that `NODE_ENV` comes from `next build` and `next start` but is empty for scripts.

### F56 (Minor): README test description
- The Testler section now describes the tests as they are: the route test checks the HTTP contract with a mocked
  service; the service test runs a synthetic pdf-lib PDF through the mock provider; the DeepSeek provider is tested
  with fake completion and fetch responses including timeout; the guard redirects; the mailer and seed guards; and the
  DB integration suites. The `db:reset` row says it re-seeds automatically.

### F20c (Minor): OCR language data and new verification limits
- README setup, the env table, step 3 of "Belge doğrulama nasıl çalışır" and new go-live item 11 say that `tur` and
  `eng` traineddata are downloaded once from cdn.jsdelivr.net into `storage/tessdata` (or `TESSDATA_LANG_PATH`).
  Hosts without outbound HTTP must place `tur.traineddata` and `eng.traineddata` there in advance. The download sends
  no document content.
- "Belge doğrulama nasıl çalışır" now lists the 5-page PDF cap, the image size cap and the separate 20-per-24h cap for
  unreadable-file (ERROR) uploads.

## Concerns for the merge

- F20c, F55 and F56 describe behaviour delivered by the verification-pipeline packet (F3, F20a, F21, F24), which is
  not in this worktree: `TESSDATA_LANG_PATH`, the 5-page PDF cap, the image size cap, the 20/24h ERROR cap, and the
  DeepSeek fetch and timeout tests. The README follows the wording in the fix list. The image cap is described without
  a number because its value is not visible here. Please check the README text against that packet when merging:
  whether PDFs over 5 pages are rejected or truncated, the exact image limit, and whether `TESSDATA_LANG_PATH` is a
  cache directory or a read-only `langPath`.
- `LEGAL_VERSION` was not bumped. The consent wording and the notice changed, but nothing has been published yet, and
  README go-live item 5 already tells the operator to bump it on publication.
- `/ayarlar` (`src/app/(app)/ayarlar/page.tsx`, outside the packet) builds `mailto:${LEGAL.email}`. Until the
  operator fills the placeholder, it is `mailto:[KVKK başvuru e-postası]`, which is visibly a placeholder, as
  intended by F26.
- `/ayarlar` now has two links to `/kvkk/acik-riza` in the inactive state: the brief-mandated `Rıza ver` button (M44)
  and the R5 `Açık rıza metnini oku` link after the checkbox. Both are kept on purpose ("keep the existing buttons").

## New files

`src/lib/mailer.test.ts`, `src/config/legal.test.ts`, `src/components/legal/ai-consent-link.tsx`,
`src/lib/admin/make-admin.ts`, `src/lib/admin/make-admin.test.ts`, `scripts/make-admin.ts`, and this report.

## Checks

- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npx vitest run`: 54 files, 525 tests passed (BASE: 51 files, 477 tests).
