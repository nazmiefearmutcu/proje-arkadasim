# Final fix wave report: social-messaging (social graph, messaging and badge counters)

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f` (`git rev-parse HEAD` before any change, branch `task-24`)
- Code commits:
  - `d6af76b` fix(messaging): inclusive poll cursor, hidden declines, block-aware badges, one counters poller
  - `73b2236` fix(social): block withdraws applications, keeps own requests; intro and follow notices deduped
  - `fc6d9e9` fix(ui): keep form input after a failed action; share-link focus and target; own-profile empty state
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it, given in the structured output)
- Files outside the packet: none. One new test file: `src/components/shell/use-counters.test.ts`.
- No schema change, no `npm install`, no `prisma generate`/`migrate`, no dev/build server.

## Items fixed

### R8 (Important): same-millisecond messages lost by the chat poll
- `src/lib/messaging/service.ts`: `getMessagesAfter` now uses `createdAt: { gte: after }` (inclusive cursor).
- `src/components/messaging/chat.tsx`: polled messages are still merged by id (`mergeMessages` skips ids already
  shown, so the message at the cursor that comes back on every poll is ignored). The cursor is set with
  `laterIso(current, newest)` so it stays at the newest `createdAt` and never moves backwards.
- Tests: `service.test.ts` "uses an inclusive cursor: two messages with the same createdAt are both returned"
  (cursor equal to the shared timestamp, both bodies returned). `tests/messages-route.test.ts` "treats the after
  value as inclusive ..." (route returns both messages at the cursor's millisecond, not the earlier one).

### F10 (Important): Mesajlarım badge counts chats with blocked users
- `src/lib/messaging/service.ts`: `blockedUserIds` is exported (unchanged logic, both block directions).
- `src/lib/counters.ts`: `getCounters` loads the blocked ids and adds `userAId notIn` and `userBId notIn` to the
  shared participant filter, so both the REQUEST count and the ACTIVE `findMany` exclude blocked pairs, exactly
  like `listConversations`.
- Tests (`src/lib/counters.test.ts`): an unread ACTIVE message from a user I blocked and from a user who blocked me
  is not counted (only the third, unblocked chat counts); the same for message requests in both directions.
  `moderation.test.ts` also checks the request badge is 0 during a block and 1 after the unblock.

### F27 (Minor): DECLINED leaked to the initiator
- `src/lib/messaging/service.ts`: new exported `visibleStatus(status, initiatorId, viewerId)` returns `REQUEST` when
  the status is `DECLINED` and the viewer is the initiator. Used in `getConversationForUser` (RSC `initialStatus`),
  `getMessagesAfter` (poll JSON) and, for consistency, `listConversations` (its rows are only rendered on the server
  today, but the row type now never carries the decline for the initiator). The recipient still sees `DECLINED`.
  The chat UI already treated REQUEST and DECLINED the same for the initiator, so nothing changes visually.
- Tests: `service.test.ts` unit test for `visibleStatus`, and "never returns DECLINED to the initiator from the
  detail, the poll or the list" (recipient still gets DECLINED). `tests/messages-route.test.ts` "does not reveal a
  declined request to the initiator" (the raw response text has no `DECLINED`).

### F38 (Minor): `listConversations` read every message from others
- `src/lib/messaging/service.ts`: replaced `findMany` + `distinct` with
  `db.message.groupBy({ by: ["conversationId"], where: { conversationId: { in: ids }, senderId: { not: userId } },
  _max: { createdAt: true } })`; the map is built from `_max.createdAt`. Behaviour is unchanged.
- Tests: all existing unread tests pass; new "uses the other side's latest message per conversation" covers two
  conversations (one read with only my newer message, one with a newer message from the other side).

### F34 (Minor): two counters pollers per tab, polling while hidden
- `src/components/shell/use-counters.ts`: one module-level poller with a subscriber count
  (`acquireCountersPoller`). The first signed-in subscriber starts the 20 s interval and the `visibilitychange`
  listener; the last one to unmount stops both (release is idempotent; responses that arrive after a stop are
  ignored). `refresh` does nothing while `document.visibilityState !== "visible"` and runs once when the tab becomes
  visible. A refresh asked for while a request is in flight is queued and runs once after it. `NotificationBell` and
  `BottomNav` still call `useCounters(initial)` unchanged; the shared snapshot store is as before.
- Tests (new `src/components/shell/use-counters.test.ts`, node environment with a stubbed `document` and `fetch`
  and fake timers): two subscribers make one request per tick and one listener; no request while hidden and one on
  becoming visible; the poller keeps running while one subscriber remains and stops after the last; double release
  is harmless; `refreshCounters` is a no-op without subscribers; a refresh during an in-flight request is not lost.

### F53 (Minor): badge stays stale after opening an unread chat
- `src/components/shell/use-counters.ts`: exported `refreshCounters()` triggers the shared refresh immediately.
- `src/components/messaging/chat.tsx`: called once after the chat's first successful poll (the poll has run
  `markRead`), so the Mesajlarım badge drops after about 3 s instead of up to 20 s.
- Tests: the `refreshCounters` behaviour is covered in `use-counters.test.ts`; the `markRead`-on-poll behaviour is
  covered by the existing "marks the conversation read on poll so the counter drops to zero".

### F44a (Minor): silent incoming messages, ignored unread label
- `src/components/messaging/chat.tsx`: the message list container has `role="log"`, `aria-live="polite"` and
  `aria-label="Mesajlar"`.
- `src/components/messaging/conversation-list.tsx`: the unread dot no longer has `aria-label`; it contains
  `<span className="sr-only">Okunmamış</span>`.
- Tests: markup only (no DOM test environment in this project); checked by tsc and lint.

### F12a (Important): block left pending join requests acceptable
- `src/lib/social/moderation.ts`: the block transaction adds `db.joinRequest.updateMany` for PENDING requests where
  the target applied to the viewer's projects or the viewer applied to the target's projects, setting
  `status: "WITHDRAWN", decidedAt: now`. `revalidatePath("/projeler")` was added. (The accept-side guard is F12b in
  another packet.)
- Tests (`moderation.test.ts`): "iki yönde bekleyen başvuruları geri çeker; başka projelerin başvurularına
  dokunmaz" (both directions become WITHDRAWN with `decidedAt`; a third person's project and an already REJECTED
  request are untouched).

### F35 (Minor): block declined the blocker's own requests
- `src/lib/social/moderation.ts`: the conversation `updateMany` now also requires `initiatorId: target.id`, so only
  requests the blocked person started become DECLINED. The blocker's own request stays REQUEST: it is hidden while
  the block lasts (`listConversations` and now `getCounters` filter blocked pairs) and `acceptRequest` refuses
  across a block.
- Tests (`moderation.test.ts`): blocker-started request stays REQUEST, is not listed or counted for the target and
  cannot be accepted during the block; after the unblock it is listed, counted, accepted and both can send.
  Target-started request becomes DECLINED and stays so after the unblock; the initiator sees REQUEST (F27) and gets
  the "pending" error, the blocker gets "Bu isteği reddettin.". The original block test still passes (renamed to
  say it declines the blocked person's request).

### F13 (Important): introductions re-notified daily and weekly
- `src/lib/social/suggestions.ts`:
  - The cooldown reads the latest Introduction for the viewer regardless of `dismissed`.
  - `INTRO_COOLDOWN_MS` is 7 days, so each viewer gets at most one batch per 7 days. `INTRO_REPEAT_MS` and
    `INTRO_SCAN` are gone.
  - Every candidate with any Introduction row for this viewer (any age, dismissed or not) is excluded. This is done
    in the candidate query (new internal `rankSuggestions(viewerId, limit, "any" | "dismissed")`), so the batch is
    the top 3 people suggested for the first time even when the best-scored people were introduced before.
    `getSuggestions` (Tanıştırmalar list and home) is unchanged: it still hides only dismissed rows.
  - Rows are written with `create` (with `createdAt: now`), never `upsert`, so `createdAt` is never refreshed. A
    concurrent second call that hits the unique `(userId, suggestedUserId)` constraint (P2002) skips that person
    without a notification. The function returns the number of rows actually created.
  - Reading of the spec: "kişi başı 7 günde en çok bir kez" (§4.6) is read as **per viewer** (one batch of at most
    3 introduction notifications per viewer per 7 days), and "ilk kez önerilen" as never re-introducing a person.
- Tests (`suggestions.test.ts`): the 24 h test now checks no new batch the next day or 1 ms before day 7, and that at
  day 7 only the two remaining first-time people are introduced; "partiyi gizlemek 7 günlük bekleme süresini
  atlatmaz" (dismiss all three, call again at once and 3 days later: nothing written); "8 gün önce tanıştırılan
  kişiyi yeniden tanıştırmaz ve bildirmez; satırın tarihi yenilenmez" (only the fresh person is notified and the old
  row keeps its `createdAt` and reason); introduced but not dismissed people still appear in `getSuggestions`.

### F60 (Minor): follow/unfollow loop floods FOLLOW notifications
- `src/lib/social/follow.ts`: after creating the follow, `notify` is skipped when a FOLLOW notification with
  `userId = target`, `actorId = viewer` was created in the last 7 days (`FOLLOW_NOTIFY_WINDOW_MS`).
- Tests (`follow.test.ts`): follow/unfollow three times then follow yields one notification; with an 8-day-old
  FOLLOW notification a new follow notifies again, and another follower is not affected.

### M52 (Minor): "Projeyi paylaş" link without focus ring and with a small target
- `src/components/social/profile-actions.tsx`: the Link uses `cn("t-label inline-flex min-h-11 w-fit items-center
  rounded-control text-pen ...", focusRing)`.

### M53 (Important): typed text lost after a failed form action
- `src/components/social/invite-sheet.tsx`: the message Textarea is controlled (`message` state).
- `src/components/social/report-sheet.tsx`: the reason Select is controlled (`reason` state).
- `src/components/messaging/start-form.tsx`: the first-message body is controlled (`body` state).
- Why the sheets also changed how they submit: React 19 resets the form after every `<form action>` (success or
  failure). A controlled textarea survives because React keeps its `defaultValue` equal to the value, but a
  controlled `<select>` does not: React never sets `defaultSelected` for a controlled select (checked in the bundled
  `react-dom` 19.1 `updateOptions(..., false)`), so `form.reset()` moves it to the first enabled option while state
  keeps the old value. That would also have hit the existing controlled project and role selects in the invite
  sheet (a resubmit could send the first project with "Rol fark etmez"). Both sheets therefore submit with
  `onSubmit` + `startTransition(() => formAction(formData))`, the pattern the auth forms already use, so no reset
  happens. `StartForm` keeps `<form action>` (progressive enhancement on the SSR page); its only field is a
  controlled textarea, which survives the reset.
- "Clear only on success": on success the sheets replace the form with the success panel and the state is dropped
  when the sheet closes (the form unmounts); `StartForm` redirects on success.
- Tests: no DOM test environment in this project; checked by tsc and lint and by reading the React DOM code above.

### F41b (Minor): own empty profile used third-person copy without an action
- `src/app/(app)/u/[username]/page.tsx`: when `isSelf` and there are no owned projects, the EmptyState says
  "Henüz proje paylaşmadın." (text "Bir proje paylaşınca burada görünür.") with a secondary `ButtonLink`
  "İlk projeni paylaş" to `/paylas` (secondary, like the other empty-state actions). Other viewers still see
  "Henüz proje paylaşmadı".

## Items not fixed

None.

## Checks

- `npx tsc --noEmit`: pass (no output).
- `npm run lint`: pass (no output).
- `npx vitest run`: 52 test files, 497 tests passed.
