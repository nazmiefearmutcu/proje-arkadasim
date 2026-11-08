# Final fix wave — packet "projects"

Branch `task-23` (worktree `proje-arkadasim-wt/t23`), created from main.

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- Code commits:
  - `bf253fc55432329342cded9b731d81b3cfa589e9` fix(projects): join/invite decision integrity (F12b, F14, F37)
  - `5db02aed14a11fd8af030ce71e5e18888b304af0` fix(projects): team visibility, invite state and apply sheet on detail (R2, F12b, F42, F43, M53b)
  - `6f35195204a19123df37daf69e15092ab9b28df5` fix(projects): owner panel and project form usability (F36, F41, F43, F44b, M53b, M21, F49)
- HEAD: the commit that adds this report (it sits directly on `6f35195`). Its hash is in the structured output.

All 12 items are fixed. No file outside the packet was edited. Two new files were added: `src/lib/projects/tx-errors.ts` and `src/lib/projects/tx-errors.test.ts`.

## Items

### R2 — Team visibility for guests and unverified viewers (Important)
- Confirmed: `UserRow` rendered `person.department` for every viewer, and team rows had no profile links for verified viewers.
- Fix:
  - `src/app/(app)/projeler/[id]/page.tsx`: in the Ekip section, when `!canSeeProfiles`, the row gets `{ ...member.person, department: null }`. Names stay masked by `displayName` ("Ad S."). When `canSeeProfiles` (verified viewers and admins), each `UserRow` is wrapped in `<Link href="/u/<username>" className={cn("block rounded-control", focusRing)}>`. These rows have no action, so nothing interactive is nested. `user-row.tsx` is not edited.
  - `src/lib/projects/queries.ts`: as defence in depth, `getProjectDetail` sets `department` to null on the owner and on every member when the viewer is neither verified nor an admin. University stays visible to everyone.
- Test (`queries.test.ts`): a guest and an unverified viewer get `department: null` for the owner and all members, with universities kept. A verified viewer and an admin (unverified, role ADMIN) get the departments.

### F12b — Accept across a block (Important)
- Confirmed: `decideApplicationAction` ACCEPT never called `isBlockedEitherWay`, and the owner panel listed blocked applicants' PENDING requests.
- Fix (`actions.ts`): ACCEPT returns `fail("Bu başvuru kabul edilemez.")` when `isBlockedEitherWay(owner, applicant)` is true. Nothing is written and no notification is sent. As defence in depth, `respondToInviteAction` ACCEPT also refuses across a block with the neutral `"Bu davet artık geçerli değil."`, which does not reveal the block.
- Fix (`queries.ts`): `ownerView` loads the owner's block pairs once and leaves out PENDING requests where `userId notIn blockedIds`.
- Tests: in `actions.test.ts`, a pending request from a user who later blocks the owner cannot be accepted: no member row, the request stays PENDING, and no JOIN_ACCEPTED is sent. Also, an invite cannot be accepted after a block. In `queries.test.ts`, the owner's request list leaves out both block directions.

### F14 — Parallel application and invite (Important)
- Confirmed: an application and an invite could both be PENDING at once. Accepting one left the other open, and `removeMemberAction` cancelled nothing.
- Fix (`actions.ts`):
  - The `decideApplicationAction` ACCEPT transaction runs `tx.projectInvite.updateMany({ projectId, inviteeId, PENDING } → CANCELLED, decidedAt)` after `addMemberInTx`.
  - The `respondToInviteAction` ACCEPT transaction runs `tx.joinRequest.updateMany({ projectId, userId: viewer, PENDING } → WITHDRAWN, decidedAt)`.
  - `removeMemberAction` uses a new helper, `endMembershipInTx`, which deletes the membership with `deleteMany` (an already-removed member gives a clean "Bu kişi ekipte değil."), then cancels PENDING invites and withdraws PENDING requests for that user and project, all in the same transaction. `leaveProjectAction` uses the same helper. It is harmless there and keeps every way a membership ends consistent.
  - `inviteToProjectAction` refuses when the invitee has a PENDING join request. It returns the field error `username: "Bu kişinin bekleyen bir başvurusu var. Önce başvuruyu yanıtla."`, shown the same way as the existing "zaten bekleyen bir davet var" error in both the owner panel and the profile invite sheet.
  - `applyToProjectAction` refuses when the viewer has a PENDING invite: `"Bu projeden bekleyen bir davetin var. Network > Davetler'den yanıtla."`.
  - `searchInvitableUsersAction` also leaves out pending applicants. The owner-panel "Kişi bulunamadı" text now says so.
- UX follow-up (packet files only): `getProjectDetail` returns `viewer.pendingInviteId`. The detail page has a new `"invited"` viewer state. Instead of the apply button, `ProjectActions` shows "Bu projeden bekleyen bir davetin var" with a "Daveti yanıtla" link to `/network?sekme=davetler`. Without this, an invited user would write a motivation and only then be refused. Precedence: member > pending > closed > guest > unverified > invited > open.
- Tests (`actions.test.ts`):
  - Accepting an application cancels the pending invite (and declining it afterwards fails, with no INVITE_DECLINED).
  - Accepting an invite withdraws the pending application.
  - Removing a member cancels the stale invite and withdraws the stale request, and the stale invite then cannot bring the member back.
  - Leaving cancels the stale invite.
  - Inviting a pending applicant is refused.
  - Applying with a pending invite is refused.
  - Search leaves out pending applicants.
  - In `queries.test.ts`: `pendingInviteId` is returned only to the invitee.

### F37 — Check-then-write races (Minor)
- Confirmed: withdraw, reject, accept, cancel and respond checked PENDING and then wrote unconditionally.
- Fix (`actions.ts`): every status change is `updateMany({ where: { id, status: "PENDING" }, data })`:
  - withdraw, reject, cancel and decline: one conditional statement; `count === 0` → `fail("Bu başvuru zaten sonuçlandı.")` / `fail("Bu davet zaten sonuçlandı.")`.
  - application accept and invite accept: the conditional update runs inside the transaction, before `addMemberInTx`. `count === 0` throws a `TxRefusal`, which rolls back and becomes the matching "zaten sonuçlandı" fail. (`SeatError` was renamed `TxRefusal` because it now covers more than seats.) The accept transactions map Prisma `P2034` / `P2028` and SQLite busy/locked errors to `fail("Şu an işlenemedi. Birazdan tekrar dene.")` through the pure helper `isTransientTxError` in the new file `src/lib/projects/tx-errors.ts`. It lives in its own file because `actions.ts` is `"use server"`. Other errors are rethrown.
  - The fast pre-checks stay for their clearer messages. The conditional write is the guarantee.
- Tests:
  - Withdraw followed by accept fails, with no member row and the status still WITHDRAWN.
  - A simulated race: the accept's pre-check reads PENDING, the applicant withdraws, then the accept transaction runs. The accept fails "zaten sonuçlandı", WITHDRAWN is kept, there is no member and no JOIN_ACCEPTED. A mutation check (removing the conditional throw) makes this test fail.
  - The same race for an invite cancelled by the owner while the invitee accepts.
  - An accepted application can no longer be rejected or withdrawn, and an accepted invite can no longer be cancelled.
  - A P2034 from `$transaction` and a "database is locked" error map to the busy message.
  - `tx-errors.test.ts` unit-tests the classifier.
  - PostgreSQL seat overbooking stays parked as F70, as the review says.

### F36 — `#basvurular` anchor (Minor)
- Confirmed: no element had `id="basvurular"`.
- Fix (`owner-panel.tsx`): the Başvurular `Section` is wrapped in `<div id="basvurular" className="scroll-mt-20">`. The top bar is 60 px (design-system.md), and 80 px of margin clears it. This matches the existing `scroll-mt-20` anchors in `/ayarlar`.

### M21 — Tag remove touch target (Minor)
- Confirmed: a `size-8` button inside a `min-h-8` chip.
- Fix (`project-form.tsx`): the remove button is `size-11` and the chip is `min-h-11`. The chip's vertical padding is dropped, so the chip is exactly 44 px tall. The shared `Chip` (M4) and chip input (M27b) are outside this item.

### M53b — Uncontrolled fields reset after a failed action (Important)
- Confirmed: the owner-panel InviteSheet role `Select` and message `Textarea`, and the ApplySheet role `Select`, were uncontrolled inside `<form action>`.
- Fix: the fields are held in `useState` with `value`/`onChange`, like ProfileForm. In the owner panel, role and message live in the panel content, so they also survive "Değiştir" (changing the selected person). On success the form is replaced by the success message. Reopening mounts a fresh panel (see F43), so the values are cleared only after success or close.

### F43 — Sheets removed while modal (Minor)
- Confirmed: `{open ? <XSheet/> : null}` with `Sheet open` hard-wired to true removed the dialog without calling `dialog.close()`.
- Fix: `ProjectActions` and `OwnerPanel` now always render `<Sheet open={state}>`. Only the inner content mounts while open (`ApplyForm`, `InvitePanel`), the same pattern as `social/invite-sheet`. Escape (`onCancel`), the backdrop and the close button call `onClose`. Then `Sheet`'s effect runs `dialog.close()`, and the browser restores focus to the element that had it before `showModal()` (the trigger button). Because the content unmounts on close, the InvitePanel search debounce timer is now cleared on unmount (this also covers the deferred M24).
- Verification: by code reading only. Browser checks were not possible because this wave forbids running the dev server, and the test environment is Node (no DOM). One known limit: after a successful application, the page revalidates into the "pending" state (`ProjectActions` is keyed by `viewerState`). The trigger button no longer exists, so focus cannot return to it. This is unchanged and outside the finding.

### F49 — Validation errors far from the submit bar (Minor)
- Confirmed: a failed client-side validation only rendered errors and the top alert.
- Fix (`project-form.tsx`): a failed submit increments a counter. An effect then calls `focusFirstError`, which focuses the first `[aria-invalid="true"]:not(:disabled)` control in DOM order (Field sets `aria-invalid`) with `preventScroll`, and calls `scrollIntoView({ block: "center" })` so the field is not under the sticky top or bottom bars. Without such a control, it falls back to the form alert, now `tabIndex={-1}`. Server failures (`useActionState` result not ok, for example "Üyesi olan bir rol silinemez.") use the same path.

### F44b — Invite search live region (Minor)
- Confirmed: "Aranıyor…", the results and "Kişi bulunamadı" were outside any live region.
- Fix (`owner-panel.tsx`): the search error, "Aranıyor…", the empty state and the results list are wrapped in `<div aria-live="polite">`.

### F41 — Empty owner-panel Ekip (Minor)
- Confirmed: an empty `<ul>` rendered under the Ekip heading.
- Fix (`owner-panel.tsx`): with no non-owner members, the section shows "Henüz ekip üyesi yok." and a secondary "Kişi davet et" button that opens the invite sheet. On a closed project the button is disabled and the existing hint "Davet göndermek için projeyi yeniden aç." is shown, matching the Davetler section.

### F42 — "Profile git" touch target (Minor)
- Confirmed: a `t-meta` link about 18 px tall with no focus ring.
- Fix (`page.tsx`): `inline-flex min-h-11 items-center rounded-control` plus `focusRing`.

## Not fixed

None.

## Checks

Run in this worktree after the last code commit:

- `npx tsc --noEmit`: passed (exit 0, no output).
- `npm run lint`: passed (exit 0, no warnings).
- `npx vitest run`: 52 files, 499 tests, all passed. The projects files went from 53 tests at BASE to 75: 16 new tests in `actions.test.ts`, 3 in `queries.test.ts` and 3 in the new `tx-errors.test.ts`.

Not run, by rule: `next dev` / `next build`, `prisma generate` / `migrate`. There is no schema change.
