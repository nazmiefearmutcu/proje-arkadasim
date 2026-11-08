# Task 2 report: Auth core, security helpers, notifications, permissions

- BASE: `ad55bad147dcd2e0e14bca0393afa5142fde2aa5`
- Code commit: `deba95d9ffc0c4c3ddf58a01f8e42780fc8cf760` (feat: auth core, security helpers, notifications and permissions)
- HEAD: the commit that adds this report (`git rev-parse HEAD` at commit time)

## What was built

### Auth (`src/lib/auth/`)
- `password.ts`: `hashPassword` (scrypt, N=16384, r=8, p=1, keylen 64, 16-byte salt), stored as
  `scrypt$N$r$p$saltB64$hashB64`. `verifyPassword` parses the stored string, uses `timingSafeEqual`, and
  returns false on any malformed input or error (never throws). It also caps N, r, p and key length to
  bound the work a stored value can cause. `validatePasswordStrength` returns Turkish messages for
  under 10 or over 128 characters, no letter (`\p{L}`), or no digit.
- `tokens.ts`: `generateToken(bytes = 32)` (base64url) and `hashToken` (SHA-256 hex).
- `user-select.ts`: `currentUserSelect` (the brief's field list, `satisfies Prisma.UserSelect`) and the
  `CurrentUser` type. It lives in its own file so `session.ts` and `guards.ts` do not import each other.
- `session.ts`: `SESSION_COOKIE = "pa_session"`, `createSession`, `getSessionUser` (wrapped in React
  `cache`), `destroySession`, `destroyAllSessionsForUser`. The cookie is httpOnly, sameSite lax, path /,
  Secure in production, and expires with the DB row. Expired sessions are deleted on read. When fewer
  than 15 days remain, the expiry is extended and the cookie re-set inside try/catch, so Server Components
  can still read sessions.
- `guards.ts`: `getCurrentUser`, `isVerified`, `isAdmin` (role ADMIN, or email in `ADMIN_EMAILS`, case
  insensitive, read at call time), `requireUser`, `requireVerified` (redirects to `/dogrulama`),
  `requireAdmin` (`notFound()`), and `safeNextPath`. It re-exports `currentUserSelect` and `CurrentUser`.
- `actions.ts`: `'use server'` `logoutAction()` (destroy session, redirect to `/`).

### Security and infrastructure (`src/lib/`)
- `rate-limit.ts`: fixed-window limiter `rateLimit(key, limit, windowMs)` in a `globalThis` Map, with
  expired-key pruning at most once a minute. `LIMITS` presets from the brief, as `as const` tuples.
  `clientIp()` reads the first `x-forwarded-for` value, then `x-real-ip`, then "local".
- `origin.ts`: `isSameOrigin(req)` and `assertSameOrigin(req)`. Missing Origin is allowed. A present
  Origin must match the host (`x-forwarded-host` first value, else `host`). A malformed Origin is
  rejected. `assertSameOrigin` throws a 403 JSON `Response`.
- `mailer.ts`: `sendMail({ to, subject, text })`. Uses nodemailer when `SMTP_URL` is set, with `MAIL_FROM`.
  Without SMTP it logs in development and throws `SMTP yapılandırılmamış` in production.
- `notify.ts`: `NotificationType` union (12 types), `notify` (skips self-notification and any actor
  blocked in either direction), and `notifyMany` (dedupes, drops the actor, drops blocked recipients,
  then `createMany`).
- `permissions.ts`: `fullName`, `displayName` (full name for VERIFIED or ADMIN viewers, otherwise
  first name plus last-name initials uppercased with `tr-TR`), `isBlockedEitherWay`,
  `areMutualFollowers`, `shareAProject`, `canMessageDirectly` (blocked → false; else mutual follow or
  shared project).
- `consent.ts`: `ConsentType`, `recordConsent` (append-only, default version `LEGAL_VERSION`), and
  `hasActiveConsent` (latest row by `createdAt` desc, then `id` desc, must be granted).

## Files

Created (19 files, 1084 insertions): `src/lib/auth/{password,password.test,tokens,user-select,session,guards,guards.test,actions}.ts`,
`src/lib/{rate-limit,rate-limit.test,origin,origin.test,mailer,notify,notify.test,permissions,permissions.test,consent,consent.test}.ts`.

No existing files were changed. No schema change, no migration, no new dependencies.

## Decisions (brief was silent or needed interpretation)

1. **`currentUserSelect` location.** It is defined in `src/lib/auth/user-select.ts` and re-exported from
   `guards.ts`. This avoids a `session.ts` ↔ `guards.ts` import cycle. The exported name is the same.
2. **Dev mail logging vs. global constraints.** The brief allows a reset link to be printed to the console in
   development. The global constraints forbid logging tokens. `sendMail` therefore redacts any run of 32 or
   more `[A-Za-z0-9_-]` characters in the dev log, which covers base64url tokens. The recipient and subject
   are still logged. The reset flow does not exist yet, so this only affects future callers.
3. **Sliding renewal.** The DB expiry is always extended. The cookie is re-set only when the write is
   allowed (Server Action or Route Handler). Other callers get a silent catch, as the brief asks.
4. **Admin check** reads `ADMIN_EMAILS` on every call, so tests can stub it and changes apply without a restart.
5. **`safeNextPath`** also rejects backslashes anywhere in the value, control characters, and values over 2048
   characters. The brief only required the `//` and `/\` prefixes; the extra rules are defence in depth.
6. **`requireUser` redirect target.** An empty or unsafe `next` produces plain `/giris` with no query string.
7. **`displayName` admin rule.** The brief's signature had only `verificationStatus`. The spec table says admins
   see full names, so `Viewer` has an optional `role` and ADMIN is treated like VERIFIED. This follows spec §2.
8. **`notify` block check.** The block check runs whenever `actorId` is given, not only for types the brief
   listed as actor-based. Types without an actor are never blocked.
9. **Attribution.** The task text asks for `Co-Authored-By: Claude Opus 5.5`. The session attribution reminder
   says Haiku 5.5, and the reminder takes precedence over earlier guidance. The commit uses the Haiku 5.5
   trailer, as in Task 1 rounds 1-3. Please confirm this is what you want.
10. **Extra test.** `src/lib/origin.test.ts` was added for the Origin helpers. It was not in the brief.

## Not done (intentional)

- No unit tests for `session.ts` (cookie and DB flow). The brief said these are optional, and the logic
  is small. `getSessionUser` is exercised later through the auth UI and route tests.
- `server-only` is not used. The package is not installed, and the brief did not ask for it.
- The rate limiter is in-process. It is correct for one Node server only.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 11 files, 102 tests, all passed (Task 1 had 56 tests in 4 files; Task 2 adds 46 tests in 7 files).
  The only warnings are the existing `vitest.config.ts` configLoader warning and the `package.json#prisma` deprecation warning from Prisma.
- Global setup reported "The database is already in sync with the Prisma schema."

## Concerns

- **Open from Task 1 (not changed here):** the test setup in `tests/global-setup.ts` still uses plain
  `prisma db push --skip-generate`, not the brief's `--force-reset`. The user still has to choose option (a) or (b)
  from the Task 1 report. This task did not touch that file.
- **Open from Task 1:** `AdminAuditLog` loses the actor's identity when an admin is deleted (spec §7 has no snapshot column). Spec decision still pending.
- The `ADMIN_EMAILS` admin check is on every request. That is cheap, but the list should stay short.
- `consent.ts` ordering uses `createdAt` then `id`. Two rows written in the same millisecond rely on cuid order. The
  test waits 5 ms between writes to avoid depending on this.

## Fix round 1

- BASE: `7d81be9beb9d8d14b02964409b828c71ec77a1b132` (`git rev-parse HEAD` at the start of this round)
- Code commit: `9c4438b0ae7d3be86b89732a67d1bca8b25f8c8c` (fix: task 2 review round 1)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made)

### Findings and changes

1. **Important, `src/lib/rate-limit.ts`: spoofable `x-forwarded-for`. Fixed.**
   `clientIp()` now reads forwarded headers only when `TRUST_PROXY=true`. In that case it uses the
   last `x-forwarded-for` entry, which the trusted proxy appends, and not the first one. `x-real-ip` is
   used next, then "local". With `TRUST_PROXY` unset, `clientIp()` returns "local" and the client cannot
   change its bucket. The cost is that all requests then share one bucket, so a deployment behind a
   proxy must set `TRUST_PROXY=true`. The limitation is documented in `.env.example`.
   The brief's "socket address" fallback is not possible here: Next.js server code cannot read the socket
   address through `headers()`.
   Tests (`src/lib/rate-limit.test.ts`): ignored when untrusted; a spoofed first value (`6.6.6.6, 203.0.113.9`
   and `7.7.7.7, 203.0.113.9`) resolves to the same key; `x-real-ip` and `local` fallbacks.

2. **Important, `src/lib/auth/guards.ts`: `ADMIN_EMAILS` grants admin without email proof. Fixed.**
   `isAdmin` now checks `role === "ADMIN"` only. The spec has no email verification step (§11), so an
   operator's email could be registered by someone else first. Admins are set by seed or operator action.
   Task 6 depends on the old behaviour (its brief says "email in `ADMIN_EMAILS`"). It must be changed to
   role-based admins. `ADMIN_EMAILS` is kept only as a bootstrap input. `.env.example` says so.
   Tests: the `ADMIN_EMAILS` case now asserts `false`. The brief's `ADMIN_EMAILS`-grants-admin test is
   intentionally removed. The `isAdmin` parameter type is now `Pick<CurrentUser, "role">`.
   Registration gap (for the report to the operator): any visitor can register with an email that is not
   theirs. Ownership of that email is never checked. Email verification is out of scope (spec §11), so
   this stays until a verification step is added.

3. **Important, `src/lib/auth/session.ts`: sliding renewal diverged from the cookie. Fixed (partly).**
   The cookie is now written first. The DB expiry is extended only when that write succeeds. In a Server
   Component the write throws, so neither the cookie nor the DB row changes. The cookie and the DB
   expiry therefore stay equal, and no session dies early.
   Limitation: renewal happens only in writable requests (Server Actions, Route Handlers) inside the
   15-day window. Plain page browsing does not extend a session. Full sliding renewal needs a Route
   Handler or middleware refresh path. That is a follow-up and is not part of this round. Spec §8 is
   therefore met only partly.
   Tests (`src/lib/auth/session.test.ts`, new): renewal in a writable context updates the cookie and DB;
   a read-only context updates neither and still returns the user; no renewal outside the window; expired
   sessions are deleted.

### Minor findings
None were given in this round.

### Disputed findings
None. All three findings were valid and were fixed.

### Attribution
The task text asked for `Co-Authored-By: Claude Opus 5.5`. The session attribution reminder says
Haiku 5.5 and replaces earlier guidance, so the commit uses the Haiku 5.5 trailer, as in Task 2 round 0.
Please confirm which trailer you want.

### Verification (after the fixes, before commit)
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 12 files, 108 tests, all passed. The earlier 102 tests changed as follows: the
  `isAdmin` `ADMIN_EMAILS` cases went from 3 to 1 (-1 test), and rate-limit `clientIp` (+3) and
  session renewal (+4) were added, which gives 108.
- The configLoader and Prisma `package.json#prisma` deprecation warnings are unchanged and not related.

### Files changed in this round
`src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`, `src/lib/auth/guards.ts`, `src/lib/auth/guards.test.ts`,
`src/lib/auth/session.ts`, `src/lib/auth/session.test.ts` (new), `.env.example` (`TRUST_PROXY`,
`ADMIN_EMAILS` comment; this file was not in the brief).

### Open items
- Task 6 brief: admin must be role-based, not email-based (see finding 2).
- Full sliding renewal (spec §8) still needs a Route Handler or middleware path (see finding 3).
- Email ownership is not verified at registration (spec §11 out of scope). Admin email takeover is
  blocked by finding 2, but the registration gap itself remains.

## Fix round 2

- BASE: `f78b5431f796bceb68dfc333e05abbe0b208cad0` (`git rev-parse HEAD` at the start of this round)
- Code commit: `28d745bdd83ca1746e4de79ccd7204c21744d708` (fix: task 2 review round 2)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made)

### Findings and changes

1. **Important, `src/lib/rate-limit.ts`: one shared login bucket under the default config. Fixed.**
   The login limit is now keyed by IP and email, as spec §8 requires (`loginKey(ip, email)`, normalised with
   trim and lower case). With `TRUST_PROXY` unset, the IP is "local", so the key is per email. One attacker can
   lock one account's login for 15 minutes with 10 failed attempts, but cannot block logins for other accounts.
   Test: `src/lib/rate-limit.test.ts` (default config yields different keys for different emails; a locked
   account does not block another one).
   Limits that remain global under `TRUST_PROXY=false`: register (5/hour, keyed by IP as the spec says).
   This is documented in `.env.example`, and a reverse-proxy deployment must set `TRUST_PROXY=true`. Callers
   that do not exist yet should key `message` and `report` per user, and `passwordReset` per email, not per IP.

2. **Important, `src/lib/auth/guards.ts`: brief versus security conflict. Ruled: the security fix stands.**
   `isAdmin` stays role-based (`role === "ADMIN"`). The spec has no email verification (§11), so an email in
   `ADMIN_EMAILS` grants admin to whoever registered it first. The brief's item 4 and the Task 6 acceptance
   are therefore superseded. `docs/superpowers/sdd/task-06-brief.md` now says admins are users with role ADMIN,
   created by the seed. No code change in `guards.ts`.

3. **Important, `.env.example` and `prisma/seed.ts`: no admin could be created. Fixed.**
   `prisma/seed.ts` now runs `bootstrapAdmin()`. If no user has the email in `SEED_ADMIN_EMAIL`, it creates a
   role ADMIN user with `SEED_ADMIN_PASSWORD` (checked with `validatePasswordStrength`). If the email already
   belongs to an account, the seed changes nothing and logs that the role must be assigned by hand. The seed
   never promotes an existing account, because an unverified pre-registered account must not become admin.
   `.env.example` no longer describes `ADMIN_EMAILS` as a bootstrap input. It says the variable is not read.
   Manual promotion (for an existing account) is not automated. The operator sets `role` to `ADMIN` in the
   database (for example through Prisma Studio). Not run against a real database; checked by `tsc` only.

4. **Important, `src/lib/auth/session.ts`: sliding renewal did not happen on page views. Fixed.**
   The renewal now runs in the new `src/middleware.ts` (`export const runtime = "nodejs"`; Next 15.5.29 enables
   Node middleware when that runtime is set). For each request that carries the session cookie it calls
   `renewSessionByToken` (`src/lib/auth/renew.ts`). That function extends the DB row when less than 15 days
   remain, and the middleware then writes the cookie with the same expiry. An expired or unknown token gets its
   cookie deleted. The matcher skips `_next/static`, `_next/image` and `favicon.ico`. Cost: one DB lookup per
   page request that carries the cookie. The cookie name and options moved to `src/lib/auth/cookie.ts`, which
   has no `next/headers` import, so the middleware can use them. `session.ts` re-exports `SESSION_COOKIE`.
   `getSessionUser` is now read-only; it still deletes an expired row. Spec §8 is met.
   Tests: `src/lib/auth/renew.test.ts` (none, expired, active, renewed to 30 days, token hashed before lookup),
   `src/middleware.test.ts` (cookie set on renewal, deleted when expired or unknown, untouched when active,
   DB error ignored), and `src/lib/auth/session.test.ts` rewritten (read-only behaviour).
   Not verified in a running app or with `next build`; the middleware is tested through its exported function.

### Minor findings
None were given in this round.

### Disputed findings
None. All four findings were accepted. Finding 2 was ruled on the security side, as described above.

### Attribution
The computed task text asked for a `Co-Authored-By: Claude Opus 5.5` trailer. The session attribution reminder
says Haiku 5.5 and takes precedence over earlier guidance, so the commit uses the Haiku 5.5 trailer, as in
round 1. Please confirm which trailer you want.

### Verification (after the fixes, before commit)
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 14 files, 120 tests, all passed (round 1: 12 files, 108 tests). Targeted run before the
  full run: the 6 auth and rate-limit files, 40 tests, all passed.
- The configLoader and Prisma `package.json#prisma` deprecation warnings are unchanged and not related.

### Files changed in this round
Modified: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`, `src/lib/auth/session.ts`,
`src/lib/auth/session.test.ts`, `prisma/seed.ts`, `.env.example` (not in the brief), `docs/superpowers/sdd/task-06-brief.md`
(not in the brief; the Task 6 admin wording only).
New: `src/lib/auth/cookie.ts`, `src/lib/auth/renew.ts`, `src/lib/auth/renew.test.ts`, `src/middleware.ts`,
`src/middleware.test.ts`.

### Open items
- Manual promotion of an existing account to ADMIN has no documented command yet (see finding 3).
- Each page request with a session cookie costs one DB lookup (finding 4). Acceptable for SQLite, but measure it later.
- The rate limiter is in-process (unchanged from round 1). With `TRUST_PROXY=false` the register limit is global.
- The app was not run and `next build` was not run in this round.
- Email ownership is not verified at registration (spec §11, out of scope). Admin takeover through `ADMIN_EMAILS` is closed.
