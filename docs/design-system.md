# Design system

Proje Arkadaşım uses one visual language: Turkish campus life. Blue ballpoint ink marks actions,
the violet official stamp marks verification, cool paper is the background, and each of the 12
discipline groups has its own color. The one memorable element is the **discipline spine**
(the sought disciplines of a project, shown as color segments). Everything else stays quiet:
hairline borders, no decorative gradients, no shadows on cards.

Sources: `src/app/globals.css` (tokens and type classes), `src/components/ui/` (primitives),
`src/components/common/` (domain components), `src/components/shell/` (app shell).

Rules for every feature: use these tokens and primitives. Do not add colors, radii, shadows or
fonts. Do not use raw Tailwind palette classes such as `bg-blue-500`.

## Tokens

Raw values live on `:root` as CSS variables and are overridden under
`@media (prefers-color-scheme: dark)`. `@theme inline` exposes them as utilities.

| Token | Utility examples | Use |
|---|---|---|
| `paper` | `bg-paper` | App background |
| `surface` | `bg-surface` | Cards, top bar, bottom nav, sheets |
| `surface-2` | `bg-surface-2` | Inputs, chips, subtle fills, hover |
| `ink` | `text-ink` | Primary text |
| `ink-2` | `text-ink-2` | Secondary text |
| `ink-3` | `text-ink-3` | Meta text, placeholders, inactive icons |
| `line` | `border-line`, `bg-line` | Borders, dividers |
| `pen` / `pen-ink` | `bg-pen text-pen-ink` | Primary actions, links, focus ring |
| `pen-soft` | `bg-pen-soft` | Selected and active fills |
| `stamp` / `stamp-soft` | `text-stamp bg-stamp-soft` | Verification only |
| `ok` / `ok-soft` | `text-ok bg-ok-soft` | Success |
| `warn` / `warn-soft` | `text-warn bg-warn-soft` | Pending, manual review |
| `danger` / `danger-soft` | `text-danger bg-danger-soft` | Errors, destructive actions |
| `scrim` | `backdrop:bg-scrim` | Modal backdrop behind sheets. Theme-independent `rgb(10 12 24 / 0.5)` |

Contrast (WCAG AA, 4.5:1 for small text). The light theme is tuned so every text pair passes:
`ink-3` `#666b86` (paper 4.83, surface 5.23, surface-2 4.62), `warn` `#996000` (warn-soft 4.65,
surface 5.21), `ok` `#1d7a4c` (ok-soft 4.64, surface 5.33). The dark theme values are unchanged.
`tests/design-tokens.test.ts` checks these pairs and the avatar inks below against `globals.css`.

`scrim` is not derived from `ink`: `ink` is near-white in dark mode and would lighten the page.
It is declared on `:root` and on `::backdrop` (older browsers do not let `::backdrop` inherit
variables from `:root`).

Discipline colors are `--d-<id>` (`yazilim`, `elektronik`, `makine`, `endustri`, `mimarlik`,
`tasarim`, `isletme`, `saglik`, `hukuk`, `sosyal`, `temel`, `sanat`). Use them only through
`style={{ background: "var(--d-<id>)" }}`. Never copy the hex from `taxonomy.ts`.

Text on a discipline color uses that color's ink, `--d-<id>-ink` (Avatar initials). One ink cannot
reach 4.5:1 on all twelve light-theme colors (white is 2.2:1 on the `endustri` yellow, dark ink is
2–3:1 on the `makine` grey), so each color points to one of two inks:

| Token | Light | Dark | Used on |
|---|---|---|---|
| `--avatar-ink` | `#ffffff` | `#0f1222` | `yazilim`, `makine`, `mimarlik`, `tasarim`, `saglik`, `hukuk`, `sanat` |
| `--avatar-ink-dark` | `#0a0c18` | `#0f1222` | `elektronik`, `endustri`, `isletme`, `sosyal`, `temel` |

Lowest ratios: light `sosyal` 4.57 and `tasarim` 4.62, dark `sosyal` 5.52 (every dark-theme
discipline color is light, so both inks are dark there). Never put raw `text-white` on a discipline
color.

Dark values are set by the system preference. Do not add a theme toggle.

## Radii and shadows

| Token | Value | Use |
|---|---|---|
| `rounded-chip` | 999px | Chips, search pill, badges, switch, spine |
| `rounded-control` | 12px | Buttons, inputs, select, textarea |
| `rounded-card` | 16px | Cards, floating panels |
| `rounded-sheet` | 22px | Sheet top corners |

- `shadow-fab`: only the raised Paylaş button.
- `shadow-sheet`: only sheets.
- Cards have no shadow. Floating panels use a border.

## Typography

One family: Geologica (`--font-geologica`, exposed as `font-sans`), with `system-ui` fallback.
Sentence case everywhere. No uppercase transforms, no eyebrow labels.

| Class | Size / line height / weight | Use |
|---|---|---|
| `t-hero` | 36 / 1.05 / 800 (40 px from 400 px width), tracking -0.025em | Landing hero only |
| `t-page` | 26 / 1.15 / 750, tracking -0.015em | Page title (`PageHeader`) |
| `t-section` | 20 / 1.25 / 700 | Section title (`Section`, `Sheet`) |
| `t-card` | 18 / 1.25 / 650 | Card and empty-state titles |
| `t-body` | 15 / 1.55 / 400 | Body text |
| `t-label` | 14 / 1.3 / 550 | Labels, buttons, chips |
| `t-meta` | 13 / 1.4 / 450 | Meta, hints, timestamps |
| `t-prose` | max-width 68ch | Add to long text blocks |

Inputs use 16 px text so iOS does not zoom when focused.

Every type class except `t-hero` sets `overflow-wrap: anywhere`. User text (descriptions, bios,
messages, role and project titles, e-mail addresses, URLs) can contain long unbreakable tokens; this
breaks them inside their box and shrinks the min-content width, so the page never scrolls sideways at
375 px. Rows that must stay on one line keep `truncate` (nowrap), which is unaffected.

## Layout

- Top bar: 60 px, sticky, `bg-surface`, bottom border `border-line`. Its content sits in a
  column of at most 640 px.
- Bottom nav: fixed, 64 px plus `env(safe-area-inset-bottom)`, `bg-surface`, top border.
- Page content: `(app)/layout.tsx` gives `main` a column of at most 640 px, `px-4`, and bottom
  padding `calc(88px + env(safe-area-inset-bottom))` so the nav never covers content.
- Center only empty states. Everything else is left-aligned.
- Design at 375 px. No horizontal page scroll. Touch targets are at least 44 px.
- Auth pages use `(auth)/layout.tsx`: a narrow column of at most 420 px, no bottom nav.

## Focus and motion

- Every interactive element uses `focusRing` (`src/components/ui/styles.ts`): a 2 px outline in
  `pen` at offset 2, shown on `focus-visible` only.
- Do not add `outline-none` or `outline-hidden` next to `focusRing`. In Tailwind 4 both set
  `--tw-outline-style: none`, and `focus-visible:outline-2` then draws no outline at all.
- `prefers-reduced-motion` disables transitions and animations globally in `globals.css`.
  Components with timers (search placeholder rotation) also check the media query.

## Primitives (`src/components/ui/`)

Import from `@/components/ui/<file>`.

- **Button / ButtonLink** (`button.tsx`): variants `primary`, `secondary`, `ghost`, `danger`;
  sizes `md` (44 px, default) and `sm` (36 px, dense surfaces only). `loading` shows a spinner
  and disables the button. `buttonClasses(variant, size, className)` styles other elements.
- **SubmitButton** (`submit-button.tsx`, client): submit button inside a `<form action={…}>`. It reads
  `useFormStatus().pending` and passes it to Button's `loading`, so a slow server action shows a
  spinner and cannot be sent twice. `unstyled` keeps the caller's classes (for example a menu row)
  and appends the spinner.
  ```tsx
  <form action={markAllRead}><SubmitButton variant="ghost">Tümünü okundu yap</SubmitButton></form>
  ```
  ```tsx
  <Button type="submit" loading={pending}>Projeyi paylaş</Button>
  <ButtonLink href="/giris" variant="secondary">Giriş yap</ButtonLink>
  ```
- **Input, Textarea, Select** (`input.tsx`, `textarea.tsx`, `select.tsx`): 44 px, 12 px radius.
  Textarea grows with its content (`field-sizing-content`, minimum 3 rows).
- **Field** (`field.tsx`): label, control, hint and error. Gives the control its `id`,
  `aria-describedby` and `aria-invalid`. Pass one control as the child.
  ```tsx
  <Field id="ad" label="Ad" error={fieldErrors.firstName}>
    <Input name="firstName" autoComplete="given-name" />
  </Field>
  ```
- **Checkbox, Switch** (`checkbox.tsx`, `switch.tsx`): the whole row is the hit target
  (44 px minimum). Switch uses `role="switch"`.
- **Card** (`card.tsx`): `bg-surface`, `border-line`, 16 px radius, no shadow.
- **Avatar** (`avatar.tsx`): sizes 28, 36, 48, 72, 96. Shows `avatarUrl(path)` when available,
  otherwise initials on the discipline color (or a color picked from the seed). Pass `name`
  for initials and `seed` (username) for the palette. Initials use the color's `--d-<id>-ink`
  (`avatarColorsFor` in `avatar-colors.ts`).
- **Badge** (`badge.tsx`): count badge, hidden at 0, shows `99+` above 99.
- **Chip** (`chip.tsx`): neutral by default, `selected` for active filters, `dotColor` for a
  leading color dot, `href` makes it a link. Link chips are 44 px tall and stay on one line (filter
  rows scroll sideways). Static chips are 32 px, `max-w-full`, and wrap long text
  (`overflow-wrap: anywhere`), so a 60-character role title fits a 375 px screen.
  `chipClasses(selected, className, { interactive, nowrap })` (`chip-classes.ts`) styles other
  tappable chips, such as the search suggestions (`interactive` gives 44 px). Height and wrapping
  come from the options, never from a second `min-h-*` class: `cn` does not resolve conflicts.
- **Tabs** (`tabs.tsx`): link tabs. Each tab points to `basePath?sekme=<value>`, the active tab
  has a 2 px pen underline.
- **Sheet** (`sheet.tsx`, client): bottom sheet on a native `<dialog>`. Closes on backdrop,
  Escape and the close button through `onClose`. The parent owns the `open` state. The backdrop
  is `--scrim`.
  ```tsx
  <Sheet open={open} onClose={() => setOpen(false)} title="Hesap">…</Sheet>
  ```
- **EmptyState** (`empty-state.tsx`): icon, title, text and one action. The only centered text.
- **Spinner** (`spinner.tsx`): inline loading indicator, `role="status"`.
- **PageHeader** (`page-header.tsx`): `t-page` title, optional description and right slot.
- **Section** (`section.tsx`): `t-section` title and content.

## Domain components (`src/components/common/`)

- **DisciplineSpine** (`discipline-spine.tsx`): `groups: string[]`,
  `orientation: "vertical" | "horizontal"`. Vertical is 6 px wide and fills its parent, with
  equal segments and 3 px gaps. Horizontal is 8 px tall. Unknown or empty input shows one `line`
  segment. It is `aria-hidden`; the chips carry the text.
- **DisciplineChip** (`discipline-chip.tsx`): `id`, `selected?`. Chip with the group color dot
  and the taxonomy label.
- **VerifiedStamp** (`verified-stamp.tsx`): `size: "sm" | "lg"`, `academicStatus?`. `sm` is an
  18 px violet ring with a check, rotated -8 degrees, labelled "Belgesi doğrulandı". `lg` adds
  "Doğrulanmış öğrenci" or "Doğrulanmış mezun". Render it only for verified people.
- **ProjectCard** (`project-card.tsx`): `project: ProjectCardData`,
  `viewer: { verificationStatus, role? } | null`. Discipline spine on the left edge, stretched
  title link, summary, info chips, sought disciplines, owner row. Closed projects show a
  "Kapandı" chip and a faded spine.
- **UserRow** (`user-row.tsx`): `person: PersonSummary`, `name` (chosen by the caller with
  `displayName`), optional `reason` and `action`. Optional `href` (for example `/u/<username>`,
  only for viewers who may see the profile) turns the avatar and text into one 44 px link with
  `focusRing`; do not add a separate "Profili gör" button next to the action.
- **Logo** (`logo.tsx`): three-bar mark plus wordmark. `LogoMark` is the mark alone.

## Shell (`src/components/shell/`)

- `TopBar`: avatar menu, search pill, notification bell.
- `BottomNav`: Ana Sayfa, Network, Paylaş (raised pen circle), Mesajlarım, Projeler. Badges come
  from `useCounters`. A badge adds its meaning to the link's accessible name ("Mesajlarım, 3
  okunmamış", "Network, 2 bekleyen davet"), like the bell ("Bildirimler, 3 okunmamış").
- `useCounters(initial)`: shares one store between bell and nav, polls
  `/api/me/counters` every 20 s and on `visibilitychange`.
- `SearchBar`: rotating placeholder from `getSearchSuggestions`. On focus a panel shows the
  suggestions as wrapping chips (spec §3.1, 44 px each); a tap searches `suggestionToQuery(suggestion)`.
- `AvatarMenu`: "Profilim" for verified users; unverified users get "Profilini düzenle"
  (`/ayarlar#profil`), because profiles are verified-only. "Çıkış yap" is a `SubmitButton`.

## Error pages

- `(app)/error.tsx` and `(auth)/error.tsx` keep their shell and offer "Yeniden dene", which calls
  `router.refresh()` and then `reset()` in a transition (`reset()` alone re-renders the cached
  payload that still holds the server error).
- `app/error.tsx` catches errors from the group layouts inside the root layout.
- `app/global-error.tsx` replaces the root layout: its own `<html lang="tr">`, Turkish copy and a
  reload button. It uses the documented `system-ui` fallback font.

## Copy rules

- Turkish, sentence case, plain verbs. A button says what happens ("Projeyi paylaş").
- No ALL-CAPS labels, no "→" on buttons or links, no eyebrow labels above headings.
- No "A · B · C" meta strings. Use separate chips or lines.
- Errors say what happened and how to fix it. Never apologize.
- Empty states invite an action.

## Icons

`lucide-react`, 20 px by default (`size-5`), `strokeWidth={1.75}`. Mark decorative icons with
`aria-hidden="true"`.
