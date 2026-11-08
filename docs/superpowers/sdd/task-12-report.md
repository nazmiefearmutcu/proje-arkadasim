# Task 12 report: Seed data, README, final build health

- BASE: `bf337adbc17d4dafa54c8b83596cc5332f507130` (`git rev-parse HEAD` before any change, branch `main`)
- Code commit: `ff94f52352f2af48130f5c22d7bbfb3c0dbee5ae` (feat: seed data, README and build health)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made, given in the final reply)

## What was built

### `prisma/seed.ts` (run with `npm run seed`)
- Loads `.env` with `process.loadEnvFile()` (guarded by try/catch), then runs `seedProblem()` from `src/lib/seed-guard.ts`.
  The seed refuses `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`. Both seed passwords are checked with `validatePasswordStrength`.
- Passwords come only from `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`. They are hashed once per role with `hashPassword` and never printed.
- One interactive transaction (120 s timeout): wipe all tables in FK-safe order, then repopulate. Re-running is idempotent; a failure rolls back everything.
- Admin: `SEED_ADMIN_EMAIL`, username `yonetici`, role ADMIN, VERIFIED, "Proje Yönetimi".
- 16 VERIFIED users, one per university from the brief (ODTÜ, İTÜ, Boğaziçi, Hacettepe, Ege, Dokuz Eylül, Bilkent, Yıldız Teknik, Ankara, Marmara, Erciyes, Karadeniz Teknik, Anadolu, Gazi, Çukurova, Atatürk). Each has a department, which maps to one of the 12 discipline groups through `disciplineGroupForDepartment` (the seed throws if a mapping is missing). All 12 groups are covered. Mix of STUDENT (classYear 2–4) and GRADUATE (graduationYear 2019–2025), degree levels LISANS and YUKSEK_LISANS, first-person bios, 2–4 skills and interests from the brief's list, 9 cities, and 7 users with `lookingForProject: true`.
- Each VERIFIED user has an APPROVED `VerificationAttempt` (PDF_TEXT, aiUsed, aiModel "seed", confidence 0.95, random HMAC-shaped docHash, `extractedJson` with education fields only), and consent rows PRIVACY_NOTICE and TERMS plus CROSS_BORDER_AI (granted for 15 of 16).
- 1 UNVERIFIED user `yeni.kullanici` (no attempt) and 1 MANUAL_REVIEW user `oguz.tuna` with a MANUAL_REVIEW attempt. Its `maskedText` is a masked sample containing `[AD SOYAD]` and `[TCKN]`, with `maskedTextExpiresAt` 30 days out.
- Follows: each VERIFIED user follows 3–6 others (63 rows, several mutual pairs).
- 12 projects (2 CLOSED) with 2–3 roles each, owner `ProjectMember` (isOwner), 5 accepted members, 3 pending join requests (`nazli.bozkurt`, `ozge.karaca`, `emre.ozturk`), and 3 pending invites (one to the demo user, one to `ayse.kaya`, one to `nazli.bozkurt`). Descriptions are 3 paragraphs each. Project `searchText` is computed with the same rules as `projectSearchText` in `src/lib/projects/actions.ts`, which is not exported because that file is a `'use server'` module.
- Conversations: one ACTIVE between mutual followers `ayse.kaya` and `mert.demir` with 6 messages, and one REQUEST from `deniz.aksoy` (not a follower) to the demo user with 1 message.
- Notifications: 8 rows. The demo user has 4 unread (FOLLOW, MESSAGE_REQUEST, INVITE, NEW_PROJECT_FROM_FOLLOWING) and 1 read VERIFICATION_RESULT. Others have JOIN_REQUEST and JOIN_ACCEPTED rows.
- One OPEN report (PROJECT target, reporter `nazli.bozkurt`).
- Summary output: counts, and the admin and demo login emails. Passwords are not printed; the output points to `.env.example`.

**Demo user: Elif Yılmaz, `elif.yilmaz@ornek.edu.tr`** (İşletme, Ege Üniversitesi, owns project "Üniversite öğrencileri için ikinci el ders kitabı pazarı", receives the pending invite and the notifications). Admin login: `admin@proje-arkadasim.local`. Passwords come from `.env.example`.

### `README.md` (new, Turkish)
Sections in brief order: what the app is, features, stack, installation (Node 24, `.env.example` copy, secret generation command, `prisma migrate dev`, `npm run seed`, `npm run dev`), demo accounts, full environment variable table, document verification pipeline (spec §5.1 in plain Turkish, masking list, mock vs DeepSeek, `VERIFIER_PROVIDER`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, "AI never approves on error" rule, §5.3 known limitation), KVKK measures (§6.2), pre-production checklist (§6.3, including the DeepSeek/China risk and the lawyer review), commands table (`dev`, `build`, `start`, `lint`, `test`, `test:watch`, `seed`, `purge`, `db:migrate`, `db:reset`), project tree, PostgreSQL switch steps, and tests.

### `.env.example` (comment only)
The comment on `DATABASE_URL` said the path is relative to the project root. Prisma resolves it relative to `prisma/` (confirmed with `prisma migrate status`: the file is `prisma/dev.db`, and no root `dev.db` exists). The comment now says so, to match the README.

## Integration checks (no code fixes were needed)
- **Chat overflow (task 9):** already wired. `src/components/messaging/chat.tsx` renders the Sheet with `BlockButton` and "Şikayet et" (`ReportSheet`, targetType USER). A blocked conversation disables the composer through `composerRule`.
- **Search people (task 10):** already has `FollowButton` in `src/app/(app)/ara/page.tsx` (PeopleResults).
- **Profile and Network:** `ProfileActions` (block, report, follow) and Network use `FollowButton` as well.
- **Build:** `npm run build` passes on the unmodified base (`bf337ad`) and on HEAD. The only warning is the pre-existing `unpdf` `import.meta` notice.

No files outside `prisma/seed.ts`, `README.md` and `.env.example` were touched.

## Decisions (where the brief was silent)
1. **Demo user:** `elif.yilmaz`, documented here and in the README, as the brief's example username.
2. **Full wipe:** the seed deletes every row before repopulating. This is what "idempotent: wipe all tables first" requires. It is dev-only; the production guard stays in place. The earlier `bootstrapAdmin` logic (which refused to promote existing accounts) is replaced, because the wipe leaves no existing accounts to protect.
3. **Password hashes:** scrypt is run once for the admin password and once for the shared user password. All seeded users share one hash, which is acceptable for dev seed data.
4. **Consent for one user:** `ece.polat` has a CROSS_BORDER_AI row with `granted: false`, so the "most users" rule of the brief is met (15 of 16 granted).
5. **User searchText:** includes city, to match the settings action (`src/lib/settings/actions.ts`), and the verification service includes university, faculty, department, skills and interests.
6. **Pending invite to the demo user** is from `zeynep.arslan` for role "İş geliştirme uzmanı" (business role on a design project), which gives the demo user a reason to be invited.
7. **Report target:** PROJECT, so the admin queue shows a project target as well as a user.

## Test summary
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 51 files, 477 tests, all passed (exit 0). No test files were added; the seed is covered by the manual checks below.
- `npm run build`: exit 0 on HEAD.
- Seed, fresh database: `DATABASE_URL` pointed at a scratch SQLite file in the session scratchpad (not `prisma/dev.db`). `prisma migrate deploy` applied all migrations; `npm run seed` completed (19 users, 12 projects, 30 roles, 17 members, 3 join requests, 3 invites, 63 follows, 2 conversations with 7 messages, 8 notifications, 1 report).
- Seed, re-run: completes again with the same counts (idempotent).
- Production guard: `NODE_ENV=production npm run seed` exits 1 with the Turkish refusal message and writes nothing.
- Password check: the admin password from `.env.example` verifies against the stored admin hash, a wrong password is rejected, and the demo user's `SEED_USER_PASSWORD` verifies.
- Smoke test: `next start` against the scratch database returned 200 for `/`, `/projeler` (seeded project titles listed), `/ara?q=sulama` (project card listed), `/giris` and `/paylas` (guest). The guest view shows "Elif Y." (surname initial only). Project detail pages and the authenticated flows were not exercised. The server was stopped afterwards.
- `npm run db:reset`: **not executed**. Prisma 6.19 blocks `prisma migrate reset` when run by an AI agent and asks for explicit user consent. I did not bypass that guard. The equivalent fresh-database path was verified instead: delete the scratch file, `prisma migrate deploy`, `npm run seed`. The user should run `npm run db:reset` followed by `npm run seed` locally.

## Concerns
- **`npm run db:reset` is unverified by an agent run** (see above). It works with a normal terminal.
- **Commit trailer conflict:** the task text asks for `Co-Authored-By: Claude Opus 5.5`. The session attribution reminder asks for `Claude Haiku 5.5`, and this model is Haiku 5.5. I used the Haiku trailer, as tasks 7–10 did. The orchestrator should confirm which is wanted.
- **`SESSION_SECRET` is unused:** `.env.example` lists it and the brief asks for it, but no code reads it. Sessions use random tokens stored hashed. The README says so. Decide whether to remove the variable or wire it in.
- **Browser check not done:** the smoke test was HTTP only. Layout at 375 px, the sheets, and the follow and invite flows still need a manual browser pass.
- **No unit tests for the seed.** Its data invariants (discipline mapping, follow counts, project role slots) are checked only by the manual runs above.
- **PostgreSQL migrations:** the README says to create a new initial migration after switching providers, because the existing migrations are SQLite SQL. This was not tested against PostgreSQL.
- **Seed wipes everything:** the only protection is the production guard. The README warns about it in the commands table.
- **Deferred from ledger (final review):** the `AdminAuditLog.adminId` SetNull parking note and the "dev mail log prints recipient email" note are unchanged by this task.
