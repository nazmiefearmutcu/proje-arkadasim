# Design system

Source of truth: `src/app/globals.css` (tokens) and `src/components/ui`, `src/components/common`.
The visual direction was drawn first on a Claude Design canvas and then applied here.

## Idea

A notice board of paper flyers. Every project is a flyer; the tear-off strips under it are the roles
the team is looking for. A strip's colour is the role's discipline, and a role that is filled shows as
a torn-off strip (a dashed, empty slot). The app asks people for an identity document, so the palette
is chosen for trust: institutional blue, white paper, a light blue-grey ground.

## Theme

There is one theme (light). `color-scheme: light` is set on `:root` and there is no
`prefers-color-scheme: dark` block; `tests/design-tokens.test.ts` asserts both.

## Colour tokens

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#eef2f9` | Page ground |
| `surface` | `#ffffff` | Paper: flyers, cards, sheets, inputs |
| `surface-2` | `#f3f6fc` | Quiet fills on paper |
| `ink` | `#0f1a3a` | Text; also the logo notebook |
| `ink-2` | `#55617f` | Secondary text |
| `ink-3` | `#5f6a86` | Tertiary text (AA on paper, surface and surface-2) |
| `line` | `#dce2ee` | Hairlines |
| `perf` | `#c2cadb` | Dashed perforation between a flyer and its strips |
| `torn` | `#a9b4cc` | Dashed outline of a torn-off strip |
| `pen` | `#1746b8` | Brand blue: top bar, primary buttons, links, landing panel |
| `pen-strong` | `#103487` | Hover on blue |
| `pen-soft` | `#e4ecff` | Selected state ("you are here") |
| `stamp` / `ok` | `#12754a` | Green means "document verified" (and success) only |
| `warn`, `danger` | `#8a5a00`, `#b8322a` | Status |
| `tick` | `#7cf0a2` | The logo tick |

Blue is the only brand colour. Green is reserved for verification. The vivid colours belong to the
discipline strips.

### Discipline colours

`--d-<id>` (twelve groups) are light, saturated fills for role strips and avatar backgrounds. Text on
them is always dark ink (`--avatar-ink`, `#0f1a3a`); every pair reaches at least 4.5:1 and the test
checks all twelve. Colour never carries the meaning alone: the discipline name is written on the strip.

## Type

One family, two widths: Archivo (`--font-archivo`, variable `wdth` and `wght` axes, `latin-ext` for
Turkish). The variable class sits on `<html>` so Tailwind's base styles can read it.

| Class | Size | Notes |
| --- | --- | --- |
| `t-hero` | `clamp(48px, 8.4vw, 112px)` | 800, width 66% |
| `t-page` | 36 px (48 px from `lg`) | 800, width 70% |
| `t-section`, `t-card` | 24 px | 800, width 75% |
| `t-label` | 14 px | 600 |
| `t-body` | 15 px / 1.55 | 400 |
| `t-meta` | 13 px | 450 |

Headings are the condensed, heavy cut (poster-like); body text is the normal width.

## Shape and depth

- Radii: `chip`, `control`, `card` 3 px; `sheet` 6 px. No pills.
- `paper-shadow` (a `@utility`, so `lg:paper-shadow` works) is a `drop-shadow` filter, which follows
  the gaps between a flyer and its strips.
- Touch targets are at least 44 px.

## Components

- `ProjectCard`: flyer body (owner, title, summary, status) + up to three `RoleStrip`s, then "+N rol".
- `RoleStrip`: `card` size on flyers, `page` size on the project page (with description and slots).
- `Logo` / `LogoMark`: navy spiral task notebook with a large light-green tick. Ring and outline use
  `currentColor` (white on the blue bar, navy on light ground); `onLight` picks a darker green for the
  part of the tick that leaves the notebook.
- `Button`: `primary` (blue), `secondary` (blue outline), `ghost`, `danger`, and `inverse` /
  `inverse-outline` for use on blue.
- Focus: `focusRing` (blue outline) on light ground, `focusRingInverse` (white) on blue.
- Shell: blue top bar; from `lg` a left side menu, below that a bottom bar. Selected item is
  `pen-soft` + `pen`; "Paylaş" is a filled blue block.
