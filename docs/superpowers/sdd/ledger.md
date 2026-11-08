# SDD ledger — plan: docs/superpowers/plans/2026-11-08-proje-arkadasim-plan.md

## Rulings
- Ruling: Task 0 (scaffold) done by the orchestrator, not a subagent — purely mechanical commands; versions verified directly (next 15.5.29, prisma 6.19.3, zod 4.6.7, openai 7.53, vitest 5.1) — cost if wrong: none beyond a re-scaffold.
- Ruling: Implementers and per-task reviewers run on Haiku, fix rounds 4–5 and the final review on Opus — the user's global CLAUDE.md requires Haiku first and bans Sonnet — cost if wrong: more fix rounds on hard tasks.
- Ruling: Workflow agents cannot be "resumed", so fix rounds 1–3 dispatch a fresh Haiku implementer that reads the brief, the report file and the findings — keeps the SDD loop deterministic inside the Workflow tool — cost if wrong: slightly more context re-reading per round.
- Ruling: The reviewer generates its own review package with git (`git log`/`git diff BASE..HEAD` into a file) instead of the orchestrator pasting diffs — keeps orchestrator context small — cost if wrong: none; same content.
- Ruling: Added a `/yardim` help page (task 4) because spec §3.1's avatar menu lists "Yardım" while §3.2 had no route — cost if wrong: one small static page.
- Ruling: Seeded demo passwords live in `.env.example` (SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD) and never in chat — local development values only — cost if wrong: user must change them before any deployment (README says so).
- Ruling: Task 1 test setup keeps `prisma db push --skip-generate` without `--force-reset` — Prisma 6.19 blocks force-reset for AI agents without explicit user consent, test.db is a throwaway file and resetDb() clears rows per test; 5 fix rounds were spent because the old loop had no "needs decision" exit — cost if wrong: a drifted test.db must be deleted by hand once.
- Ruling: AdminAuditLog.adminId stays onDelete SetNull exactly as spec §7 — admin deletion is rare and the log keeps the action; parked for the final review (an actor snapshot column would need a migration) — cost if wrong: an audit row may lose its actor after an admin account is deleted.
- Ruling: isAdmin is role-only; ADMIN_EMAILS grants nothing (email ownership is unverified, spec §11); task-02 and task-06 briefs updated — cost if wrong: an operator must promote an admin in the DB instead of via env.
- Ruling: The seed refuses NODE_ENV=production unless SEED_ALLOW_PRODUCTION=true and in production refuses the published example admin password; in development the .env.example password works so `npm run seed` runs out of the box — cost if wrong: none for local dev; operators must set their own password in production.
- Ruling: Sliding session renewal lives in src/middleware.ts (Node runtime) because Server Components cannot write cookies — cost if wrong: one session lookup per page request.
- Ruling: Commit trailer stays "Co-Authored-By: Claude Opus 5.5" per the session attribution reminder, even on Haiku-authored commits — cost if wrong: cosmetic attribution only.
- Ruling: On the user's request ("paralelizasyonu maksimize et"), the SDD "never parallel implementers" rule is overridden: each task runs in its own git worktree (../proje-arkadasim-wt/tNN, shared node_modules junction, schema frozen), starts when its dependencies are merged, and a serialized merge agent merges into main and re-runs tsc/lint/vitest. Dependency graph: 3,5 now; 4,7,9 after 3; 6,11 after 3+5; 8,10 after 7 (10 merges after 8 and wires the follow button); 12 last in main — cost if wrong: merge conflicts in shared files, resolved by the merge agent or the final fix wave.
- Ruling: Tasks 9 and 10 run without task 8's social components (report/block, follow button); the task 10 merge step and task 12 wire them in afterwards — cost if wrong: a missing follow/report entry point caught by the final review.
- Ruling: The fix loop now skips findings marked planMandated/needsDecision and stops when a fix round returns BLOCKED; those go to the orchestrator — cost if wrong: a real defect waits for the final review instead of a fix round.

- Ruling: Haiku-authored commits keep their "Claude Haiku 5.5" trailer (the subagents' own harness reminder named Haiku); merged history is not rewritten, and orchestrator commits use Opus 5.5 — cost if wrong: cosmetic attribution only.
- Ruling (task 4 decision): in development only (NODE_ENV !== "production" and SMTP_URL empty) the console mailer prints the password-reset URL unredacted so the reset flow can be tested locally; production never logs tokens — the one exception to "never log tokens" — cost if wrong: a short-lived reset token appears in a developer's own terminal.
- Ruling (task 7 decision): the owner's university stays visible to everyone (spec §4.4 card lists it); for guests and unverified viewers the team list uses the owner's "Ad S." masking, hides department and has no profile links (spec §2, §3.2) — cost if wrong: guests see less about the team.
- Ruling (task 3): focus suggestions render as chips because spec §3.1 says "öneri çipleri" (the spec beats the brief's rows) — cost if wrong: a small UI change.
- Ruling (task 3/10): suggestionToQuery keeps the original casing because search folds case and Turkish letters (spec §4.9) — cost if wrong: none.
- Ruling (task 5): production with VERIFIER_PROVIDER=mock must fail at startup (spec §5.2) through src/instrumentation.ts, and the service's MANUAL_REVIEW fallback stays as a second line — cost if wrong: a misconfigured deploy refuses to start (intended).
- Ruling (task 6): every AI-consent text (registration, /dogrulama, /ayarlar) uses the spec §4.1 wording naming DeepSeek and China, from one shared constant — informed explicit consent must name the recipient country — cost if wrong: none.
- Ruling (task 6): the /dogrulama privacy note keeps the truthful wording (masked text kept up to 30 days for manual review) instead of the brief's "hiçbir yere kaydedilmez" — spec §5.1/§6.1 — cost if wrong: none.
- Ruling (task 6): an admin cannot approve or reject their own verification attempt — cost if wrong: a single-admin install needs a second admin for its own attempt (the seeded admin is already VERIFIED).
- Ruling (task 9): chat bubbles keep the brief's 18 px radius as a design-system exception — cost if wrong: cosmetic.
- Ruling (task 9): the message poll must not drop same-millisecond messages, so the cursor uses createdAt >= after with id de-duplication — cost if wrong: negligible.
- Ruling (task 11): avatar GET keeps immutable caching because every upload gets a new random filename and a deleted avatar is no longer referenced — cost if wrong: a viewer who already loaded a deleted photo can still see it in their own browser cache.
- Ruling (task 12): SESSION_SECRET and ADMIN_EMAILS are removed from .env.example and README because no code reads them — cost if wrong: none.
- Ruling (task 3): the --font-geologica variable name is accepted (avoids a CSS variable cycle) — cost if wrong: none.
- Ruling: the final review runs as a workflow — 8 Opus reviewers with different lenses plus an Opus minors-triage agent; every Critical/Important finding is checked by two Haiku skeptics with an Opus tie-break; the single fix wave runs as parallel Opus fixers on disjoint file sets in worktrees with serialized merges, then exactly one scoped re-review per packet — the user asked for maximum parallelism and the fix wave has no second chance — cost if wrong: extra tokens.
- Ruling: rulings and deferred Minors for the final review are collected in docs/superpowers/sdd/final-review-input.md — cost if wrong: none.

## Tasks
- Task 1 — brief docs/superpowers/sdd/task-01-brief.md, report docs/superpowers/sdd/task-01-report.md, base b0b4da1, head ad55bad, fix rounds 5; remaining findings were the two ruled items above. Task 1: complete.
- Task 2 — brief docs/superpowers/sdd/task-02-brief.md, report docs/superpowers/sdd/task-02-report.md, base ad55bad, head e3eda5e, fix rounds 3 (round 3 finished by the orchestrator). Task 2: complete.
  - Minor (deferred to final review): seed admin username "yonetici" clash; renewCookie catch breadth; x-real-ip fallback with TRUST_PROXY; dev mail log prints recipient email; isSameOrigin header precedence; register limit global when TRUST_PROXY=false.
- Task 3 — brief docs/superpowers/sdd/task-03-brief.md, report task-03-report.md, base e3eda5e, head 36f88ed, fix rounds 1, review CLEAN, merged a15fa00. Task 3: complete. Minors → final-review-input.md §C.
- Task 5 — brief task-05-brief.md, report task-05-report.md, base e3eda5e, head 6000b64, fix rounds 2, review CLEAN, merged 84d8537. Task 5: complete. Decision (mock in production) → Ruling R4.
- Task 4 — brief task-04-brief.md, report task-04-report.md, base a15fa00, head 7e0d4db, fix rounds 2, review NEEDS_FIXES with one decision finding (dev reset link) → Ruling R1; merged f9f4df5. Task 4: complete.
- Task 7 — brief task-07-brief.md, report task-07-report.md, base a15fa00, head a44e972, fix rounds 0 (the only Important finding was a plan-mandated decision) → Ruling R2; merged 8f6ac33. Task 7: complete.
- Task 9 — brief task-09-brief.md, report task-09-report.md, base a15fa00, head 0a00ef9, fix rounds 2, review CLEAN, merged 9917e99. Task 9: complete.
- Task 6 — brief task-06-brief.md, report task-06-report.md, base 84d8537, head 2002cdb, fix rounds 1, review CLEAN, merged a67e35e. Task 6: complete. Decisions → Rulings R5, R6.
- Task 11 — brief task-11-brief.md, report task-11-report.md, base 84d8537, head 10b78fd, fix rounds 1, review CLEAN, merged 1530756. Task 11: complete.
- Task 8 — brief task-08-brief.md, report task-08-report.md, base 8f6ac33, head 4e8961e, fix rounds 0, review CLEAN, merged d8a5acf. Task 8: complete.
- Task 10 — brief task-10-brief.md, report task-10-report.md, base 8f6ac33, head d8191fa, fix rounds 1, review CLEAN, merged 1f525cb, integration commit bf337ad (follow button in /ara, report/block in chat). Task 10: complete.
- Task 12 — brief task-12-brief.md, report task-12-report.md, ran in main, base bf337ad, head 1119095, fix rounds 1, review CLEAN. Task 12: complete. Demo user elif.yilmaz@ornek.edu.tr.
- After all merges (orchestrator check in main at 1119095): tsc 0, lint 0, vitest 51 files / 477 tests green, npm run build exit 0.

## Final review and fix wave (workflow wf_08f6c886-3d0)
- Review: 8 Opus lenses (security, kvkk, spec-core, spec-social, data, ui, runtime, docs-tests) plus minors triage over main at 2d0e939. 33 findings confirmed by adversarial verification, 0 refuted; 59 deferred minors parked by triage as not-a-defect or acceptable; 10 parked by the planner (rulings below).
- Fix packets, each fixed in its own worktree, re-reviewed once and merged in order:
  - task-21 verification-pipeline (R4, F1a, F15, F3, F21, F20a, F24, F23, M71a, F9c, F51, F57) — merged b9900a4.
  - task-22 admin-verification-ui (R6, F1b, F2, F9b, M71b, M26, M27, F11, M36, F31, F20b) — merged 4c3d7eb.
  - task-23 projects (R2, F12b, F14, F37, F36, M21, M53b, F43, F49, F44b, F41, F42) — merged b442e6b.
  - task-24 social-messaging (R8, F10, F27, F38, F34, F53, F44a, F12a, F35, F13, F60, M52, M53, F41b) — merged 07ec97b.
  - task-25 shell-notifications-ui (R3, F40, F18, F19, M65, F17, F32, F52, F48, F44d, F16, M4, F45, F46, F47) — merged 6b95c1b.
  - task-26 settings-kvkk-data (F5, F4, F6, F28, F7, F8, F9a, M42, M48, M49, F30, F33, M27b, F39) — merged 032eef8.
  - task-27 auth-legal-docs (R1, R5, R7, F25, F22, F26, M14, M15, F44c, F29, F50, F58, F54, F55, F56, F20c) — merged d3ce56c.
- Final checks at 6b95c1b: tsc 0, lint 0, vitest 789/791 with 2 timeouts under full machine load; both files rerun alone: 39/39 green.
- Ruling: F61 (registration reveals that an e-mail is taken) is parked — without e-mail verification a generic error would strand legitimate users — cost if wrong: e-mail enumeration on /kayit.
- Ruling: F62 (consent check ignores the consent text version) is parked — one provider and one version today — cost if wrong: a future provider change would need a re-consent migration.
- Ruling: F63/F64/F70 (missing FK indexes, searchText btree indexes, role-slot overbooking under PostgreSQL READ COMMITTED) are parked until a PostgreSQL migration — SQLite is the supported database and serialises writes — cost if wrong: slower queries at scale and possible overbooking after a PostgreSQL move.
- Ruling: F65/F67 (pagination replaces instead of appending; some empty states without an action) are parked as polish — cost if wrong: minor UX friction.
- Ruling: F66 (notification flooding through apply/withdraw and invite/cancel loops) is parked; the unbounded follow loop is fixed by F60 and the owner can block — cost if wrong: a determined user can spam one owner's notifications.
- Ruling: F68 (AI "today" and document age measured in UTC days) is parked — at most one day off for three hours a night against a 183-day window — cost if wrong: a document exactly at the 6-month edge may be judged one day differently.
- Ruling: F69 (seeded admin is VERIFIED without an APPROVED attempt) is accepted — the admin must open verified-only pages; the seed never runs in production — cost if wrong: none in production.
- Re-review residuals adjudicated by the orchestrator (breaker; no second fix wave), fixed in task-30:
  - Important: a revoked verification could be regained by re-uploading the same document. Ruling: an APPROVED decision is downgraded to MANUAL_REVIEW when the same user has an admin-rejected (reviewedAt set) attempt with the same docHash; test added — cost if wrong: an honest user whose revocation was a mistake waits for manual review.
  - Minor: tesseract could delete operator-placed traineddata after an init failure → cacheMethod "readOnly" (the app writes the files itself).
  - Minor: hiding a never-introduced suggestion restarted the 7-day introduction cooldown → cooldown reads only batch rows (non-empty reason; batch rows get a fallback reason); test added.
  - Minor: client-only time labels were announced by the chat live region after hydration → aria-live is "off" until the client mounts.
  - Minor: README said up to 5 PDF pages are processed → longer PDFs are rejected; README and make-admin output now tell the operator to check the printed username.
- Browser E2E findings fixed in task-30: BF1 admin tab title hidden from non-admins (generateMetadata → "Sayfa bulunamadı"); BF2 counters route no longer imports the PDF/OCR stack (purgeExpiredMaskedText moved to purge-masked.ts, unpdf added to serverExternalPackages); BF3 welcome card only while the uploader is shown; BF4 project page tab title is the project title. BF5 was covered by R2, BF6 by F44.
- Ruling: vitest testTimeout raised to 20 s — two password-hash and PDF tests timed out at 5 s only under full machine load — cost if wrong: a genuinely hung test takes 20 s to fail.
- Final state after task-30 merge (6714db1): tsc 0, lint 0, vitest 67 files / 796 tests green, npm run build exit 0 with no warnings (/api/me/counters 158 B).
- Browser E2E (dev server, mock verifier): guest masking and redirects; register → upload → VERIFIED; share project; elif applies with role and message; owner sees notification and accepts (role 1/1); message request to a non-followed user (composer locked while pending), accepted, reply delivered; data export (attachment, no-store, no password hash, no document text); BF1/BF3/BF4 confirmed fixed; 12 logged-in pages at 375 px with no horizontal scroll; admin queue validation and approval work. Account deletion is covered by automated tests, not clicked in the browser.
