# Task 10 — Notifications page and search

Read `docs/superpowers/sdd/global-constraints.md` and `docs/design-system.md` first. Spec sections: §4.8, §4.9, §2 (guests search projects only).
Available: Notification model + `NotificationType` union (`src/lib/notify.ts`), `listProjects` (task 7), `searchTokens`/`foldTr`, DTOs, `ProjectCard`, `UserRow`, `relativeTimeTr`, follow button (`src/components/social/follow-button.tsx`), UI primitives, search bar (task 3) that submits to `/ara?q=`. Stubs exist for `/bildirimler` and `/ara` — replace them.

## 1. Notifications
- `src/lib/notifications/format.ts` — pure `formatNotification(n: { type; data; actor?: { firstName; lastName } | null; project?: { id; title } | null; conversationId?: string | null }): { text: string; href: string; icon: "follow" | "request" | "accepted" | "rejected" | "invite" | "message" | "verification" | "intro" | "project" }`. Turkish texts (actor full name; project title in quotes):
  - FOLLOW "<Ad Soyad> seni takip etmeye başladı." → `/u/<username>` (include actor username in the input)
  - JOIN_REQUEST "<Ad Soyad>, “<Proje>” projene katılmak istiyor." → `/projeler/<id>#basvurular`
  - JOIN_ACCEPTED "“<Proje>” ekibine kabul edildin." → project
  - JOIN_REJECTED "“<Proje>” için başvurun bu kez kabul edilmedi." → project
  - INVITE "<Ad Soyad> seni “<Proje>” projesine davet etti." → `/network?sekme=davetler`
  - INVITE_ACCEPTED "<Ad Soyad>, “<Proje>” davetini kabul etti." → project
  - INVITE_DECLINED "<Ad Soyad>, “<Proje>” davetini kabul etmedi." → project
  - MESSAGE_REQUEST "<Ad Soyad> sana mesaj isteği gönderdi." → `/mesajlar?sekme=istekler`
  - MESSAGE_REQUEST_ACCEPTED "<Ad Soyad> mesaj isteğini kabul etti." → `/mesajlar/<conversationId>`
  - VERIFICATION_RESULT by `data.status`: APPROVED "Belgen doğrulandı. Artık proje paylaşabilir ve projelere katılabilirsin.", REJECTED "Belgen doğrulanamadı. Nedenini görmek için dokun.", MANUAL_REVIEW "Belgen manuel incelemeye alındı. Sonucu 24 saat içinde bildireceğiz." → `/dogrulama`
  - INTRODUCTION "Seni <Ad Soyad> ile tanıştıralım: <data.reason>" → `/u/<username>`
  - NEW_PROJECT_FROM_FOLLOWING "<Ad Soyad> yeni bir proje paylaştı: “<Proje>”" → project
  - Missing actor/project (deleted) → generic fallback text "Bu bildirimin içeriği artık mevcut değil." → `/bildirimler`.
- `src/app/(app)/bildirimler/page.tsx` — `requireUser("/bildirimler")`. PageHeader "Bildirimler" with right slot form button "Tümünü okundu yap" (server action). List newest first, 30 per page (`?sayfa=`): icon in a 36px circle (stamp tint for verification, pen tint otherwise), text (unread → weight 600 + pen dot), relative time. Each row is a link to `/bildirimler/git/<id>`. Group headers "Bugün", "Bu hafta", "Daha önce" (real chronological grouping). Empty: "Henüz bildirimin yok. Takip ettiğin kişiler proje paylaştığında burada göreceksin."
- `src/app/(app)/bildirimler/git/[id]/route.ts` — GET: own notification only (else redirect `/bildirimler`), set readAt if null, redirect (303) to the formatted href.
- `src/lib/notifications/actions.ts` — `markAllReadAction()`.

## 2. Search
- `src/lib/search.ts`:
  - `searchProjects(q, { limit = 20 })` → `ProjectCardData[]` — delegate to `listProjects({ q })` or equivalent (OPEN only).
  - `searchPeople(q, viewerId, { limit = 20 })` → `{ person: PersonSummary; following: boolean }[]` — VERIFIED users, excluding blocked either way and the viewer; AND of tokens over `searchText`; order: exact username match first, then by `verifiedAt` desc.
  - Queries shorter than 2 chars after folding → empty results.
- `src/app/(app)/ara/page.tsx` — public. `q` from searchParams; tabs `?tur=projeler` (default) | `kisiler`. Header line "“<q>” için sonuçlar". Projeler tab: ProjectCard list (empty → "Bu aramaya uyan proje bulamadık. Farklı bir kelime dene veya tüm projelere göz at." + link). Kişiler tab: guests and unverified users see a prompt card ("Kişileri aramak için giriş yapıp belgeni doğrulaman gerekiyor.") with the right button; verified users get UserRows with follow buttons. When `q` is empty show the viewer's search suggestions (from `getSearchSuggestions`) as tappable chips linking to `/ara?q=<suggestion without the trailing " ara…" phrase>` — implement `suggestionToQuery(s)` in `src/lib/search-suggestions.ts` (strip trailing "ara…", quotes and "projelerini"/"projeleri"/"'deki" words sensibly; e.g. "Endüstriyel tasarımcı ara…" → "endüstriyel tasarımcı", "'yapay zeka' projelerini ara…" → "yapay zeka", "İzmir'deki projeleri ara…" → "İzmir"), with tests.
- Ensure the top search bar shows the current `q` on `/ara` (task 3 should already do this; fix if not).

## Tests
- `src/lib/notifications/format.test.ts` — every type, plus deleted actor/project fallback.
- `src/lib/search.test.ts` (DB): Turkish-insensitive matching ("istanbul" finds "İstanbul" project, "isik" finds "Işık" user), multi-token AND, blocked users excluded, unverified excluded, short query empty.
- `src/lib/search-suggestions.test.ts` — add `suggestionToQuery` cases.
- `tests/notification-redirect.test.ts` — the `git/[id]` route marks read and redirects; someone else's id redirects to `/bildirimler` without changes.

## Done when
Bell badge → list → tap → target page and badge decreases; search works for projects (guest) and people (verified); checks pass; committed; report written.
