# SDD ledger — plan: docs/superpowers/plans/2026-11-08-proje-arkadasim-plan.md

## Rulings
- Ruling: Task 0 (scaffold) done by the orchestrator, not a subagent — purely mechanical commands; versions verified directly (next 15.5.29, prisma 6.19.3, zod 4.6.7, openai 7.53, vitest 5.1) — cost if wrong: none beyond a re-scaffold.
- Ruling: Implementers and per-task reviewers run on Haiku, fix rounds 4–5 and the final review on Opus — the user's global CLAUDE.md requires Haiku first and bans Sonnet — cost if wrong: more fix rounds on hard tasks.
- Ruling: Workflow agents cannot be "resumed", so fix rounds 1–3 dispatch a fresh Haiku implementer that reads the brief, the report file and the findings — keeps the SDD loop deterministic inside the Workflow tool — cost if wrong: slightly more context re-reading per round.
- Ruling: The reviewer generates its own review package with git (`git log`/`git diff BASE..HEAD` into a file) instead of the orchestrator pasting diffs — keeps orchestrator context small — cost if wrong: none; same content.
- Ruling: Added a `/yardim` help page (task 4) because spec §3.1's avatar menu lists "Yardım" while §3.2 had no route — cost if wrong: one small static page.
- Ruling: Seeded demo passwords live in `.env.example` (SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD) and never in chat — local development values only — cost if wrong: user must change them before any deployment (README says so).

## Tasks
