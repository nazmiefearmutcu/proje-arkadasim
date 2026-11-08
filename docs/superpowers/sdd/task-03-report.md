# Task 3 report: Design system, UI primitives, app shell, counters API, route stubs

- BASE: `e3eda5e1fe99ae519dc5710c0c7ecd10dd1a8106` (`git rev-parse HEAD` before any change)
- Code commit: `8b3036d159cb9bd61890e1a6940bddca9fe6aa0a` (feat: design system, UI primitives, app shell, counters API, route stubs)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made)

## What was built

### Tokens and root (`src/app/`)
- `globals.css`: light and dark tokens on `:root` and under `prefers-color-scheme: dark`, the
  discipline colors as `--d-<id>`, `@theme inline` exposing the color, radius (`chip`, `control`,
  `card`, `sheet`) and shadow (`fab`, `sheet`) tokens, `--font-sans`, the seven type classes
  (`t-meta`, `t-body`, `t-label`, `t-card`, `t-section`, `t-page`, `t-hero`, plus `t-prose`), and a
  global reduced-motion rule.
- `layout.tsx`: `lang="tr"`, Geologica (`latin`, `latin-ext`, `display: swap`), title template,
  description, `viewport` export with theme colors and `viewportFit: "cover"`.
- `icon.svg`: three-bar mark in `#0B7285`, `#D6336C`, `#E8590C`.
- `not-found.tsx` (root), `(app)/error.tsx` (client, retry), `(app)/loading.tsx` (skeleton).
- `(app)/layout.tsx`: top bar, `main` (column 640 px, `px-4`, bottom padding for the nav), bottom nav.
- `(auth)/layout.tsx`: logo link to `/`, column 420 px, no nav.
- `(app)/page.tsx`: stub "Ana sayfa" (the scaffold `page.tsx` was removed).

### UI primitives (`src/components/ui/`)
`button.tsx` (Button, ButtonLink, `buttonClasses`), `input.tsx`, `textarea.tsx`, `select.tsx`,
`field.tsx`, `checkbox.tsx`, `switch.tsx`, `card.tsx`, `avatar.tsx`, `badge.tsx`, `chip.tsx`,
`tabs.tsx`, `sheet.tsx` (client), `empty-state.tsx`, `spinner.tsx`, `page-header.tsx`,
`section.tsx`, plus `styles.ts` (shared `focusRing`, `controlBase`). `src/lib/cn.ts` wraps clsx.

### Domain components (`src/components/common/`)
`discipline-spine.tsx`, `discipline-chip.tsx`, `verified-stamp.tsx`, `project-card.tsx`,
`user-row.tsx`, `logo.tsx` (Logo, LogoMark).

### Libraries
- `src/lib/dto.ts`: `PersonSummary`, `personSummarySelect`, `toPersonSummary`, `projectCardInclude`,
  `ProjectCardData`, `toProjectCardData`.
- `src/lib/avatar.ts`: `avatarUrl(path)`.
- `src/lib/time.ts`: `relativeTimeTr(date, now)`.
- `src/lib/search-suggestions.ts`: `getSearchSuggestions(user)`, `locativeTr(city)`.
- `src/lib/counters.ts`: `getCounters(userId)`, `Counters` type.

### Shell (`src/components/shell/`)
- `top-bar.tsx` (server): avatar menu, search bar, notification bell.
- `avatar-menu.tsx` (client): profile sheet, user and guest items, admin item, logout form.
- `search-bar.tsx` (client): `/ara` form, rotating placeholder every 3.5 s (fade 400 ms, off under
  reduced motion), focus panel with tappable suggestions.
- `notification-bell.tsx` (client): link to `/bildirimler`, guest link to `/giris?next=/bildirimler`.
- `bottom-nav.tsx` (client): five items, active state from `usePathname`, badges.
- `use-counters.ts` (client): `useCounters(initial)` with a module store shared through
  `useSyncExternalStore`, polls every 20 s and on `visibilitychange`.

### API
- `src/app/api/me/counters/route.ts`: `GET` returns `{ authenticated: false }` for guests, else
  `{ authenticated: true, notifications, messages, requests, invites }`. `dynamic = "force-dynamic"`,
  `Cache-Control: no-store`, Node runtime.

### Route stubs
Each renders `PageHeader` with a Turkish title, metadata title, and "Bu sayfa hazırlanıyor.":
`(app)`: `/` (Ana sayfa), `network`, `paylas`, `mesajlar`, `mesajlar/[id]`, `projeler`,
`projeler/[id]`, `projeler/[id]/duzenle`, `u/[username]`, `ara`, `bildirimler`, `dogrulama`,
`ayarlar`, `kvkk/aydinlatma`, `kvkk/acik-riza`, `gizlilik`, `cerezler`, `kullanim-kosullari`,
`yardim`, `admin`, `admin/dogrulamalar`, `admin/sikayetler`.
`(auth)`: `giris`, `kayit`, `sifremi-unuttum`, `sifre-sifirla/[token]`.

### Documentation
- `docs/design-system.md`: tokens and when to use them, radii and shadows, type classes, layout
  and focus rules, every primitive with props and an example, domain components, shell, copy rules.

### Tests (new: 4 files, 37 tests)
- `src/lib/search-suggestions.test.ts` (19): guest list, yazilim complements, interests limit,
  city locative, 4 to 6 unique strings, and 14 locative cases from the brief.
- `src/lib/time.test.ts` (7): every relative bucket and the absolute date format.
- `src/lib/dto.test.ts` (5): unique group order, open slot count, verified flag, person summary.
- `src/lib/counters.test.ts` (6, DB): notifications and invites, received requests only, unread
  message after `lastReadAt`, own messages excluded, read row after message, no read row.

## Decisions (brief silent or ambiguous)

1. **Font variable name.** `next/font` variable is `--font-geologica`. `--font-sans` is set in
   `@theme` as `var(--font-geologica), system-ui, sans-serif`. The brief's `variable: "--font-sans"`
   would make `--font-sans: var(--font-sans)`, a cycle.
2. **Shell data loading.** `(app)/layout.tsx` loads the user and counters once and passes them to
   `TopBar` (props) and `BottomNav`. The brief had `TopBar` load them itself, but then the nav would
   need a second read. `getCurrentUser()` is already request-cached.
3. **Sheet.** Native `<dialog>` with fixed bottom positioning. The parent owns `open`. Backdrop
   click is detected by `target === currentTarget`, Escape is handled through `onCancel`. Menu links
   call `onClose` themselves because the layout persists across navigation.
4. **Field.** Takes exactly one child element and clones it to add `id` (if missing),
   `aria-describedby` and `aria-invalid`. Child props that are already set win.
5. **Textarea.** Auto height is CSS `field-sizing: content` with a 3-row minimum, no JavaScript.
   Browsers without support keep the minimum height.
6. **Input text size.** Inputs use 16 px (body is 15 px) so iOS does not zoom on focus.
7. **Button `sm` (36 px).** Kept because the brief lists it. The mobile rule asks for 44 px, so `sm`
   is for dense surfaces only (documented). No current caller uses it.
8. **Open roles.** `openRoleCount` = sum over roles of `max(0, slots - members in that role)`.
   `projectCardInclude` adds `_count: { members }` to each role. The brief's role select had no
   member count.
9. **Suggestions.** When fewer than 4 unique phrases remain (no discipline, no interests, no city),
   the guest phrases fill the list up to 4. Maximum 6, as the brief asks.
10. **`locativeTr(city)`** returns the full phrase ("İzmir'deki"). The suggestion adds " projeleri ara…".
    Harmony: last vowel back (a ı o u) gives "da/ta", front gives "de/te". Hardening: last letter in
    ç f h k p s ş t gives "t".
11. **Project card city.** Shown as a plain chip after work mode (brief: "work mode (+ city)").
12. **VerifiedStamp `lg` fallback.** Text "Doğrulanmış kullanıcı" when `academicStatus` is null.
13. **Name in cards.** `ProjectCard` and `UserRow` call `displayName` from `permissions.ts`, which
    imports `db`. Both are server-side components. Client components import only types from
    `counters.ts`, so `db` never reaches the client bundle.
14. **Scaffold cleanup.** Removed the five unused `public/*.svg` and `src/app/favicon.ico`. The
    favicon would conflict with `icon.svg`.
15. **Avatar `<img>`.** Plain `img` with an eslint-disable comment for `no-img-element`. Images come
    from the authenticated API route, so `next/image` optimization does not apply.
16. **Counters store.** Module-level store. It is cleared whenever the server passes a new `initial`
    (navigation), so a previous user's numbers do not survive a login change. Guests get `null`.
17. **Toast.** Skipped, as the brief says.
18. **Design doc language.** English, as developer documentation. UI copy is Turkish.
19. **Commit trailer.** The harness attribution reminder for this session names Claude Haiku 5.5.
    The computed task asks for Opus 5.5 on every commit. This report follows the harness line
    (Haiku 5.5). See concerns.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npx vitest run`: 19 files, 162 tests, all passed. The 37 tests in the four new files are part of
  the total. The `vitest.config.ts` configLoader warning and the Prisma `package.json#prisma`
  deprecation warning appear as before.
- `next dev` and `next build` were not run, as the brief requires. The orchestrator verifies pages
  in the browser after the merge.

## Concerns

- **Not browser-verified.** Layout, sheet behavior, the rotating placeholder and the bottom-nav
  geometry (Paylaş circle raised over the bar) were checked only by reading the code. The
  orchestrator's browser check should look at 375 px width and the dark theme.
- **Attribution conflict.** The computed task says `Co-Authored-By: Claude Opus 5.5` on every commit.
  The harness attribution for this session says Haiku 5.5. This commit and the report commit use
  the Haiku 5.5 line. Task 1 and 2 reports record the same choice. Please confirm the trailer.
- **Google Fonts at build time.** `next/font/google` downloads Geologica during `next build` or
  `next dev`. The build machine needs access to Google Fonts (or a font cache).
- **Counters query shape.** `getCounters` makes one `findFirst` per active conversation, up to 50
  (N+1). Fine for this scale. It can become one grouped query later if the page is slow.
- **`sm` buttons** are 36 px, below the 44 px touch rule. Nothing uses them yet.
- **Route stubs.** The admin stubs (`/admin`, `/admin/dogrulamalar`, `/admin/sikayetler`) have no
  `requireAdmin()` guard yet. Later tasks replace these files and must add the guard.

## Fix round 1

BASE: `6f32d0a0935a41aad316be4e73e5e74c56a986ec`. HEAD: see the commit that adds this section (`git log -1 --format=%H` on branch `task-3`).

### Findings fixed

1. **Suggestion tap submitted the stale value** (`src/components/shell/search-bar.tsx`, Important).
   The suggestion button now calls `router.push("/ara?q=" + encodeURIComponent(suggestion))` after
   `setValue(suggestion)`. The form is no longer submitted from the click handler, so React state
   timing cannot send the old input value. The `formRef` was removed because nothing uses it now.
   The suggestion text (for example "Endüstriyel tasarımcı ara…") is the query, as brief §3.1 says
   ("tap fills the input and submits").

2. **`/ara` query was never shown in the search box** (`search-bar.tsx`, `top-bar.tsx`, Important).
   `SearchBar` now reads `q` with `useSearchParams` and only on `/ara` (via `usePathname`). The
   hook sits inside a `Suspense` boundary in `SearchBar`, with a `surface-2` placeholder of the same
   height as the fallback. A `useEffect` keeps the input in sync with the URL query, so a suggestion
   tap or a new search updates the box, and leaving `/ara` clears it. The unused `initialQuery`
   prop was removed from `SearchBar`, `TopBar` and `TopBarProps`. The layout never passed it.
   It cannot pass it, because layouts cannot read `searchParams`.

### Findings disputed

None. Both findings were correct and both are fixed.

### Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: see the result line at the end of this section.
- No component tests exist for the shell, so the two fixes are checked by typecheck, lint and code
  reading. They are not browser-verified. The orchestrator's browser check should type a query on
  `/ara?q=...`, tap a suggestion from an empty box, and confirm that the box shows the tapped text.

### Files changed

- `src/components/shell/search-bar.tsx`
- `src/components/shell/top-bar.tsx`
- `docs/superpowers/sdd/task-03-report.md` (this section)
