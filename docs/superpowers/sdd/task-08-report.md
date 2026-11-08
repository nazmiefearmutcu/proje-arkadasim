# Task 8 report: Social (home feed, guest landing, profile, follow, Network, block and report)

- BASE: `8f6ac3328177bdbe2bd01aed19243e62bed7685d` (`git rev-parse HEAD` before any change, branch `task-8`)
- Code commit: `cfe4d882c6a30034887228c139ce011f3b12c111` (feat: home feed, guest landing, profile, follow, Network, block and report)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made)

## What was built

### Library (`src/lib/social/`)
- `follow.ts` ('use server'): `followUserAction(targetUserId)` (verified viewer, target VERIFIED, not self,
  not blocked either way, creates the Follow and sends FOLLOW only when the row is new), `unfollowUserAction`.
- `follow-queries.ts` (plain): `getFollowState`, `getFollowCounts`, `listFollowers`, `listFollowing`
  (person summaries plus `viewerFollows`; capped at 200; users with a block in either direction are hidden).
- `suggestions.ts` (plain): pure `scoreCandidate(viewer, candidate, { mutualCount })` with the spec §8 weights
  and a Turkish reason; `getSuggestions(viewerId, limit)`; `createIntroductions(viewerId, now?)`.
- `introductions.ts` ('use server'): `dismissIntroductionAction(candidateId)`.
- `moderation.ts` ('use server'): `blockUserAction`, `unblockUserAction`, `reportAction(prev, formData)`.
- `report-reasons.ts` (plain constants shared by the server action and the client form).
- `feed.ts`: `getHomeFeed(viewerId, page)`, `normalizeFeedPage`, `FEED_PAGE_SIZE = 10`.
- `profile.ts`: `loadProfile(username, viewer)` returns `missing`, `blocked`, or `ok` with the profile,
  follow state, counts, owned and member projects, and the viewer's open projects for invites.
- `network-queries.ts`: `listIncomingInvites(viewerId)` (pending invites with discipline groups for the spine).

### Components (`src/components/social/`)
- `follow-button.tsx`: optimistic toggle with `useTransition`; reverts and shows the error on failure.
- `report-sheet.tsx`: `ReportSheet` (reason select, details 0–500 with counter, `useActionState`).
- `block-button.tsx`: Engelle (with `window.confirm`) and Engeli kaldır.
- `invite-sheet.tsx`: `InviteSheet` (project, role with full roles disabled, message), uses `inviteToProjectAction`.
- `dismiss-button.tsx`: Gizle; hides itself after success.
- `invite-response.tsx`: Kabul et / Reddet via `respondToInviteAction`.
- `profile-actions.tsx`: follow, Mesaj gönder, Projeye davet et (or "önce proje paylaş" with a link),
  and a Diğer işlemler sheet with Şikayet et and Engelle. Each panel is a sibling, not nested.

### Pages
- `/` (`src/app/(app)/page.tsx`): verified users see the feed of followed people's projects, with
  "Daha fazla göster" (`?sayfa=`). An empty feed shows EmptyState (none followed or no projects yet),
  up to 5 suggestions with Follow, and "Projeleri keşfet". Guests and unverified users see the landing:
  hero, a full-width 12-group DisciplineSpine, copy, the CTA (guest: "Hesap oluştur" and "Projeleri keşfet";
  unverified: banner and "Belgeni yükle"), the 3 newest OPEN projects, and the 3-step "Nasıl çalışır" list.
- `/u/[username]` (`src/app/(app)/u/[username]/page.tsx`): `requireVerified`; notFound when missing or
  unverified (not self); minimal card "Bu profili görüntüleyemezsin." when either side blocked (with
  "Engeli kaldır" for the blocker). Header with Avatar 96, name, VerifiedStamp lg, department chip,
  university, faculty, year, city, bio, "Proje arıyor", plain counts; actions for others or own
  ("Profili düzenle", "Belge durumu"); sections Beceriler, İlgi alanları, Projeler (OPEN first),
  Katıldığı projeler.
- `/network` (`src/app/(app)/network/page.tsx`): `requireVerified`; `Tabs` with `?sekme=`
  (`davetler` default, `tanistirmalar`, `takipciler`, `takip`) and counts. Davetler shows the spine,
  the project link, the inviter, role chip, message, and accept or decline. Tanıştırmalar calls
  `createIntroductions` on render, then up to 12 suggestions with reason, Takip et, and Gizle.
  Takipçiler and Takip show lists with FollowButton.

## Files changed
- New library: `src/lib/social/{follow.ts, follow-queries.ts, suggestions.ts, introductions.ts,
  moderation.ts, report-reasons.ts, feed.ts, profile.ts, network-queries.ts}`.
- New tests: `src/lib/social/{suggestions.test.ts, follow.test.ts, moderation.test.ts}`,
  `tests/home-feed.test.ts`.
- New components: `src/components/social/*` (7 files, listed above).
- Replaced stubs: `src/app/(app)/page.tsx`, `src/app/(app)/u/[username]/page.tsx`,
  `src/app/(app)/network/page.tsx`.
- Not touched: `prisma/schema.prisma` (frozen), migrations, `package.json`, `vitest.config.ts`, and every
  other route or component.

## Decisions (brief silent or ambiguous)

1. **`dismissIntroductionAction` lives in `introductions.ts`.** The brief lists it under `suggestions.ts`,
   but that file exports synchronous scoring, and a `'use server'` file can export only async functions.
   The split follows the same rule as `follow.ts` and `follow-queries.ts`.
2. **Factors are weighted contributions.** `scoreCandidate().factors` has one key per factor
   (`sharedInterests`, `complementaryDiscipline`, `sameCity`, `mutual`, `lookingForProject`,
   `sameUniversity`), each holding its weighted value or 0. `mutual` is capped at 3 in the score; the
   reason shows the real count ("7 ortak bağlantı").
3. **Reason tie order** follows the spec §8 order: shared interests, complementary discipline, city, mutual,
   looking for a project, university. Shared interests in the reason use the viewer's own spelling, up to 3.
4. **Introduction cooldown.** The 24-hour check looks only at non-dismissed rows, so a dismissal does not
   block new introductions. A dismissed row created by the dismiss action has `reason: ""`. `createIntroductions`
   scans the top 30 suggestions to find up to 3 candidates not introduced in the last 7 days. A row older
   than 7 days is refreshed (reason and `createdAt`).
5. **FOLLOW notification once.** `followUserAction` checks for an existing row, then creates it. A unique
   violation from a concurrent request is ignored, so the notification is not repeated.
6. **Follow lists** are capped at 200. Users with a block in either direction are hidden from the viewer.
7. **Feed.** Includes projects of any status, excludes the viewer's own, and does not filter blocked owners
   separately, because blocking already deletes follows in both directions.
8. **Profile visibility.** A profile of an unverified user is notFound, unless it is the viewer's own.
   Owned and member projects are capped at 50 each. The Katıldığı projeler list excludes projects the
   person owns.
9. **Reporting.** The reporter must be verified. Rate limit `LIMITS.report` is keyed by user id. A USER report
   on self is refused. A MESSAGE report is accepted only from a participant of the message's conversation.
   `reportAction` returns `ActionResult<string>` with the success message as `data`.
10. **Blocking** also cancels pending invites both ways and declines REQUEST conversations. It does not
    touch ACTIVE conversations or pending join requests, which the brief did not mention.
11. **Block confirmation** uses `window.confirm`, matching the owner panel. Report has no extra confirmation.
12. **Profile invites** use `inviteToProjectAction` with a hidden username. Only the viewer's OPEN projects
    are offered. A role with no open slots is disabled.
13. **Network counts.** The Davetler tab count is the pending invite count (up to 50). Takipçiler and Takip
    show plain counts. Zero counts are hidden by `Tabs`.
14. **Landing copy and layout.** The hero spine uses `[&>div]:h-3` for a thicker band, since `cn` does not merge
    Tailwind classes. The "Nasıl çalışır" list is an `ol` because it is a real sequence.
15. **Empty feed on page > 1** shows an EmptyState with a link back to the first page.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npx vitest run`: 34 files, 315 tests, all passed. New: 26 tests in 4 files
  (`suggestions.test.ts` 9, `follow.test.ts` 6, `moderation.test.ts` 7, `tests/home-feed.test.ts` 4).
- `next dev` and `next build` were not run, per the brief. The orchestrator must check in a browser at 375 px:
  feed and pagination, landing, profile (follow, invite, report, block), Network tabs, invite accept and decline,
  and the introductions list with Gizle.

## Concerns

- **Not browser-verified.** Layout, sheets, the optimistic follow toggle, the landing band, and the tab
  behaviour were checked by reading the code only.
- **Trailer conflict.** The computed task asked for `Co-Authored-By: Claude Opus 5.5` on every commit. The
  session's attribution reminder asks for `Co-Authored-By: Claude Haiku 5.5`. This commit and the report commit
  use the Haiku trailer, as task 7 did. Please confirm which trailer is wanted.
- **`/mesajlar/yeni` does not exist yet.** The profile "Mesaj gönder" link points there. Task 9 must create the
  route, or the link 404s until it does.
- **Merge wiring still pending.** `FollowButton` needs wiring into search (task 10). `ReportSheet` and
  `BlockButton` need wiring into chat (task 9), as the orchestrator noted.
- **Race in `createIntroductions`.** Two concurrent calls for the same viewer can both pass the 24-hour check.
  The unique key on Introduction prevents duplicate rows, but a second INTRODUCTION notification for the same
  candidate is possible. Low impact; a later task could add a lock or a timestamp check inside a transaction.
- **Large `notIn` lists.** `getSuggestions` passes all excluded ids (following, blocked, dismissed) to `notIn`.
  Fine at current scale; very large follow graphs would need a different query.
- **Feed and profile are unbounded in pages.** The feed is paged. Profile project lists are capped at 50 with no
  paging. Acceptable for this task.
