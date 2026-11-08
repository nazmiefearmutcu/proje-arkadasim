# Task 3 — Design system, UI primitives, app shell, counters API, route stubs

Read `docs/superpowers/sdd/global-constraints.md` first. Spec sections: §3 (navigation, routes), §4.9 (personal search placeholder), §8 (görsel yön).
Earlier tasks delivered: Prisma schema, `src/lib/{db,tr,json-fields,action-result,notify,permissions,consent,rate-limit,origin,mailer}.ts`, `src/lib/auth/{password,tokens,session,guards,actions}.ts` (`getCurrentUser`, `currentUserSelect`, `CurrentUser`, `logoutAction`), `src/config/{taxonomy,legal}.ts`.

## Design direction (decided — implement exactly)
Subject: a serious, interdisciplinary project-partner platform for Turkish university students and graduates. Visual vernacular comes from Turkish campus life: **blue ballpoint ink** ("tükenmez mavisi") for actions, the **violet official stamp** ("mühür moru") for document verification, cool paper for the background, and a **discipline color system** where every discipline group has a color. The one memorable element is the **discipline spine**: a project's sought disciplines shown as stacked color segments on the card's left edge (and as a horizontal band on the project page). Everything else stays quiet: hairline borders, no decorative gradients, no drop shadows on cards.

### Tokens — `src/app/globals.css` (Tailwind v4)
Define raw values as CSS variables on `:root`, override them in `@media (prefers-color-scheme: dark)`, and expose them with `@theme inline` so utilities like `bg-paper`, `text-ink-2`, `border-line`, `bg-pen`, `text-stamp` exist.

| token | light | dark | use |
|---|---|---|---|
| paper | #F4F6F9 | #0F1222 | app background |
| surface | #FFFFFF | #171B30 | cards, bars, sheets |
| surface-2 | #EEF1F6 | #1F2440 | inputs, chips, subtle fills |
| ink | #161A33 | #ECEEF7 | primary text |
| ink-2 | #4B5070 | #B3B8D3 | secondary text |
| ink-3 | #7A7F9A | #858AA8 | meta text, placeholders, inactive icons |
| line | #DFE3EC | #2A3050 | borders, dividers |
| pen | #2340C8 | #7B93FF | primary actions, links, focus ring |
| pen-ink | #FFFFFF | #0F1222 | text on pen |
| pen-soft | #E6EAFB | #222A55 | selected/active fills |
| stamp | #7A3FA8 | #C49BEA | verification |
| stamp-soft | #F1E9F8 | #2C2143 | verification fills |
| ok / ok-soft | #1E7F4F / #E3F3EA | #5BCB8F / #173327 | success |
| warn / warn-soft | #A86A00 / #FBF1DC | #E9B44C / #3A2E12 | pending, manual review |
| danger / danger-soft | #C2362E / #FBE6E4 | #FF7B72 / #3D1A1A | errors, destructive |

Discipline colors as `--d-<id>` (light / dark): yazilim #0B7285 / #22B8CF, elektronik #E8590C / #FF8A3D, makine #495057 / #ADB5BD, endustri #E0A800 / #F2C230, mimarlik #9C6644 / #C08A63, tasarim #D6336C / #F06595, isletme #2F9E44 / #51CF66, saglik #C92A2A / #FF6B6B, hukuk #3B5BDB / #748FFC, sosyal #845EF7 / #9775FA, temel #74B816 / #94D82D, sanat #AE3EC9 / #DA77F2. Components reference `var(--d-<id>)`, never the hex from taxonomy.ts.

Radii by hierarchy (expose as `--radius-*`): chips/search/pill buttons 999px; inputs and buttons 12px; cards 16px; sheets 22px (top corners). Shadows: none on cards. Only floating layers: Paylaş button `0 8px 18px -8px color-mix(in srgb, var(--pen) 70%, transparent)`, sheets `0 -16px 40px -16px rgb(22 26 51 / .35)`.
Body: `bg-paper text-ink`, `-webkit-tap-highlight-color: transparent`, `font-feature-settings: "ss01"` off — keep defaults. Respect `prefers-reduced-motion` (disable transitions/animations globally inside that media query).

### Typography
- One family: **Geologica** via `next/font/google` (`subsets: ["latin", "latin-ext"]`, `variable: "--font-sans"`, `display: "swap"`), fallback `system-ui, sans-serif`. Set `--font-sans` in `@theme`.
- Scale (px / line-height / weight): meta 13/1.4/450, body 15/1.55/400, label 14/1.3/550, card title 18/1.25/650, section title 20/1.25/700, page title 26/1.15/750 with `letter-spacing: -0.015em`, hero 36/1.05/800 (40 at ≥ 400 px width) with `-0.025em`. Provide utility classes in globals.css: `.t-meta`, `.t-body`, `.t-label`, `.t-card`, `.t-section`, `.t-page`, `.t-hero`. Sentence case everywhere; no uppercase transforms.
- Line length: text blocks `max-width: 68ch`.

### Layout
```
┌──────────────────────────────────────┐ TopBar 60px, surface, bottom border line, sticky
│ (av36)  ( 🔍  Endüstriyel tasarımcı ara… ) (🔔) │ avatar · flexible search pill 44px · bell 44px target
├──────────────────────────────────────┤
│  page content, px-4, column max 640px centered │
│                                      │
├──────────────────────────────────────┤ BottomNav 64px + safe-area, surface, top border line, fixed
│  ⌂ Ana Sayfa  ⧉ Network  (＋)  ✉ Mesajlarım  ▦ Projeler │ Paylaş = 52px pen circle raised 14px, label below
└──────────────────────────────────────┘
```
Content gets bottom padding so the fixed nav never covers it. Left-aligned text throughout (only empty states centered).

## Files to create

### Root and route groups
- `src/app/layout.tsx`: `<html lang="tr">`, Geologica, metadata (title template "%s · Proje Arkadaşım", default "Proje Arkadaşım", description), `viewport` export with `themeColor` light #F4F6F9 / dark #0F1222, `viewportFit: "cover"`.
- `src/app/icon.svg`: mark = three short vertical rounded bars side by side in `#0B7285`, `#D6336C`, `#E8590C` on transparent (a mini discipline spine).
- `src/app/(app)/layout.tsx`: renders `<TopBar/>`, `<main>` (column, `pb-[calc(88px+env(safe-area-inset-bottom))]`), `<BottomNav/>`.
- `src/app/(auth)/layout.tsx`: minimal: logo wordmark linking to "/", centered column max 420px, no bottom nav.
- `src/app/not-found.tsx`, `src/app/(app)/error.tsx` ('use client', retry button), `src/app/(app)/loading.tsx` (skeleton lines).
- **Move** the scaffold's `src/app/page.tsx` into `src/app/(app)/page.tsx` (stub) and delete the scaffold demo content/assets in `public/` that are unused.

### UI primitives — `src/components/ui/`
`button.tsx` (variants: primary pen, secondary surface+line border, ghost, danger; sizes md 44px / sm 36px; `asChild`-free: export `Button` and `ButtonLink` (next/link) sharing classes; loading state with spinner), `input.tsx`, `textarea.tsx` (auto rows), `select.tsx` (native select styled), `field.tsx` (label + control slot + hint + error text, wires `aria-describedby`/`aria-invalid`), `checkbox.tsx`, `switch.tsx`, `card.tsx` (surface, border line, radius 16), `avatar.tsx` (sizes 28/36/48/72/96; image from `avatarUrl(path)` else initials on `var(--d-<disciplineGroup>)` or a deterministic palette color from username hash; white initials), `badge.tsx` (count badge, pen bg, min 18px), `chip.tsx` (neutral surface-2; `selected`; optional leading color dot via `dotColor` prop), `tabs.tsx` (link tabs with `?sekme=` style hrefs, active underline 2px pen), `sheet.tsx` ('use client'; bottom sheet using native `<dialog>`, drag handle, closes on backdrop/Escape, focus trap via dialog; title prop), `empty-state.tsx` (icon, title, text, optional action; centered), `spinner.tsx`, `page-header.tsx` (title `.t-page`, optional description and right slot), `section.tsx` (section title `.t-section` + children), `toast.tsx` (minimal client toast via query param `?bildirim=` is NOT needed — skip toast).
Export a `cn()` helper in `src/lib/cn.ts` using clsx.

### Domain components — `src/components/common/`
- `discipline-spine.tsx`: props `groups: string[]`, `orientation: "vertical" | "horizontal"`. Vertical: 6px wide, fills parent height, equal segments with 3px gaps, rounded 999px. Horizontal: 8px tall, full width. Unknown/empty → single `line`-colored segment. `aria-hidden` (chips carry the text).
- `discipline-chip.tsx`: Chip with color dot `var(--d-<id>)` and label from taxonomy.
- `verified-stamp.tsx`: props `size: "sm" | "lg"`, `academicStatus?`. sm: 18px circle, 1.5px stamp ring, check icon, rotated -8deg, `aria-label="Belgesi doğrulandı"`, `title` same. lg: stamp circle + text "Doğrulanmış öğrenci" / "Doğrulanmış mezun" in stamp color on stamp-soft pill.
- `project-card.tsx`: props `project: ProjectCardData`, `viewer: { verificationStatus: string } | null`. Layout: Card with the vertical spine on the left edge (inset 10px top/bottom), content padding-left 22px; title `.t-card` (link to `/projeler/[id]`, whole card clickable via stretched link), summary (2-line clamp, ink-2), chips row: category, stage, work mode (+ city), then "Aranan" row with up to 3 DisciplineChips + "+N", footer: Avatar 28 + owner name via `displayName(owner, viewer)` + VerifiedStamp sm + university (ink-3, truncated) + relative time ("3 gün önce", Turkish, via `src/lib/time.ts` `relativeTimeTr(date)`). Closed projects show a "Kapandı" chip and reduced opacity spine.
- `user-row.tsx`: Avatar 48, name (full — only used for verified viewers), VerifiedStamp sm, line 2: department + university (ink-2), optional `reason` line (ink-3), right `action` slot.
- `logo.tsx`: wordmark "Proje Arkadaşım" (weight 750, -0.02em) preceded by the 3-bar mark.

### DTOs — `src/lib/dto.ts`
```ts
export type PersonSummary = { id: string; username: string; firstName: string; lastName: string; avatarPath: string | null; university: string | null; department: string | null; disciplineGroup: string | null; academicStatus: string | null; verified: boolean };
export const personSummarySelect = { id: true, username: true, firstName: true, lastName: true, avatarPath: true, university: true, department: true, disciplineGroup: true, academicStatus: true, verificationStatus: true } as const;
export function toPersonSummary(row): PersonSummary // verified = verificationStatus === "VERIFIED"
export type ProjectCardData = { id: string; title: string; summary: string; category: string; stage: string; workMode: string; city: string | null; status: string; createdAt: Date; disciplineGroups: string[]; openRoleCount: number; owner: PersonSummary };
export const projectCardInclude // owner: { select: personSummarySelect }, roles: { select: { disciplineGroup, slots, id } }, _count members
export function toProjectCardData(row): ProjectCardData // disciplineGroups = unique role groups in role order
```
- `src/lib/avatar.ts`: `avatarUrl(path: string | null): string | null` → `/api/avatar/${encodeURIComponent(path)}` (served later by task 11).
- `src/lib/time.ts`: `relativeTimeTr(date: Date, now = new Date())` → "az önce", "5 dakika önce", "3 saat önce", "dün", "4 gün önce", "2 hafta önce", else `d MMMM yyyy` in tr-TR (`Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" })`).

### Shell — `src/components/shell/`
- `top-bar.tsx` (server): loads `getCurrentUser()`, `getSearchSuggestions(user)`, initial counters (via the same function the API uses), renders AvatarMenu, SearchBar, NotificationBell.
- `avatar-menu.tsx` ('use client'): button with Avatar 36 (guest: `UserRound` icon in surface-2 circle). Opens Sheet titled with user's name. Items (each 48px row, icon + label): Profilim (`/u/<username>`), Projelerim (`/projeler?filtre=benim`), Belge durumu (`/dogrulama`, with status chip using VERIFICATION_STATUSES label), Ayarlar (`/ayarlar`), Gizlilik ve KVKK (`/kvkk/aydinlatma`), Yardım (`/yardim`), Yönetim paneli (`/admin`, only if `isAdmin` passed as prop), Çıkış yap (form posting `logoutAction`). Guest items: Giriş yap, Hesap oluştur, Gizlilik ve KVKK, Yardım.
- `search-bar.tsx` ('use client'): `<form action="/ara" role="search">` with `<input name="q" type="search" enterKeyHint="search" aria-label="Proje veya kişi ara">`. Native placeholder empty; an absolutely positioned overlay `<span aria-hidden>` shows suggestions[i] in ink-3, cross-fading every 3.5 s (opacity transition 400ms; no rotation when reduced motion; hidden when input has text). On focus, a panel under the bar lists all suggestions as tappable rows (tap → fills input and submits). Initial value from current `q` search param on `/ara`.
- `notification-bell.tsx` ('use client'): link to `/bildirimler`, `Bell` icon, Badge with count from counters (hidden for guests: then the bell links to `/giris?next=/bildirimler`).
- `bottom-nav.tsx` ('use client'): 5 items in this order — Ana Sayfa `/` (House), Network `/network` (Users), Paylaş `/paylas` (Plus, the raised pen circle), Mesajlarım `/mesajlar` (MessageCircle), Projeler `/projeler` (LayoutGrid). Active = `usePathname()` match (exact for "/", prefix for others): ink color + label weight 650; inactive ink-3. Badges: Network = invites, Mesajlarım = messages + requests. Labels 11px/1.2 below icons. `aria-current="page"` on active.
- `use-counters.ts` ('use client'): `useCounters(initial)` — fetches `/api/me/counters` every 20 s and on `visibilitychange` to visible; shares state via a tiny module-level store + `useSyncExternalStore` so bell and nav read the same numbers.
- `src/lib/counters.ts` (server): `getCounters(userId): Promise<{ notifications: number; messages: number; requests: number; invites: number }>` —
  notifications = unread Notification count; invites = PENDING ProjectInvite where inviteeId = user; requests = Conversation status "REQUEST" where user is participant and `initiatorId != user`; messages = number of ACTIVE conversations (user is userA or userB, max 50 most recent) having at least one Message from the other user with `createdAt` > the user's `ConversationRead.lastReadAt` (no read row = all unread).
- `src/app/api/me/counters/route.ts`: GET → `{ authenticated: false }` for guests, else `{ authenticated: true, ...counters }`. `export const dynamic = "force-dynamic"`.
- `src/lib/search-suggestions.ts`: `getSearchSuggestions(user: { disciplineGroup, interestsJson, city } | null): string[]` — 4 to 6 strings. Guest → ["Yapay zeka projelerini ara…", "Mobil uygulama projesi ara…", "Endüstriyel tasarımcı ara…", "Girişim projelerini ara…"]. User: for each complement group of the user's disciplineGroup, a role phrase from a per-group map (yazilim "Yazılımcı ekip arkadaşı ara…", elektronik "Elektronik mühendisi ara…", makine "Makine mühendisi ara…", endustri "Endüstri mühendisi ara…", mimarlik "Mimar ara…", tasarim "Endüstriyel tasarımcı ara…", isletme "Pazarlama ve iş geliştirme ekip arkadaşı ara…", saglik "Sağlık alanından ekip arkadaşı ara…", hukuk "Hukukçu ekip arkadaşı ara…", sosyal "Sosyal bilimci ekip arkadaşı ara…", temel "Araştırmacı ekip arkadaşı ara…", sanat "Sanatçı ve içerik üreticisi ara…"); then up to 2 interests as "'<ilgi>' projelerini ara…"; then city as "<Şehir>'deki projeleri ara…" using correct Turkish locative suffix (implement `locativeTr(city)` covering vowel harmony and consonant hardening: İstanbul'daki, İzmir'deki, Ankara'daki, Bursa'daki, Eskişehir'deki, Sivas'taki, Muş'taki, Kars'taki, Bitlis'teki, Hatay'daki, Iğdır'daki, Tokat'taki, Rize'deki, Van'daki). Deduplicate, max 6.

### Route stubs
Create a minimal stub (PageHeader + one-line text "Bu sayfa hazırlanıyor.") for every route in spec §3.2 that does not exist yet, so navigation works: `(app)/network`, `(app)/paylas`, `(app)/mesajlar`, `(app)/mesajlar/[id]`, `(app)/projeler`, `(app)/projeler/[id]`, `(app)/projeler/[id]/duzenle`, `(app)/u/[username]`, `(app)/ara`, `(app)/bildirimler`, `(app)/dogrulama`, `(app)/ayarlar`, `(app)/kvkk/aydinlatma`, `(app)/kvkk/acik-riza`, `(app)/gizlilik`, `(app)/cerezler`, `(app)/kullanim-kosullari`, `(app)/yardim`, `(app)/admin`, `(app)/admin/dogrulamalar`, `(app)/admin/sikayetler`, `(auth)/giris`, `(auth)/kayit`, `(auth)/sifremi-unuttum`, `(auth)/sifre-sifirla/[token]`. Later tasks replace these files.
The `(app)/page.tsx` stub shows the page title "Ana sayfa".

### Design doc
Write `docs/design-system.md` (English or Turkish) documenting: tokens and when to use each, type classes, radii/shadow rules, the discipline spine/chip/stamp components and their props, every primitive with a usage example, copy rules from global constraints, layout rules (px-4, column 640, nav padding). Later tasks follow this document.

## Tests
- `src/lib/search-suggestions.test.ts`: guest list; yazilim user gets tasarim/isletme/elektronik phrases; interests; locative cases listed above.
- `src/lib/time.test.ts`: relative time buckets.
- `src/lib/counters.test.ts` (DB): invites, requests, unread messages logic (message from other after lastReadAt counts; own message doesn't; read row after message → 0).
- `src/lib/dto.test.ts`: toProjectCardData unique groups order, verified flag.

## Done when
`npm run dev` renders the shell on every stub route without errors (check `/`, `/projeler`, `/giris` with curl or by building), `npx next build` succeeds, checks pass, committed, report written including a short note on any design decision you had to make beyond this brief.
