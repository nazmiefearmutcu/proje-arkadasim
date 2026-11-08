# Task 2 — Auth core, security helpers, notifications, permissions

Read `docs/superpowers/sdd/global-constraints.md` first. Spec sections: §2 (permissions), §4.7 (messaging rules), §4.8 (notification types), §6.2 (security), §8 (auth, rate limits).
Task 1 delivered: Prisma schema (all models), `src/lib/db.ts`, `src/lib/tr.ts`, `src/lib/json-fields.ts`, `src/lib/action-result.ts`, `src/config/taxonomy.ts`, `src/config/legal.ts`, test helpers in `tests/helpers/db.ts`. Read the schema before you start.

No UI in this task.

## Files to create
1. `src/lib/auth/password.ts`
   - `hashPassword(password: string): Promise<string>` using Node `crypto.scrypt` (N=16384, r=8, p=1, keylen 64, 16-byte random salt). Format: `scrypt$16384$8$1$<saltB64>$<hashB64>`.
   - `verifyPassword(password: string, stored: string): Promise<boolean>` — parses params from the string, `crypto.timingSafeEqual`, returns false on malformed input (never throws).
   - `validatePasswordStrength(pw): string | null` — null if OK; Turkish error if < 10 chars or > 128 chars or no letter or no digit.
2. `src/lib/auth/tokens.ts` — `generateToken(bytes = 32): string` (base64url), `hashToken(token): string` (SHA-256 hex).
3. `src/lib/auth/session.ts`
   - `SESSION_COOKIE = "pa_session"`.
   - `createSession(userId: string): Promise<void>` — token via generateToken, store `tokenHash`, `expiresAt = now + SESSION_DAYS`, userAgent from `headers()` (truncate 200). Set cookie: httpOnly, sameSite "lax", path "/", secure when `NODE_ENV === "production"`, expires = expiresAt.
   - `getSessionUser()` wrapped in React `cache()` — reads cookie, looks up session by hash, rejects expired (and deletes it), returns `{ sessionId, user }` with the user selected via the `currentUserSelect` object (see guards). Sliding renewal: if less than 15 days remain, extend expiry and re-set cookie — but cookie writes are only allowed in Server Actions / Route Handlers, so wrap the cookie re-set in try/catch and ignore failures in Server Components (DB expiry is still extended).
   - `destroySession(): Promise<void>` — deletes DB row and cookie.
   - `destroyAllSessionsForUser(userId)`.
4. `src/lib/auth/guards.ts`
   - `export const currentUserSelect` — Prisma select with: id, email, firstName, lastName, username, avatarPath, role, verificationStatus, academicStatus, university, faculty, department, disciplineGroup, degreeLevel, classYear, graduationYear, city, skillsJson, interestsJson, lookingForProject, createdAt. Export `type CurrentUser`.
   - `getCurrentUser(): Promise<CurrentUser | null>`.
   - `isVerified(user)`, `isAdmin(user)` — SUPERSEDED (ruling in fix round 2 of task-02-report.md, kept in fix round 3): `isAdmin` is role-only (`role === "ADMIN"`). `ADMIN_EMAILS` grants nothing, because email ownership is not verified (spec §11) and the spec defines role as USER|ADMIN (spec line 234). Admins are created by the seed or set by an operator.
   - `requireUser(next?: string)` → redirect to `/giris?next=<encoded>` when no user.
   - `requireVerified(next?: string)` → requireUser, then redirect `/dogrulama` when not verified.
   - `requireAdmin()` → `notFound()` unless admin.
   - `safeNextPath(next: string | null | undefined, fallback = "/"): string` — only allows paths starting with a single "/" (reject "//", "/\\", absolute URLs, control chars).
5. `src/lib/auth/actions.ts` (`'use server'`) — `logoutAction()`: destroySession then redirect("/").
6. `src/lib/rate-limit.ts` — in-memory fixed-window limiter: `rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number }`; Map stored on globalThis; prune expired keys opportunistically. Export presets: `LIMITS = { login: [10, 15*60_000], register: [5, 60*60_000], message: [30, 60_000], passwordReset: [3, 60*60_000], report: [10, 60*60_000] }`. Helper `clientIp(): Promise<string>` reading `x-forwarded-for` first value or `x-real-ip`, fallback "local".
7. `src/lib/origin.ts` — `assertSameOrigin(req: Request): void` throws `Response` (403 JSON `{error}`) if `Origin` header exists and its host differs from the request host (`Host` / `x-forwarded-host`). Also export `isSameOrigin(req): boolean`.
8. `src/lib/mailer.ts` — `sendMail({ to, subject, text }): Promise<void>`: if `SMTP_URL` set → nodemailer transport (`createTransport(process.env.SMTP_URL)`), from `MAIL_FROM`; else in development `console.info` the subject and recipient and the text (text may contain a reset link — acceptable in dev only); in production without SMTP throw an Error("SMTP yapılandırılmamış").
9. `src/lib/notify.ts`
   - `export type NotificationType = "FOLLOW" | "JOIN_REQUEST" | "JOIN_ACCEPTED" | "JOIN_REJECTED" | "INVITE" | "INVITE_ACCEPTED" | "INVITE_DECLINED" | "MESSAGE_REQUEST" | "MESSAGE_REQUEST_ACCEPTED" | "VERIFICATION_RESULT" | "INTRODUCTION" | "NEW_PROJECT_FROM_FOLLOWING"`.
   - `notify(input: { userId; type; actorId?; projectId?; conversationId?; data?: Record<string, unknown> }): Promise<void>` — skip when `actorId === userId`; skip when either user blocks the other (check Block both directions) for actor-based types; create Notification with `dataJson`.
   - `notifyMany(userIds: string[], input without userId)` — uses createMany, filtering self and blocked.
10. `src/lib/permissions.ts`
   - `displayName(person: { firstName; lastName }, viewer: { verificationStatus } | null): string` — full "Ad Soyad" for verified viewers, otherwise "Ad S." (first letter of each last-name part uppercased with tr-TR locale: "Ayşe Nur Kılıç Öztürk" → "Ayşe Nur K. Ö.").
   - `fullName(person)`.
   - `isBlockedEitherWay(aId, bId): Promise<boolean>`.
   - `areMutualFollowers(aId, bId): Promise<boolean>`.
   - `shareAProject(aId, bId): Promise<boolean>` — both are ProjectMember of the same project.
   - `canMessageDirectly(aId, bId): Promise<boolean>` — not blocked and (mutual followers or share a project).
11. `src/lib/consent.ts`
   - `export type ConsentType = "PRIVACY_NOTICE" | "TERMS" | "CROSS_BORDER_AI"`.
   - `recordConsent(userId, type, granted: boolean, version = LEGAL_VERSION)` — append-only row.
   - `hasActiveConsent(userId, type): Promise<boolean>` — latest row for that type is granted.

## Tests (Vitest; DB tests use `tests/helpers/db.ts`, call `resetDb()` in beforeEach)
- `src/lib/auth/password.test.ts`: hash/verify roundtrip, wrong password false, malformed stored string false, two hashes of same password differ, strength rules.
- `src/lib/auth/guards.test.ts`: `safeNextPath` cases ("/projeler" ok, "//evil.com" → fallback, "https://x" → fallback, "/\\evil" → fallback, undefined → fallback); `isAdmin` role-only (an `ADMIN_EMAILS` entry must NOT grant admin; superseded brief case).
- `src/lib/rate-limit.test.ts`: allows up to limit, blocks after, resets after window (use `vi.useFakeTimers`).
- `src/lib/permissions.test.ts`: displayName variants; canMessageDirectly true for mutual follow, true for shared project, false for one-way follow, false when blocked even if mutual.
- `src/lib/notify.test.ts`: self-notification skipped; blocked actor skipped; normal creates a row with dataJson.
- `src/lib/consent.test.ts`: latest row wins.
Session functions use `next/headers`; you may skip unit-testing them, but keep their logic small. If you test them, mock `next/headers`.

## Done when
All files exist with the exact exported names above, checks pass, committed, report written.
