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
