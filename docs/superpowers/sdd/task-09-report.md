# Task 9 report: Messaging with message requests

- BASE: `a15fa00d370b97171f815a45bb7ac3f95f62b3b7` (`git rev-parse HEAD` before any change, branch `task-9`)
- Code commit: `6cca20d6c67086e93310efb7922f8e072353e111` (feat: messaging with message requests)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made, given in the final reply)

## What was built

### Library (`src/lib/messaging/`)
- `types.ts` (client-safe, no db): `MessageDTO` (`id, body, createdAt ISO, mine`), `ConversationStatus`,
  `normalizeBody` (trim, 1 to 2000 characters), `truncateText` (80 characters, `…`), `previewText` (`Sen: ` prefix).
- `format.ts` (client-safe): `dayLabel` (Bugün, Dün, `d MMMM yyyy`), `clockLabel` (HH:mm), `isGroupEnd` (sender
  change, day change or a gap over 5 minutes ends a group).
- `service.ts` (plain server functions, db-backed): `pairKey`, `findConversation`, `startConversation`,
  `sendMessage`, `acceptRequest`, `declineRequest`, `listConversations(userId, "chats" | "requests")`,
  `getConversationForUser`, `getMessagesAfter`, `markRead`. Error copy is in exported `MSG_*` constants.
- `actions.ts` (`'use server'`): `startConversationAction(prev, formData)` (redirects to `/mesajlar/<id>`),
  `sendMessageAction(conversationId, body)`, `acceptRequestAction(id)`, `declineRequestAction(id)` (redirects to
  `/mesajlar?sekme=istekler`). All check the verified user first and return `ActionResult`.

### Route
- `src/app/api/conversations/[id]/messages/route.ts`: `GET ?after=<ISO>`, `runtime = "nodejs"`,
  `dynamic = "force-dynamic"`, `Cache-Control: no-store`. 401 guest, 403 unverified, 400 missing or invalid
  `after`, 404 non-participant, otherwise `{ messages, status }`. Each call marks the viewer as having read the conversation.

### Pages
- `/mesajlar` (replaces stub): `requireVerified`, PageHeader "Mesajlarım", `Tabs` with `?sekme=sohbetler|istekler`
  and the received-request count. Chat rows: Avatar 48, full name, preview, relative time, bold name and pen dot
  when unread, "İstek gönderildi" chip for initiated pending or declined requests. Request rows: avatar and name
  link, the first message (`line-clamp-3`), inline Kabul et / Reddet. Empty states as in the brief.
- `/mesajlar/yeni?kime=<username>` (new): verified recipient or 404, self redirects to `/mesajlar`, an existing
  conversation redirects to it, blocked shows the message only. Otherwise the recipient row, the request-model
  info box when `canMessageDirectly` is false, and the first-message form.
- `/mesajlar/[id]` (replaces stub): `requireVerified`, participant or 404, `markRead` on render, then `Chat`.

### Components (`src/components/messaging/`)
- `chat.tsx` (client): fixed full-height layout between the 60 px top bar and the bottom nav. Header with back link,
  name and avatar linking to the profile, and an overflow `Sheet` with "Profili görüntüle". Banners for each state.
  Bubbles (own in `pen`, other in `surface` with a border, radius 18 with a 6 px tail corner). Day separators, times
  under each group. Auto-growing composer (max about five lines), Send button (`aria-label="Gönder"`), Enter sends
  on pointer-fine devices and Shift+Enter adds a line. Polls `/api/conversations/[id]/messages` every 3 s while
  visible and immediately on becoming visible. Optimistic send with rollback. Scrolls to bottom only when near the bottom or when the viewer sent the message.
- `conversation-list.tsx` (server): `ConversationItem` and `RequestItem`.
- `request-actions.tsx` (client): Kabul et (`router.refresh`) and Reddet.
- `start-form.tsx` (client): `useActionState` form for the first message.

## Files

Created: `src/lib/messaging/{types,types.test,format,service,service.test,actions}.ts`,
`src/components/messaging/{chat,conversation-list,request-actions,start-form}.tsx`,
`src/app/(app)/mesajlar/yeni/page.tsx`, `src/app/api/conversations/[id]/messages/route.ts`,
`tests/messages-route.test.ts`.

Replaced: `src/app/(app)/mesajlar/page.tsx`, `src/app/(app)/mesajlar/[id]/page.tsx`.

Changed outside the brief's named files (minimal, see Decisions 1):
- `vitest.config.ts`: `DATABASE_URL` is now an absolute path to this worktree's `prisma/test.db`.
- `tests/global-setup.ts`: same absolute path for `prisma db push`.

No schema change, no migration, no new dependencies. Nothing under `src/components/social/` or `src/lib/social/`.

## Decisions (brief silent or ambiguous)

1. **Test database isolation (important).** `node_modules` is a junction to the main checkout. The generated
   Prisma client resolves its `prisma/` folder through that junction, so the relative `file:./test.db` in
   `vitest.config.ts` and `global-setup.ts` pointed at the main checkout's `prisma/test.db`. This is the same for
   every worktree. The fix uses an absolute path in both files. After the fix, `prisma/test.db` in this worktree
   is the one written, and the suite passed twice in a row. Before the fix, runs gave varying foreign-key and
   unique failures in unrelated files (`counters.test.ts`, `consent.test.ts`), consistent with concurrent writes
   to a shared file. See Concerns.
2. **Recipient banner for a declined request.** The brief does not cover it. The recipient sees "Bu isteği reddettin." and a disabled composer.
3. **Accept respects blocks; decline does not.** Accepting a blocked person's request is refused. Declining is always allowed.
4. **Unknown and unverified recipients get the same message.** "Kullanıcı bulunamadı." does not reveal verification status.
5. **Unread follows the counter semantics.** Only ACTIVE conversations can be unread (same rule as `getCounters`).
6. **Requests tab preview.** Shows the full latest body, which for a pending request is the first message.
7. **Route status codes.** Unverified 403 and invalid or missing `after` 400 are added beyond the brief's 401 and 404.
8. **Chat layout.** A fixed overlay between the top bar and the bottom nav, so the composer sits just above the nav and the page does not scroll.
9. **Bubble radius 18 px.** The brief gives it explicitly. It is not a design-system token, so it is a deliberate exception.
10. **Day separators are left-aligned chips.** The design rule says to center only empty states.
11. **Overflow sheet.** Task 8's report and block components are absent, so the sheet only links to the profile, as the brief allows.
12. **Hydration.** Times and day labels render only after mount (`useSyncExternalStore`), so server and client output match. Server rendering shows no timestamps.
13. **Concurrent start.** A P2002 on conversation create falls back to delivering into the existing conversation.
14. **Transactions.** Creating a conversation, its first message and the sender's read row run in one `$transaction`, as do message writes.
15. **Read marking.** The page marks the conversation read on render and the route marks it read on each poll.
16. **Blocked conversation.** Messages stay visible with a "Bu kişiyle mesajlaşamazsın." banner and a disabled composer.
17. **Polling cursor.** Uses `createdAt > after` as the brief says. Two messages with the same millisecond timestamp could be missed.
18. **No pagination on lists.** `listConversations` returns every visible conversation, with a fixed number of queries.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npx vitest run`: 22 files, 194 tests, all passed. Run twice in a row after the isolation fix.
  - `service.test.ts` (19): mutual follow and shared project give ACTIVE, stranger gives REQUEST with a notification,
    initiator's second message refused, recipient cannot send before accept, accept gives ACTIVE with notifications
    and both can send, decline hidden from initiator, promotion on send, blocks both ways, non-participant
    refused, list kinds and unread flag, poll marks read (counter to 0), cursor filtering, last 50 messages.
  - `tests/messages-route.test.ts` (4): 401 guest, 404 non-participant, 400 bad `after`, 200 with `mine` and
    `no-store`.
  - `types.test.ts` and `format` helpers: body normalisation, truncation, previews, day labels, group ends.
- `next dev` and `next build` were not run, per the brief. The chat UI, polling and layout were checked by reading the code only.

## Concerns

- **Not browser-verified.** The orchestrator's browser check should cover 375 px width, the fixed chat overlay above the
  bottom nav, the Enter key and the 3 s poll with two accounts (stranger request, accept, live messages, counter badge).
- **Main checkout may have been written to.** Before the isolation fix, this worktree's test runs (`resetDb()` and
  inserts) used `prisma/test.db` in the main checkout. I did not read or write the main checkout directly. The
  orchestrator should check that database and the other worktrees' test runs, since they have the same root cause.
  The fix is only in this branch. Other tasks need the same two-line change or they will keep sharing a database.
- **Attribution conflict.** The computed task asks for `Co-Authored-By: Claude Opus 5.5`. The session attribution
  reminder asks for `Claude Haiku 5.5`. This commit and the report commit use the Haiku line. Please confirm.
- **Design-system exceptions.** The 18 px bubble radius (Decision 9) and the left-aligned day chips (Decision 10).
- **Hydration of `Chat`.** The chat is a client component that also renders on the server. Timestamps are blank until
  mount, which is intended.
- **Task 8 coupling.** When task 8 lands, the overflow sheet should gain "Engelle" and "Şikayet et", and the
  block button should hide the composer as well.

## Fix round 1

- BASE: `604749ec4e85d3bd16fcb1c6bd39d12a8000bdb8` (`git rev-parse HEAD` before any change, branch `task-9`)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made, given in the final reply)

### Findings addressed

1. **Important, optimistic send has no rollback on a thrown action** (`src/components/messaging/chat.tsx`, `send()`).
   Fixed. The `sendMessageAction` await is now wrapped in try/catch. A throw is converted to a failed result with
   "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.". The existing failure path then removes the pending
   bubble, restores the draft when the composer is empty, and shows the error. The `ActionResult` type import was added.
2. **Same gap in the accept and decline transitions** (`src/components/messaging/request-actions.tsx`).
   Fixed. `acceptRequestAction` and `declineRequestAction` are each wrapped in try/catch inside the transition. A throw
   shows "İstek kabul edilemedi. …" or "İstek reddedilemedi. …" in the existing `role="alert"` line. The success path
   (`router.refresh()`, and the server-side redirect on decline) is unchanged. No `redirect()` call sits inside a try block.

### Findings disputed

None. Both findings were valid and were fixed as described.

### Spec gaps

None were reported for this round.

### Files changed

- `src/components/messaging/chat.tsx`
- `src/components/messaging/request-actions.tsx`
- `docs/superpowers/sdd/task-09-report.md` (this section)

No schema change, no new dependencies, nothing under `src/components/social/` or `src/lib/social/`, and no change to the main checkout.

### Test results (run in this worktree)

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 22 files, 194 tests, all passed (the amended components have no unit tests of their own, so the full suite was run).

### Attribution

Commits in this round use the `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` trailer from the session attribution
reminder. The computed task asks for `Claude Opus 5.5` on every commit. These conflict, and the conflict was already raised in
the original report's Concerns. Please confirm which trailer is wanted.

## Fix round 2

- BASE: `4ae8bdfadfed08ae05e6f0204e92ba099ee6174c` (`git rev-parse HEAD` before any change, branch `task-9`)
- Code commit: `b9e748a48628272f6ebd0016a74048e5c86aa1b1` (fix: treat a resolved undefined decline result as success)
- HEAD: the commit that adds this section (`git rev-parse HEAD` after it is made, given in the final reply)

### Findings addressed

1. **Important, decline success path may read `.ok` on undefined** (`src/components/messaging/request-actions.tsx`, `decline()`).
   Fixed. `declineRequestAction` redirects on success, so the client may resolve with no result. The result variable is
   now typed `ActionResult | undefined`, and the check is `if (result && !result.ok) setError(result.error);`. The
   `try/catch` wraps only the await, so no `redirect()` runs inside a try block. The accept path is unchanged, because
   `acceptRequestAction` always returns an `ActionResult`.

### Findings disputed

None.

### Spec gaps

None were reported for this round.

### Browser verification

Not run. The orchestrator's browser check after merge should confirm that declining navigates to
`/mesajlar?sekme=istekler` without an error boundary.

### Test results (run in this worktree)

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx vitest run`: 22 files, 194 tests, all passed.

### Attribution

The code commit and this report commit use `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, from the
session attribution reminder. The computed task asks for `Claude Opus 5.5` on every commit. This conflict was already
raised in the Fix round 1 section and in the original report's Concerns. Please confirm which trailer is wanted.
