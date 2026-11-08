# Task 1 report: Data foundation (Prisma schema, core libs, taxonomy, test infra)

- BASE: `b0b4da1f3e083008070093296d3d27ad50ae4cad`
- Code commit: `787c45782b363fde9b864f6827119440ae2b7a8d` (feat: data foundation ...)
- HEAD: the commit that adds this report (`git rev-parse HEAD`)

## What was built

### Prisma
- `prisma/schema.prisma`: all spec §7 models (User, Session, PasswordResetToken, LoginEvent, Consent,
  VerificationAttempt, Project, ProjectRole, ProjectMember, JoinRequest, ProjectInvite, Follow,
  Introduction, Conversation, ConversationRead, Message, Notification, Block, Report, AdminAuditLog).
  Conventions from the brief: cuid ids, String enum-like fields with defaults, `*Json` list/object
  columns, `searchText` on User and Project with an index, cascade on User relations, SetNull on
  `ProjectMember/JoinRequest/ProjectInvite.roleId` and `VerificationAttempt.reviewedById`, named
  relations where models repeat, composite keys, the listed uniques and indexes.
- `prisma/migrations/20261108001445_init`: applied with `prisma migrate dev --name init`.
- `prisma/seed.ts` and `scripts/purge.ts`: placeholders that only log the Turkish messages.
- `.env` (gitignored) with random 32-byte hex `SESSION_SECRET` and `DOC_HASH_PEPPER`.
- `.env.example` (committed) with every variable from the brief, each commented in Turkish.
- `.gitignore`: added an explicit `.env` line. `*.db`, `*.db-journal`, `/storage` were already present.
- `package.json`: scripts `db:migrate`, `db:reset`, `test`, `test:watch`, `seed`, `purge`, `postinstall`
  (`prisma generate`), and the `prisma.seed` key.

### Libraries
- `src/lib/db.ts`: PrismaClient singleton cached on `globalThis` outside production.
- `src/lib/tr.ts`: `foldTr`, `toSearchText`, `searchTokens`.
- `src/lib/json-fields.ts`: `parseList`, `toListJson`, `parseObject`.
- `src/lib/action-result.ts`: `ActionResult`, `ok`, `fail`, `zodFieldErrors`.

### Config
- `src/config/taxonomy.ts`: CATEGORIES, STAGES, WORK_MODES, ACADEMIC_STATUSES, DEGREE_LEVELS,
  VERIFICATION_STATUSES, DISCIPLINE_GROUPS (12 groups with label, color, keywords, complements),
  `disciplineGroupForDepartment`, `getDisciplineGroup`, `isDisciplineGroupId`, CITIES (81), `labelOf`.
- `src/config/legal.ts`: LEGAL_VERSION, LEGAL (bracketed operator placeholders), AI_PROVIDER,
  retention constants.

### Test infrastructure
- `vitest.config.ts`: node environment, `@` alias, `DATABASE_URL=file:./test.db`, globalSetup,
  `fileParallelism: false`, includes `src/**` and `tests/**`.
- `tests/global-setup.ts`: deletes the test DB file and runs `prisma db push` (see deviation 1).
- `tests/helpers/db.ts`: `resetDb()` (FK-safe order inside one transaction) and `createUser()`.
- Tests: `src/lib/tr.test.ts`, `src/lib/json-fields.test.ts`, `src/config/taxonomy.test.ts`,
  `tests/db.test.ts` (cascade on user delete).

## Deviations and decisions

1. Test DB setup does not use `prisma db push --force-reset`. Prisma's guard refused it: it detected
   the agent invocation and asked for explicit user consent. I did not bypass it. The setup now
   deletes `prisma/test.db` (plus journal/wal) and runs `prisma db push --skip-generate` on the
   fresh file. This is the same result, with no reset flag. The file is a local test DB and the
   setup only touches that file.
2. `foldTr` first applies NFD normalisation and strips combining marks, so decomposed input
   such as `İ` works. It also maps `ê→e` and `ô→o` in addition to the brief's list. These are
   extra mappings for foreign names and are not covered by a brief case.
3. Discipline keywords use stems where the brief hints at suffix variation: `endustri muhendis`,
   `yonetim muhendis`, `ogretmen`. Added `dishekimligi` as a one-token alias for `Dişhekimliği`
   written without a space, which the two-token `dis hekimligi` does not match.
4. `labelOf(list, value)` returns the value itself when no option matches.
5. `zodFieldErrors` uses the key `_form` for root-level issues. Otherwise it uses the dotted path.
6. `AdminAuditLog.targetUserId` is a real relation with Cascade, following the brief's rule that all
   relations to User cascade. Deleting a target user also deletes its audit rows. Revisit this in the
   audit task if the trail should outlive the user.
7. `User.lookingForProject` is Boolean, default false. The spec does not give its type.
8. `Project.description` and `Project.summary` are plain String fields. Length limits are enforced
   later, in the zod layer.
9. Attribution: the commit trailer uses `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`,
   not the Opus 5.5 line in the task text. The harness attribution reminder specifies Haiku 5.5 and
   replaces earlier guidance.
10. The brief says `vitest.config.ts` and the file has ESM syntax, but `package.json` has no
    `"type": "module"`. Vitest prints a configLoader warning. Tests pass, so I left it.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 4 files, 51 tests, all passed.
- `prisma migrate dev --name init` applied cleanly. The migration folder is `20261108001445_init`.
- `git check-ignore`: `.env`, `prisma/dev.db` and `prisma/test.db` are ignored. `.env.example` is tracked.

## Concerns

- `prisma` and `vitest` print deprecation or configLoader warnings. Neither blocks the run.
  Migrating to `prisma.config.ts` is a later decision.
- `prisma/dev.db` exists locally from the migrate run. It is gitignored and was not committed.
- The `DISCIPLINE_GROUPS` mapping is keyword-based. Departments that match no keyword return `null`,
  so the UI needs a manual choice fallback.
