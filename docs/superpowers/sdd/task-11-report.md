# Task 11 report: Settings, avatar upload, KVKK rights, purge

- BASE: `84d853723513ee00b181f219c1e87fa2ba47b0ed` (branch point from main, merge of task 5)
- Implementation HEAD: `3e9348f3be8b7854f81eea7ad15d774bd8880c74` (`feat: settings, avatar upload, KVKK rights and purge`)
- Branch: `task-11` (worktree `proje-arkadasim-wt/t11`)

This file was missing from the worktree at review time. The summary below is reconstructed from the
implementation commit and the brief so that the report requirement is met.

## What was built (implementation commit 3e9348f)

- Avatar: `src/lib/avatar-storage.ts` (2 MB cap, JPEG/PNG/WebP by magic bytes, `<userId>-<8 hex>.<ext>`,
  previous file removed, traversal names rejected, `AVATAR_DIR` env override for tests),
  `src/app/api/avatar/route.ts` (POST upload, DELETE remove), `src/app/api/avatar/[file]/route.ts` (GET with
  immutable cache and nosniff).
- `/ayarlar` (`src/app/(app)/ayarlar/`): in-page section links; Profil (avatar field, bio counter, city,
  skill and interest chip inputs, "Proje arıyorum" switch, education fields for verified users); Şifre;
  Gizlilik ve KVKK (AI consent panel, "Verilerimi indir", legal links); Hesabı sil (password and username
  confirmation).
- Server actions in `src/lib/settings/actions.ts` with validation in `validation.ts` and limits in `limits.ts`:
  `updateProfileAction`, `changePasswordAction` (keeps only the current session), `grantAiConsentAction`,
  `withdrawAiConsentAction` (writes a `granted=false` row), `deleteAccountAction` (password, username,
  avatar removal, cascade delete, redirect to `/?hesap=silindi`).
- Export: `src/app/api/me/export/route.ts` and `src/lib/account-export.ts`. Excludes `passwordHash`,
  `docHash` and `maskedText`; login events limited to the last 100; `exportedAt` and Turkish `notes`.
- Purge: `src/lib/purge.ts` (`runPurge`, `maybeRunPurge` once per hour per process, never throws),
  called from `src/app/api/me/counters/route.ts` after the response is built. `scripts/purge.ts` backs
  `npm run purge`.
- Home page shows a status notice for `?hesap=silindi`.
- `src/lib/auth/session.ts` gained `getCurrentSessionId()`.

Tests added: `src/lib/settings/actions.test.ts`, `tests/export-route.test.ts`,
`src/lib/avatar-storage.test.ts`, `src/lib/purge.test.ts`.

## Fix round 1

### Findings addressed

1. **Important: report missing.** Fixed. This file now exists with BASE, implementation HEAD, what was
   built, and this section.

### Spec and brief gaps checked

- Brief §2.3 says the inactive AI consent state shows a **"Rıza ver"** button linking to `/kvkk/acik-riza`.
  The panel showed "Açık rıza metnini oku" on that link. Fixed: the link now reads "Rıza ver". The target
  is unchanged and the grant form below it is unchanged.
- Re-checked against the spec and brief, with no defect found: export exclusions (`docHash`, `maskedText`,
  `passwordHash`), avatar name pattern and traversal rejection, purge categories and the one-per-hour guard,
  password change keeping only the current session, delete cascade and redirect, consent withdrawal
  writing a new row, and the "24 saat" consent-panel copy (sourced from task-04 and task-05 briefs).

### Findings disputed

None.

### Not changed (by ruling)

- `AdminAuditLog` and `Report` SetNull behaviour: parked for the final review per the orchestrator ruling.
- Schema is unchanged. No dependencies were added.

### Commit trailer

The computed task asked for `Co-Authored-By: Claude Opus 5.5`. The session attribution reminder asks for
`Co-Authored-By: Claude Haiku 5.5`. This commit uses the Haiku trailer because it comes from the session
attribution instruction. If the Opus trailer is required, amend the trailer on this commit only.

### Test results

- `npx tsc --noEmit`: exit 0, no output.
- `npm run lint`: exit 0, no output.
- `npx vitest run` (full suite, run before the one-line label change): 30 files, 259 tests, all passing.
  The label change is a string literal in JSX that no test references. tsc and lint were re-run after it.

### BASE and HEAD for this round

- Fix round BASE: `3e9348f3be8b7854f81eea7ad15d774bd8880c74`
- Fix round HEAD: the commit that adds this section (`git rev-parse HEAD` after commit)
