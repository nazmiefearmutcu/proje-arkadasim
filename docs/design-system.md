# Design system

Source of truth: `src/app/globals.css` (tokens) and `src/components/ui`, `src/components/common`,
`src/components/landing`. The layout follows the owner's two HTML prototypes (the app prototype and the
landing page draft), recoloured to black and white.

## Idea

A notice board for projects. Every project is a card; the role strips under a dashed perforation line are
the roles the team is looking for. A strip's colour is the role's discipline; a filled role becomes a grey
"Şerit dolu" box.

## Colour

Black and white carry the interface: the top bar, primary buttons, the selected state and the landing
panels are black (`pen` = `#0d1117`), content sits on white cards over a light grey ground. Colour is kept
only where it means something:

| Use | Token |
| --- | --- |
| Discipline of a role strip / avatar | `--d-<id>` (12 light, saturated colours, dark ink on top) |
| "Document verified" | `stamp` `#047857` (green, nowhere else) |
| Logo tick, verified seal on dark | `tick` `#7cf0a2` |
| Status | `ok`, `warn`, `danger` |

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#f3f4f6` | Page ground |
| `surface` | `#ffffff` | Cards, side menu, inputs |
| `surface-2` | `#f7f8fa` | Strip area under the perforation, quiet fills |
| `ink` / `ink-2` / `ink-3` | `#0d1117` / `#4b5260` / `#5c6370` | Text |
| `line` | `#e1e4e8` | Hairline borders |
| `perf` | `#c3c8d0` | Dashed perforation |
| `torn` | `#eceef1` | Filled ("torn off") strip |
| `pen` / `pen-strong` / `pen-soft` | `#0d1117` / `#2a303a` / `#eceef1` | Brand black, hover, selected |

There is one theme (light); `tests/design-tokens.test.ts` checks every text pair and all twelve strip
colours for 4.5:1.

## Type

- Body: Inter (`--font-inter`).
- Headings: Plus Jakarta Sans (`--font-jakarta`, `font-display`).
- Dates, counts and short technical labels: JetBrains Mono (`--font-jetbrains`, `font-mono`, `.t-mono`).

All three load through `next/font` with `latin-ext`; the variables sit on `<html>`.

| Class | Size |
| --- | --- |
| `t-hero` | `clamp(40px, 6vw, 62px)`, 700 |
| `t-page` | 26 px (30 px from `lg`), 800 |
| `t-card` | 19 px, 700 |
| `t-section` | 17 px, 700 |
| `t-label` 14 px 600, `t-body` 15 px, `t-meta` 13 px, `t-mono` 11 px |

## Shape

Flat: no shadows on cards, 1 px `line` borders. Radii: chip 2 px, control and card 3 px, sheet 6 px.
Avatars are squares with 2 px corners. Touch targets are at least 44 px on phones.

## Shell

- Top bar (60 px, black): logo, white search box, notification bell, profile chip (square avatar + first
  name).
- Desktop (`lg`): fixed white side menu, 230 px, full height, under the top bar; "Proje paylaş" below a
  divider; "Ayarlar" pinned at the bottom. Content starts at 230 px.
- Phone: bottom bar with the five items; the selected item is `pen-soft`, "Paylaş" is a black block.

## Components

- `ProjectCard`: owner (square avatar, green "belgesi doğrulandı" line, department · university), mono
  time, title, two-line summary, stage/mode chips and city; below the perforation "Sana uyan görevin
  şeridini kopar · N açık, M dolu", "Detayı aç" and up to three `RoleStrip`s.
- `RoleStrip`: a skill the project needs (a role means a skill, never a job title or a department), an
  optional description and a black "Başvur" link; a filled skill is the grey "Bulundu" box. Cards show
  the owner's university but not the department.
- `VerifiedLine` (green tick + text) and `VerifiedStamp` (green square seal).
- Landing (`components/landing`): Apple-style full-screen sections, each one colour (black or white), one
  headline and almost no copy. A page that contains `data-bleed` hides the side menu and spans the full
  width. Screens: hero with the auto-cycling discipline matrix (dim tiles have no colour; lit tiles glow in
  their own colour with a shine, and the centre shows a project those disciplines could build), tearing
  role strips, a document being scanned and verified, chat bubbles, and the closing call with the panda.
  Visuals fade in on scroll (`Reveal`); every animation stops under `prefers-reduced-motion`.
- `Logo` / `LogoMark` / `PandaHero`: the owner's "Panda Silüet Logo" pack (a sitting panda in profile). Small
  sizes use the pack's crisp version without fur texture (`panda-mark.png`, and `panda-mark-dark.png` with a
  white halo for the black bar); the large view uses the textured negative (`panda-large-dark.png`). The
  favicon and app icon are the pack's black rounded-square icon.
