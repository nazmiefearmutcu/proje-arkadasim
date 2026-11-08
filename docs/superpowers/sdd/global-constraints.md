# Global constraints — binding for every task

Project root: `C:\Users\Kullanıcı\Desktop\proje-arkadasim` (git repo, branch `main`).
Binding spec: `docs/superpowers/specs/2026-11-08-proje-arkadasim-design.md` (Turkish). If your brief and the spec
disagree, the spec wins; mention the conflict in your report.

## Process rules
- You are the only agent working in this repo right now. Do NOT dispatch subagents.
- Before starting: run `git rev-parse HEAD` and record it as BASE in your report.
- Work only on the files your brief names (plus tests for them). If you must touch another file, keep the change minimal and list it in the report.
- Do not change `prisma/schema.prisma` unless your brief says so. If a schema change is unavoidable, create a migration with `npx prisma migrate dev --name <name>` and explain why in the report.
- Do not add npm dependencies unless the brief allows it. Already installed (check `package.json` for exact versions): next 15.5, react 19.1, tailwindcss 4, prisma 6.19 + @prisma/client 6.19, **zod 4** (use `z.object`, `z.enum`, `z.string().min()`, `safeParse`, `error.issues`; custom messages via `{ message: "…" }` or `{ error: "…" }`), **openai 7** (OpenAI-compatible client used for DeepSeek), unpdf 2, tesseract.js 7, nodemailer 10, lucide-react 1.x, clsx; dev: **vitest 5**, tsx, pdf-lib, @types/node 24, @types/nodemailer. npm 11 blocks dependency install scripts unless listed in `package.json` → `allowScripts`; if you ever must add a dependency with an install script, run `npm approve-scripts <pkg>`. Node 24 runtime on Windows; use the Bash tool (Git Bash) or PowerShell as you prefer.
- Before reporting, all of these must pass: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Fix what you broke. If a failure is in code you did not touch, say so in the report instead of editing it.
- Commit your work (one or more commits) with `git add -A && git commit -m "<type>: <summary>"` and end every commit message with a blank line and:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Write your full report to the report file named in your dispatch (what you built, files, decisions, test output summary, BASE and HEAD commit hashes, concerns). Your final reply is only: status (DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED), commit hashes, one-line test summary, concerns.

## Next.js 15 / React 19 rules
- App Router under `src/app`. `params` and `searchParams` are Promises: `const { id } = await params`.
- `cookies()` and `headers()` from `next/headers` are async: `const store = await cookies()`.
- Mutations: Server Actions in files starting with `'use server'`, validated with zod, returning `ActionResult` from `src/lib/action-result.ts` (`{ ok: true, data? } | { ok: false, error, fieldErrors? }`). Forms use `useActionState` from `react`.
- `redirect()` / `notFound()` throw — never call them inside try/catch.
- Route handlers: `export const runtime = "nodejs"` when using Prisma, fs, crypto, tesseract, unpdf. Mutating route handlers call `assertSameOrigin(req)` from `src/lib/origin.ts`.
- Server Components by default; add `'use client'` only where interaction needs it. Never import `src/lib/db.ts` or server-only libs into client components.
- Auth helpers: `getCurrentUser()`, `requireUser(next?)`, `requireVerified(next?)`, `requireAdmin()` from `src/lib/auth/guards.ts`. Server actions that need a verified user call `getCurrentUser()` and return `{ ok:false, error:"Bu işlem için belgeni doğrulaman gerekiyor." }` when not verified.

## Data rules
- Prisma client: `import { db } from "@/lib/db"`. SQLite: no enums, no arrays. Enum-like columns are `String` validated with TS unions/zod from `src/config/taxonomy.ts`. List columns end in `Json` (e.g. `skillsJson`) — use `parseList` / `toListJson` from `src/lib/json-fields.ts`.
- Every write that changes searchable fields must refresh `searchText` with `toSearchText(...)` from `src/lib/tr.ts`.
- Notifications only via `notify()` from `src/lib/notify.ts`.
- Never log document bytes, extracted document text, masked text, passwords, tokens or TC kimlik numbers.

## UI rules
- Turkish copy, sentence case, plain verbs. A button says what happens ("Projeyi paylaş", "Başvuruyu gönder"). No ALL-CAPS labels, no "→" appended to buttons/links, no eyebrow labels above headings, no "A · B · C" meta strings — use separate chips or line breaks.
- Errors say what happened and how to fix it; never apologize. Empty states invite an action.
- Mobile first: design at 375 px; no horizontal scroll; touch targets ≥ 44 px; respect `env(safe-area-inset-bottom)` near the bottom nav.
- Use the design tokens and primitives documented in `docs/design-system.md` (from task 3 on). Do not invent new colors, radii, shadows or fonts; do not use raw Tailwind palette colors (`bg-blue-500` etc.) — use token utilities (`bg-pen`, `text-ink-2`, `border-line`, …).
- Icons: `lucide-react`, 20 px default, stroke 1.75.
- Visible keyboard focus (`focus-visible:` ring using `--pen`), `prefers-reduced-motion` respected.
