# Task 10 report: Notifications page and search

- BASE: `8f6ac3328177bdbe2bd01aed19243e62bed7685d` (`git rev-parse HEAD` before any change, branch `task-10`)
- Code commit: `d8361d7e5f8defccc4d488c9742f263babad0767` (feat: notifications page, notification redirect and people/project search)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made)

## What was built

### Notifications
- `src/lib/notifications/format.ts`: pure `formatNotification({ type, data, actor, project, conversationId })`
  returning `{ text, href, icon }` for all 12 notification types, with the Turkish copy from the brief.
  A missing actor, project or conversation, an unknown verification status, or an unknown type gives
  the generic text "Bu bildirimin içeriği artık mevcut değil." with href `/bildirimler`.
  Exports `FALLBACK_TEXT` and the `NotificationIcon` union.
- `src/lib/notifications/group.ts`: `notificationGroupOf(createdAt, now)` and `groupNotifications(items, now)`.
  Chronological grouping from timestamps: "Bugün" (since local midnight), "Bu hafta" (the six days before
  today), "Daha önce". Empty groups are dropped and the input order is kept.
- `src/lib/notifications/actions.ts` (`'use server'`): `markAllReadAction()` marks the viewer's unread rows
  read and revalidates the root layout so the bell badge refreshes. Returns `ActionResult`.
- `src/app/(app)/bildirimler/page.tsx`: `requireUser("/bildirimler")`. PageHeader "Bildirimler" with the
  "Tümünü okundu yap" form button. 30 per page via `?sayfa=` (one extra row fetched to detect more; "Daha
  fazla göster" link). Rows are links to `/bildirimler/git/<id>`, 36 px icon circle (stamp tint for
  verification, pen tint otherwise). Unread rows use weight 600, a pen dot and a screen-reader "Okunmadı:"
  prefix. Relative time via `relativeTimeTr`. Empty state as specified.
- `src/app/(app)/bildirimler/git/[id]/route.ts` (`runtime = "nodejs"`, `force-dynamic`): GET. A guest goes to
  `/giris?next=/bildirimler/git/<id>`. Own notification: sets `readAt` only when it is null (`updateMany`
  guarded by userId and readAt), then 303 to the formatted href. Someone else's or a missing id: 303 to
  `/bildirimler`, no write.

### Search
- `src/lib/search.ts`:
  - `isSearchableQuery(q)`: folded length at least 2 and at least one token of length 2 or more.
  - `searchProjects(q, { limit })`: delegates to `listProjects({ q, pageSize })` (OPEN only, one AND
    `contains` per token). A non-searchable query gives `[]`.
  - `searchPeople(q, viewerId, { limit })`: VERIFIED users only; excludes the viewer and users blocked in
    either direction; AND of tokens over `searchText`. An exact username match (handle with leading `@`
    stripped, lowercased with tr-TR) is returned first; the rest are ordered by `verifiedAt` desc, then id
    desc. `following` comes from a Follow lookup for the returned ids. A non-searchable query gives `[]`.
- `src/app/(app)/ara/page.tsx` (public): `q` (trimmed, max 80 chars) and `tur` (`projeler` default,
  `kisiler`). Header line "“<q>” için sonuçlar". With an empty `q`, the viewer's suggestions from
  `getSearchSuggestions` are shown as chips (44 px) linking to `/ara?q=<suggestionToQuery(s)>`.
  - Projeler: `ProjectCard` list, or the empty state "Bu aramaya uyan proje bulamadık." with a link to
    `/projeler`.
  - Kişiler: guests get the prompt card with "Giriş yap" (next = current search URL); logged-in unverified
    users get the prompt with "Belgeni doğrula" (`/dogrulama`). Verified users get `UserRow` items named by
    `displayName` with a "Profili gör" link to `/u/<username>`. No follow button (the task 8 merge step adds it).
  - Tabs are rendered inline (a nav of links that keeps `q`); the shared `Tabs` component cannot keep `q`.
- `src/lib/search-suggestions.ts`: `suggestionToQuery(suggestion)` strips the trailing "…", " ara",
  " projelerini" / " projeleri" / " projesi", a surrounding single-quote pair, and the locative suffix
  (`'deki`, `'taki`, and similar). Examples in the tests: "'robotik' projelerini ara…" gives "robotik",
  "İzmir'deki projeleri ara…" gives "İzmir", "Mobil uygulama projesi ara…" gives "Mobil uygulama".
- The top search bar already shows the current `q` on `/ara` (task 3 `SearchBar`); no change was needed.

## Files
- New: `src/lib/notifications/format.ts`, `format.test.ts`, `group.ts`, `group.test.ts`, `actions.ts`;
  `src/app/(app)/bildirimler/git/[id]/route.ts`; `src/lib/search.ts`, `src/lib/search.test.ts`;
  `tests/notification-redirect.test.ts`; this report.
- Replaced stubs: `src/app/(app)/bildirimler/page.tsx`, `src/app/(app)/ara/page.tsx`.
- Extended: `src/lib/search-suggestions.ts` (`suggestionToQuery`), `src/lib/search-suggestions.test.ts`
  (suggestionToQuery cases).
- Nothing under `src/components/social/` or `src/lib/social/` was created. `prisma/schema.prisma` is untouched.

## Tests (new)
- `format.test.ts`: every type, verification statuses, deleted actor / project / conversation fallbacks,
  unknown type.
- `group.test.ts`: boundaries of Bugün / Bu hafta / Daha önce, order kept, empty groups dropped.
- `search-suggestions.test.ts`: `suggestionToQuery` cases and non-empty output for every generated suggestion.
- `search.test.ts` (DB): Turkish-insensitive match ("istanbul" finds "İstanbul", "isik" finds "Işık"), multi-token
  AND (projects and people), closed projects hidden, blocked users excluded both ways, unverified excluded,
  viewer excluded, following flag, exact username first then `verifiedAt` desc, short queries empty.
- `tests/notification-redirect.test.ts` (DB): own unread notification marked read and redirected to its
  target; an already-read notification keeps its `readAt`; someone else's notification redirects to
  `/bildirimler` with no change; a missing id redirects; a guest goes to `/giris` with `next`.

## Verification
- `npx tsc --noEmit`: exit 0.
- `npm run lint` (eslint): exit 0.
- `npx vitest run`: the 33 test files excluding `tests/verification-service.test.ts` pass (327 tests). That
  file run on its own passes (10 tests). New test files: 4 unit files (61 tests) and 2 DB files (17 tests),
  all passing.

## Decisions where the brief was silent
- The notification name in text uses the full name (as the brief says), not `displayName`.
- Grouping uses the server's local calendar day; "Bu hafta" is the six days before today (rolling), not
  the ISO week.
- Notification list pagination is "Daha fazla göster" (same pattern as /projeler).
- `isSearchableQuery` requires two folded characters and a token of at least two characters; below that the
  search returns no rows and the page shows "Aramak için en az iki harf yaz.".
- Suggestion chips keep the original casing. The brief's example "endüstriyel tasarımcı" was lowercased, but
  search is case-insensitive, so the casing is kept (documented in the function comment).
- Unverified logged-in users get a shorter prompt ("Kişileri aramak için belgeni doğrulaman gerekiyor.") than
  guests, who keep the brief's wording.
- Notification `dataJson` is parsed defensively (a non-object or invalid JSON becomes `{}`).
- Read-marking happens on GET as the brief requires. The route only reads the viewer's own row and writes
  `readAt`, so a cross-site GET can mark at most one of the viewer's notifications read.

## Concerns
- Attribution: the commit trailer used is `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` because the
  session attribution reminder asks for it. The task text and `global-constraints.md` ask for
  "Claude Opus 5.5". The orchestrator should pick one and fix it at merge if needed.
- Full-suite runs: running `vitest run` while another vitest run uses `prisma/test.db` in the same worktree
  stalled in my environment; running the suite alone is fine, and the verification-service file passes alone.
  Not a code issue, but worth a note for the merge agent when several worktrees run tests.
- Follow button: the people results have no follow button until the task 8 merge step adds it (per the orchestrator note).
- `/bildirimler/git/[id]` uses GET for a state change (a brief requirement); see the decision above.

## Fix round 1

- BASE (`git rev-parse HEAD` before any change): `91439980121dc7ea8183180aa5e8f0a991ff622d`
- Fix commit: `180583c7a3ae307c302cfa5fb2c9479a6cd29eda` (fix(search): top search bar submits the suggestion query)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made)

### Findings addressed
- Important, `src/components/shell/search-bar.tsx` (suggestion dropdown): accepted. Tapping a suggestion
  submitted the raw hint text (for example "'robotik' projelerini ara…"), so the search found nothing. The
  reviewer is right and my earlier report was wrong to say the search bar needed no change. The `onClick`
  now computes `const query = suggestionToQuery(suggestion)` and uses it for both `setValue(query)` and
  `router.push(`/ara?q=${encodeURIComponent(query)}`)`. `suggestionToQuery` is imported from
  `@/lib/search-suggestions`. Its dependencies (`@/config/taxonomy`, `@/lib/tr`, `@/lib/json-fields`) carry no
  server-only code, so the client component can import it. The URL-sync effect still sets the box from `q`
  on `/ara`.

### Findings disputed
- None. The only open finding was the one above.

### Spec gaps
- No additional spec gaps were reported for this round. The check in this round covered the
  dropdown submit path only; the `/ara` chip links already used `suggestionToQuery`.

### Trailer note
- The commit trailer is `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, as the session attribution
  reminder asks, not the "Claude Opus 5.5" line in the round's task text. The model running this round is
  Haiku 5.5, so the Opus trailer would misattribute the commit. The orchestrator should decide at merge if a
  different trailer is wanted. The same choice was made for the first commit (see Concerns above).

### Tests (round 1)
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run` (full suite): 34 test files passed, 337 tests passed, exit 0.
  The suite was run alone in this worktree.

No schema change, no changes under `src/components/social/` or `src/lib/social/`, no dev or build run.
