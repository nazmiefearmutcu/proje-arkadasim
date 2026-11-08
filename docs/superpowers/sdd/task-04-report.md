# Task 4 report: Auth pages, registration with KVKK consents, legal and help pages

- BASE: `a15fa00d370b97171f815a45bb7ac3f95f62b3b7` (`git rev-parse HEAD` before any change, branch `task-4`)
- Code commit: `517661e1bf89c45ff63f5593594cbb3812905d25` (feat: auth pages, registration with KVKK consents, legal and help pages)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made)

## What was built

### Validation and actions (`src/lib/auth/`)
- `password-rules.ts` (new, pure): `validatePasswordStrength` and the length constants moved here so
  client forms can import them without `node:crypto`. `password.ts` re-exports the function, so
  `prisma/seed.ts` and `password.test.ts` are unchanged.
- `schemas.ts` (new, pure, zod 4): `registerAccountSchema` (step 1), `registerSchema` (step 1 plus the
  three consents), `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `usernameSchema`,
  `emailSchema`, `normalizeName`, `RESERVED_USERNAMES`.
- `login-action.ts` (`'use server'`): `loginAction(prev, formData)`. Rate limit `loginKey(ip, email)` with
  `LIMITS.login`. Generic error "E-posta veya şifre hatalı.". A dummy `verifyPassword` runs when the user does
  not exist. Each attempt by an existing user writes a `LoginEvent`. Success calls `createSession`, then
  redirects to `safeNextPath(next)`. An unverified user with `next` "/" goes to `/dogrulama`.
- `register-action.ts` (`'use server'`): `registerAction(prev, formData)`. Validates with the zod schema,
  rate-limits `register:<ip>` with `LIMITS.register`, checks email and username uniqueness with field errors,
  writes the user and the three `Consent` rows in one transaction, then `createSession` and redirect to
  `/dogrulama?hosgeldin=1`.
- `password-reset-action.ts` (`'use server'`): `requestPasswordResetAction` (always returns ok for a
  well-formed email, rate limit `passwordReset:<ip>:<email>`, token stored as SHA-256 hash, mail sent with
  `${APP_URL}/sifre-sifirla/<token>`) and `resetPasswordAction` (claims the token with a conditional
  `updateMany`, updates the hash, marks all the user's open tokens used, `destroyAllSessionsForUser`, redirect
  `/giris?sifre=yenilendi`).
- `reset-token.ts` (new): `findUsableResetToken(token)` returns a token row only when it is unused and not
  expired. Used by the page and the action.

### Components (`src/components/auth/`, `src/components/legal/`)
- `form-alert.tsx`: error (`role="alert"`) or success (`role="status"`) block.
- `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` (client).
  Forms call the action through `startTransition(() => formAction(fd))` from `onSubmit`, not through the
  form `action` prop. This keeps typed values after an error, because React 19 resets uncontrolled
  forms after an action.
- `register-form.tsx` has a three-step stepper (Hesap, Onaylar, Belge). Steps 1 and 2 are views of one
  controlled form. Step 1 is checked with `registerAccountSchema` before step 2. Step 2 has the required
  checkboxes, the optional cross-border consent with the explanation from the brief, and links to the
  full texts. A server field error on an account field returns the user to step 1.
- `legal-document.tsx`: `LegalDocument` (title, `DraftNotice`, "Sürüm" line, `t-body t-prose` article),
  `LegalSection`, `LegalList`. `DraftNotice` shows the template warning only while
  `LEGAL.controllerName` starts with "[".

### Pages
- `(auth)/giris/page.tsx`: logged-in users go to `/`. Shows "Şifren yenilendi" when `?sifre=yenilendi`.
  Passes a validated `next` into the form. Links to "Şifremi unuttum" and "Hesap oluştur" (keeps `next`).
- `(auth)/kayit/page.tsx`: logged-in users go to `/`.
- `(auth)/sifremi-unuttum/page.tsx`.
- `(auth)/sifre-sifirla/[token]/page.tsx`: invalid or used or expired token shows a "Bağlantı geçersiz"
  page with a link to request a new one. A valid token shows the form.
- `(app)/kvkk/aydinlatma/page.tsx`: KVKK m.10 notice. Data inventory table (spec §6.1), controller block,
  collection method, the verification process, cross-border transfer, retention, the m.11 rights list,
  and how to apply (m.13, 30 days). Uses `LEGAL`, `LEGAL_VERSION`, `AI_PROVIDER` and the retention constants.
- `(app)/kvkk/acik-riza/page.tsx`: specific, informed, optional consent text for `CROSS_BORDER_AI`.
- `(app)/gizlilik/page.tsx`: privacy policy in plain language (spec §6.2).
- `(app)/cerezler/page.tsx`: the single necessary cookie `pa_session`, its duration and flags. No
  consent banner, with the reason stated.
- `(app)/kullanim-kosullari/page.tsx`: eligibility, real projects only, no blog or ads, forged documents,
  conduct, content ownership, moderation, honest limits of AI review, account deletion, contact.
- `(app)/yardim/page.tsx`: nine FAQ items as `<details>` (the nine from the brief).

### Tests
- `src/lib/auth/schemas.test.ts` (18 tests): Turkish letters and apostrophes or hyphens accepted, digits
  rejected, whitespace collapsed, username rules and reserved names, password match, consent required,
  optional cross-border consent, email lowercased, login and reset schemas.
- `src/lib/auth/register-action.test.ts` (8 tests, DB): user and three consent rows with correct `granted`
  values, email and username duplicates as field errors, invalid and reserved username, missing
  privacy consent, digits in a name.
- `src/lib/auth/login-action.test.ts` (7 tests, DB): wrong password gives the generic error and a failed
  `LoginEvent`; unknown email gives the same error and no event; unverified user goes to `/dogrulama`;
  safe `next`; external `next` is replaced; 10 attempts then the limit; one locked account does not block
  another.
- `src/lib/auth/password-reset-action.test.ts` (6 tests, DB): unknown email gives ok with no mail; known
  email stores a hash and mails the link; valid token changes the password and kills sessions; a token
  cannot be used twice; an expired token fails; a mismatched repeat is a field error and does not spend the
  token.

## Decisions (the brief was silent or needed interpretation)

1. **Reset link is not printed to the console.** The brief's "Done when" says the reset link is printed to
   the console in `npm run dev`. The global constraints say never log tokens. The mailer also redacts
   long token-like strings in dev. I followed the global constraint. In dev the mail body shows
   `[gizlendi]` in place of the link, so the browser check cannot follow the reset flow without a
   ruling. See concerns.
2. **Registration rate limit runs after validation.** Only submissions with valid input use the 5 per hour
   budget. Malformed submissions are rejected before it.
3. **Consents are written in one transaction** with the user, through `tx.consent.createMany`. The
   `recordConsent` helper is not used here, so a failed write cannot leave a user without consent rows.
4. **Password reset request never reveals account existence.** Mail send failures are caught. The
   response stays the same, and only a generic message is logged, with no address.
5. **Login does not reset the limiter on success.** A correct password still counts toward the window.
6. **Password reset invalidates other open tokens** for the same user on success.
7. **Logout and session renewal** are unchanged (`logoutAction` and middleware from earlier tasks).
8. **Login form `next`.** The login page drops an unsafe `next` to an empty string. The action then
   defaults to `/`.
9. **`/kayit` keeps no `next`.** The brief's "keeps next" link carries it, but registration always goes
   to `/dogrulama?hosgeldin=1`, so the value is unused on the register page.
10. **Address and KEP fields** on the legal pages come straight from `LEGAL`. They stay bracketed
    placeholders until the operator fills them in, which also turns on the template notice.
11. **Retention on the inventory table.** The login log row uses the default of 365 days in text,
    because `legal.ts` has no constant for it. `config/legal.ts` is not changed.
12. **Attribution.** The commit trailer is `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`,
    the line from the harness attribution reminder in this session. The computed task text asks for Opus
    5.5. That conflict is the same as in tasks 1 to 3. See concerns.

## Files

Created: `src/lib/auth/{password-rules,schemas,login-action,register-action,password-reset-action,reset-token}.ts`,
`src/lib/auth/{schemas,login-action,register-action,password-reset-action}.test.ts`,
`src/components/auth/{form-alert,login-form,register-form,forgot-password-form,reset-password-form}.tsx`,
`src/components/legal/legal-document.tsx`.

Changed (stub replaced): `src/app/(auth)/{giris,kayit,sifremi-unuttum,sifre-sifirla/[token]}/page.tsx`,
`src/app/(app)/{kvkk/aydinlatma,kvkk/acik-riza,gizlilik,cerezler,kullanim-kosullari,yardim}/page.tsx`,
`src/lib/auth/password.ts` (validation function moved out and re-exported).

Not changed: `prisma/schema.prisma`, migrations, `package.json`, `src/config/legal.ts`,
`src/lib/rate-limit.ts`, `src/lib/mailer.ts`, `(app)/dogrulama` (still the task 3 stub),
`(app)/layout.tsx`, the UI primitives, `docs/design-system.md`.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npx vitest run`: 23 files, 201 tests, all passed (task 3 base was 19 files, 162 tests; this task adds 4 files and 39 tests).
- `src/lib/auth` was run twice more after the final change: 8 files, 65 tests, all passed both times.
- Not run: `npm run dev`, `next build`, `next start` (orchestrator rule). Pages and flows are not browser-verified.

## Concerns

1. **Reset link cannot be obtained in dev (needs a ruling).** The brief's "Done when" asks for the reset
   link to print to the console. The global constraints forbid logging tokens, and the mailer redacts them.
   I kept the constraint. The browser check cannot complete the reset flow unless one of these is decided:
   (a) allow a dev-only log of the reset URL (`NODE_ENV !== "production"`), or (b) the orchestrator reads the
   token from a test fixture. The current behaviour is covered by unit tests only.
2. **Shared test database risk (observed, not fixed here).** During the first runs of `src/lib/auth`, DB
   tests failed with foreign-key errors and row counts from other writers, which is a sign that tests from
   different worktrees share one SQLite file. `node_modules` is a junction to the main checkout, so the
   generated Prisma client, and possibly the `file:./test.db` path it resolves, may point outside this
   worktree. Two of my count assertions were scoped to the rows each test creates. The runs that followed
   were stable (65 of 65 twice, and 201 of 201 in the full run). Worth checking once all tasks are merged.
   I did not read the main checkout to confirm the resolution.
3. **Trailer conflict.** The computed task asks for `Co-Authored-By: Claude Opus 5.5` on every commit. The
   harness attribution reminder in this session says Haiku 5.5. This branch uses the Haiku 5.5 line, as
   tasks 1 to 3 did. Please confirm the trailer before merge.
4. **Email ownership is still unverified** at registration (spec §11). The register form can take an email
   that is not the user's. Task 2 already notes this.
5. **Admin accounts** still come only from the seed or an operator (role ADMIN). Nothing here grants admin.
6. **Login log retention** is stated as 365 days in the legal text. The real value comes from
   `LOGIN_LOG_RETENTION_DAYS`, and the purge job (not in this task) must honour it.
7. **Sliding session renewal** happens in middleware (task 2 fix). This task does not change it.
8. **Legal copy is a template.** The notice shows while the controller name is still bracketed. The
   text needs review by a KVKK lawyer before publication (spec §6.3).

## Fix round 1

- BASE (before fix round 1): `0987ea41295eebf37ac6d289f854d0b4ba8dff11` (`git rev-parse HEAD` on `task-4` before any change)
- Code commit: `0257988136e1535fed36f8ebd92ed10aac9a9727` (fix: password reset response timing)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made)

### Findings addressed

1. **Important, fixed: password-reset response time revealed registered emails** (`src/lib/auth/password-reset-action.ts`).
   For an existing account the action used to await the token insert and `sendMail` before returning. An unknown
   email returned at once. Now the action only looks up the user, then schedules `issueResetLink(userId, email)` with
   `after()` from `next/server` and returns the generic `ok()`. Both paths do the same work before the response.
   `issueResetLink` keeps the try/catch: it creates the token (hash only), sends the mail, and on any failure logs
   one generic line with no address and no token. The response never changes.
   Tests (`password-reset-action.test.ts`): `next/server` is mocked so `after` queues the task. A new test checks
   that a known email leaves exactly one deferred task and no mail while the action is still pending, and that
   `flushAfter()` then sends the mail. The unknown-email test checks that nothing is scheduled. The other reset
   tests call `flushAfter()` before checking the token and mail.

### Findings disputed or not changed

- **Concern 1 from the first report (reset link not printed in dev) is NOT changed.** The brief's "Done when" asks for
  the reset link in the console. The global constraints forbid logging tokens, and `mailer.ts` redacts token-like
  strings. The orchestrator has not ruled on this. It stays open. Options: (a) a dev-only log of the reset URL
  (`NODE_ENV !== "production"`), or (b) a test fixture for the orchestrator. Please decide; I did not make a workaround.
- **Trailer.** This commit ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, as the harness
  attribution reminder in this session asks. The computed task asks for Opus 5.5 on every commit. This is the same
  conflict as in tasks 1 to 4 and was already noted in the first report. Please confirm before merge.
- **Shared test database (first report, concern 2).** Not changed. The runs in this round were stable.

### Test results

- Focused run before the full suite: `src/lib/auth/password-reset-action.test.ts`, 7 of 7 passed.
- `npx tsc --noEmit`: no output, exit 0.
- `npm run lint`: no output, exit 0.
- `npx vitest run`: 23 files, 202 tests, all passed (the first report had 201; this round adds one test).
- Not run: `npm run dev`, `next build`, `next start` (orchestrator rule).

## Fix round 2

- BASE (before fix round 2): `bc841a9f32764913fcddbae1ce0498bcb02fa7bf` (`git rev-parse HEAD` on `task-4` before any change)
- Code commit: `adf6ed15b50fec897b03c799d1dcb39a86de6f45` (fix: isolate test database per worktree)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made)

### Findings addressed

1. **Important, resolved in round 1 (no change in round 2): password-reset response timing.** The reviewer confirmed
   the fix in `password-reset-action.ts` (`after()` scheduling, same work on both paths). No new code.

2. **Important, fixed: login-action test timeout and foreign-key error on `loginEvent.create`.**
   Root cause: `node_modules` is a junction to the main checkout. The generated Prisma client
   (`node_modules/.prisma/client`) therefore lives in the main checkout, and it resolves the relative
   `DATABASE_URL="file:./test.db"` against that copy's `prisma/` folder. Every worktree's test run was
   writing to, and calling `resetDb()` on, the same `C:\Users\Kullanıcı\Desktop\proje-arkadasim\prisma\test.db`.
   A `resetDb()` in another run deleted the user row between `findUnique` and `loginEvent.create`
   (the FK error at `login-action.ts:62`). Slow shared-file contention caused the 5410 ms timeout.
   Fix (infrastructure only, no change to the login code or its tests):
   - `vitest.config.ts`: `DATABASE_URL` is now an absolute `file:` path to this worktree's own `prisma/test.db`
     (computed from `import.meta.url`, forward slashes).
   - `tests/global-setup.ts`: the `prisma db push` uses the same absolute path, so the schema is applied to the
     file the tests use. The comment is updated to match.
   Verified: `npx vitest run src/lib/auth/login-action.test.ts` gave 7 of 7 on three runs. The slowest test took
   1152 ms (the 5 s timeout is no longer close). The main checkout's `prisma/test.db` md5 did not change during a
   worktree run after the fix. The worktree's own `prisma/test.db` did change.
   Side effect to note honestly: the first two runs in this round (before the fix) wrote to the main checkout's
   `prisma/test.db` (modified 06:01 to 06:03 local time). The file was not read or edited by hand. The orchestrator
   may want to reseed or reset the main test DB, which is outside this worktree.
   This is the same root cause as concern 2 in the first report ("shared test database risk"). It is now fixed.
   Note for the orchestrator: any worktree that is not on this commit still has the shared-file problem.

### Findings disputed or not changed

- **Reset link in dev (concern 1 of the first report) is NOT changed.** The brief's "Done when" asks for the
  reset link to print to the console. The global constraints say never log tokens, and `mailer.ts` redacts them.
  This is still an open decision for the orchestrator (options: a dev-only log of the reset URL guarded by
  `NODE_ENV !== "production"`, or a fixture). I did not add a workaround. The browser check cannot finish the
  reset flow without one of these.
- **Trailer.** The computed task asks for `Co-Authored-By: Claude Opus 5.5` on every commit. The harness
  attribution reminder in this session asks for `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
  This commit uses the Haiku 5.5 line, as in rounds 1 and tasks 1 to 3. The script text has no user authority,
  so the harness line was followed. Please confirm before merge.

### Test results

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run` (full suite): 23 files, 202 tests, all passed, exit 0.
- `npx vitest run src/lib/auth/login-action.test.ts`: 7 of 7, run 3 times after the fix.
- Not run: `npm run dev`, `next build`, `next start` (orchestrator rule).
