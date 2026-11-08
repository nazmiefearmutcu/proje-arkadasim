# Final fix wave — packet "shell-notifications-ui"

Branch `task-25` (worktree `proje-arkadasim-wt/t25`).

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- Fix commits:
  - `b2f0926b5051e2a7fc35603af4f7fce6bb6c55f2` fix(ui): chip touch targets and wrapping, AA tokens, avatar ink, scrim, SubmitButton
  - `2ca036af919163d2f7d47c297afc1c94dc9e3563` fix(shell): suggestion chips, search focus ring, avatar menu, nav badge names, error pages
  - `97757ed904e42710425cff71a7fb60e67cc84608` fix(notifications): no read-on-prefetch, relative redirect, Istanbul day boundaries
- HEAD: the commit that adds this report (the next commit after `97757ed`).

All 15 items were confirmed in the code and fixed. Nothing is left unfixed.

## Items

### R3 — search suggestions as chips (Important)
- Confirmed: the focus panel was a `flex-col` list of full-width rows.
- Change: the panel is `flex flex-wrap gap-2 p-3` (`aria-label="Önerilen aramalar"`). Each suggestion
  is a `<button>` styled with `chipClasses(false, "text-left hover:text-ink", { interactive: true })`:
  44 px minimum height, wraps long text inside the chip. `onMouseDown` preventDefault,
  `suggestionToQuery(suggestion)` + `router.push('/ara?q=…')` and the Escape handling are unchanged.
- Files: `src/components/shell/search-bar.tsx`.
- Tests: `src/components/ui/chip-classes.test.ts` (interactive chips get `min-h-11` and wrap).
  Static 375 px check (below): every suggestion chip is 44 px, a long one wraps.

### F40 — search input focus ring (Minor)
- Confirmed in `node_modules/tailwindcss`: `outline-none` sets `--tw-outline-style: none`, and
  `outline-2` emits `outline-style: var(--tw-outline-style)`, so the ring was invisible.
  `outline-hidden` sets the same variable in this version, so it is not a fix either.
- Change: removed `outline-none`, applied the shared `focusRing`. design-system.md now warns
  against `outline-none`/`outline-hidden` next to `focusRing`.
- Files: `src/components/shell/search-bar.tsx`, `docs/design-system.md`.

### F18 — notifications marked read by prefetch (Important)
- Confirmed: default-prefetch `Link`s to a GET handler that writes `readAt`.
- Change: notification links have `prefetch={false}`. The GET handler first checks for a prefetch
  (`Next-Router-Prefetch: 1`, or `Sec-Purpose`/`Purpose` containing `prefetch`) and returns
  `204` with no body and no DB access. The helper is not exported (route files may only export
  Next's known names).
- Files: `src/app/(app)/bildirimler/page.tsx`, `src/app/(app)/bildirimler/git/[id]/route.ts`.
- Tests: `tests/notification-redirect.test.ts` — four prefetch header variants return 204 and leave
  `readAt` null; a normal client navigation (`RSC: 1`, no prefetch header) still marks read.

### F19 — absolute redirect from request.url (Important)
- Confirmed: `NextResponse.redirect(new URL(path, request.url))`.
- Change: `redirectTo(path)` returns `new Response(null, { status: 303, headers: { Location: path } })`.
  Only site paths are accepted (`/…` but not `//…`); anything else falls back to `/bildirimler`.
- Tests: requests now use `http://localhost:3000` as `request.url`; Locations are resolved against
  a different public origin (`http://192.168.1.20:3000`). New test asserts the raw Location is
  `/u/takipci` and resolves to the public origin; the guest test asserts a relative `/giris?…`.

### M65 — Istanbul time zone (Minor)
- Confirmed: `setHours(0,0,0,0)` / `setDate` used the server's zone; `relativeTimeTr` had no
  `timeZone` and counted 24 h blocks for "dün".
- Change: `src/lib/time.ts` adds `APP_TIME_ZONE`, `istanbulDayNumber` and `startOfIstanbulDay`
  (fixed UTC+3; Türkiye has had no DST since 2016). `group.ts` uses `startOfIstanbulDay(now)` and
  `- 6 days`. `relativeTimeTr` keeps minutes/hours under 24 h; from 24 h on it counts Istanbul
  calendar days (1 → "dün", <7 → "N gün önce", <30 → weeks). The date formatter sets
  `timeZone: "Europe/Istanbul"`.
- Files: `src/lib/time.ts`, `src/lib/notifications/group.ts`.
- Tests: `group.test.ts` rewritten with explicit Istanbul/UTC instants (no host-zone `new Date(y,m,d)`)
  plus UTC-midnight edge cases; `time.test.ts` adds the "5 Ekim 2026" case from the finding, the
  26-hour/two-calendar-day case and helper tests. Ran under default TZ (Europe/Istanbul), `TZ=UTC`
  and `TZ=America/New_York`: all pass. The new group tests fail (5/8) against the old `group.ts`
  under `TZ=UTC`, so they catch the defect.

### F17 — /ara people rows unreadable at 375 px (Important)
- Confirmed: two nowrap md buttons in a `shrink-0` action.
- Change: `UserRow` takes an optional `href`; with it, avatar and text become one `Link`
  (`min-h-11`, `focusRing`, `min-w-0 flex-1`). `PeopleResults` passes `/u/<username>` (the viewer is
  verified there) and keeps `FollowButton` as the only action; "Profili gör" is removed. Other
  `UserRow` callers are unchanged (no `href`, same layout).
- Files: `src/components/common/user-row.tsx`, `src/app/(app)/ara/page.tsx`.

### F32 — "Profilim" for unverified users (Minor)
- Change: unverified users get "Profilini düzenle" (`UserRoundPen` icon) → `/ayarlar#profil` (the
  profile card has `id="profil"` and renders for every registered user). "Belge durumu" is kept.
- Files: `src/components/shell/avatar-menu.tsx`.

### F52 — retry and missing error boundaries (Minor)
- Change: `(app)/error.tsx` retries with `startTransition(() => { router.refresh(); reset(); })` and
  shows the button's loading state. New `src/app/(auth)/error.tsx` (same pattern, keeps the auth
  shell). New `src/app/error.tsx` catches errors thrown by the group layouts (`(app)/layout.tsx`
  reads the session and counters) inside the root layout, with "Yeniden dene" and "Ana sayfaya dön".
  New `src/app/global-error.tsx`: `"use client"`, own `<html lang="tr"><body>`, imports
  `globals.css`, Turkish copy, "Yeniden dene" reloads the page (the router context is not relied on
  there). It uses the documented `system-ui` fallback because the Geologica variable is defined in
  the root layout it replaces.
- Note: `src/app/error.tsx` is an addition beyond the listed fix (new file); without it, an
  `(app)/layout.tsx` error would fall through to the bare global error page.

### F48 — no pending state on plain submit buttons (Minor)
- Change: new `src/components/ui/submit-button.tsx` (client): `useFormStatus().pending` → Button
  `loading` (which also disables). `unstyled` mode keeps the caller's classes and appends a spinner;
  the avatar-menu "Çıkış yap" row uses it so the row keeps the menu styling. "Tümünü okundu yap"
  uses the default (ghost) mode.
- Files: `submit-button.tsx`, `bildirimler/page.tsx`, `avatar-menu.tsx`, `docs/design-system.md`.

### F44d — bare badge numbers (Minor)
- Change: nav items with a badge get `badgeLabel`; when the count is positive the link's
  `aria-label` becomes "Mesajlarım, 3 okunmamış" / "Network, 2 bekleyen davet" (same pattern as the
  bell). The visible label text is included, so label-in-name holds.
- Files: `src/components/shell/bottom-nav.tsx`.

### F16 — horizontal scroll from long tokens (Important)
- Change: static chips get `max-w-full whitespace-normal [overflow-wrap:anywhere]`; only link chips
  keep `whitespace-nowrap`. In `globals.css` every type class except `t-hero` (`t-meta`, `t-body`,
  `t-label`, `t-card`, `t-section`, `t-page`, `t-prose`) sets `overflow-wrap: anywhere`. The brief named
  `t-body`, `t-meta`, `t-prose`; `t-label`, `t-card`, `t-section` and `t-page` were added because they carry
  role titles (≤ 60 chars, `t-label` on `/projeler/[id]`), project titles (≤ 80 chars, `PageHeader`
  `t-page`, cards `t-card`) and the user's name in the sheet title (`t-section`). `overflow-wrap`
  has no effect on `truncate` (nowrap) rows.
- Files: `src/components/ui/chip-classes.ts`, `chip.tsx`, `src/app/globals.css`.
- Tests: `chip-classes.test.ts`; `tests/design-tokens.test.ts` asserts the type-class rule.
- 375 px check (no dev server allowed): compiled the real `globals.css` with `@tailwindcss/postcss`
  and loaded a static fixture that copies the markup of the network invite card (60-char unbroken
  role chip, message with a long URL), a bio with a long e-mail, a project `PageHeader` with an
  80-char unbroken title and a description URL, an unbroken role title, the owner-panel request row
  (UserRow + chip + unbroken message), the admin queue header (e-mail line, `dl` grid with a URL),
  the `/projeler` filter chip row and the search suggestion panel. Result at 375 px:
  `document.documentElement.scrollWidth` = 375. With the old behaviour simulated (nowrap static chips,
  no overflow-wrap) the same page measured 1056. The truncated UserRow name still truncates, the
  filter row scrolls inside itself, filter chips are 44 px.

### M4 — link chips 32 px (Important)
- Change: `Chip` with `href` uses `chipClasses(selected, className, { interactive: true, nowrap: true })`
  → `min-h-11`. Static span chips stay `min-h-8`. Height is chosen by an option rather than by
  appending `min-h-11` to `className` (the suggested fix): `cn` is clsx only, so `min-h-8 min-h-11`
  would depend on stylesheet order (ruling M3).
- Tests: `chip-classes.test.ts` (one `min-h-*` and one `whitespace-*` class per combination).

### F45 — avatar initials contrast (Minor)
- Confirmed: raw `text-white` (light `endustri` 2.15:1, dark `endustri` 1.68:1).
- Finding: one ink colour cannot reach 4.5:1 on all twelve light-theme discipline colours (white
  fails on elektronik, endustri, isletme, sosyal, temel; dark ink fails on yazilim, makine, saglik,
  hukuk, mimarlik, sanat). So `--avatar-ink` (light `#ffffff`, dark `#0f1222`) and
  `--avatar-ink-dark` (light `#0a0c18`, dark `#0f1222`) are defined, and each colour maps to one of
  them via `--d-<id>-ink`. Lowest ratios: light sosyal 4.57, tasarim 4.62; dark sosyal 5.52.
- Avatar uses `avatarColorsFor(disciplineGroup, seed)` (new `avatar-colors.ts`, re-exported from
  `avatar.tsx`) → `{ background: var(--d-<id>), color: var(--d-<id>-ink) }`.
- Tests: `tests/design-tokens.test.ts` computes all 24 pairs from `globals.css`;
  `src/components/ui/avatar-colors.test.ts`.

### F46 — light-theme AA failures (Minor)
- Change (light theme only): `--ink-3` `#7a7f9a` → `#666b86` (paper 4.83, surface 5.23, surface-2 4.62),
  `--warn` `#a86a00` → `#996000` (warn-soft 4.65, surface 5.21, paper 4.82), `--ok` `#1e7f4f` →
  `#1d7a4c` (ok-soft 4.64, surface 5.33). Dark theme untouched. Values recorded in design-system.md.
- Tests: `tests/design-tokens.test.ts` (12 light pairs ≥ 4.5, dark values unchanged).

### F47 — sheet scrim lightens the page in dark mode (Minor)
- Change: `--scrim: rgb(10 12 24 / 0.5)` declared once for `:root, ::backdrop` (older browsers do not
  let `::backdrop` inherit `:root` variables), exposed as `--color-scrim`; the Sheet uses
  `backdrop:bg-scrim`. Compiled output: `.backdrop\:bg-scrim::backdrop { background-color: var(--scrim) }`.
- Tests: `tests/design-tokens.test.ts` (defined on `::backdrop`, not overridden in dark, not derived
  from `--ink`, exposed as a utility).

## Files

Packet files changed: `search-bar.tsx`, `avatar-menu.tsx`, `bottom-nav.tsx`, `bildirimler/page.tsx`,
`bildirimler/git/[id]/route.ts`, `tests/notification-redirect.test.ts`, `notifications/group.ts`,
`group.test.ts`, `lib/time.ts`, `time.test.ts`, `ara/page.tsx`, `common/user-row.tsx`, `(app)/error.tsx`,
`ui/chip.tsx`, `ui/avatar.tsx`, `ui/sheet.tsx`, `globals.css`, `docs/design-system.md`.

New files: `src/components/ui/submit-button.tsx`, `src/components/ui/chip-classes.ts` (+ test),
`src/components/ui/avatar-colors.ts` (+ test), `src/app/(auth)/error.tsx`, `src/app/error.tsx`,
`src/app/global-error.tsx`, `tests/design-tokens.test.ts`.

Existing files outside the packet: none. (`chipClasses` and the avatar colour helpers moved to plain
`.ts` modules because `tsconfig` has `jsx: "preserve"`, so vitest cannot import `.tsx` files; both are
re-exported from their old modules, so existing imports keep working.)

## Checks

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass, no warnings.
- `npx vitest run`: 54 files, 539 tests passed (BASE: 51 files, 477 tests).
- `TZ=UTC` and `TZ=America/New_York` runs of `time.test.ts` + `group.test.ts`: pass.
- No dev server or build was run (packet rule); the 375 px check used a static fixture with the
  compiled stylesheet, as described under F16.

## Notes for the orchestrator

- Dark theme `--ink-3` on `--surface-2` is 4.48:1 (used by the search placeholder hint). Left unchanged
  because F46 says to leave the dark theme as it is.
- `docs/design-system.md` mentions `bg-blue-500` as a forbidden example; Tailwind scans the docs and
  emits that variable into the stylesheet. Harmless, pre-existing.
