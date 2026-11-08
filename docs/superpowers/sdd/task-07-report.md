# Task 7 report: Projects, share, explore, detail, join requests, invites, team management

- BASE: `a15fa00d370b97171f815a45bb7ac3f95f62b3b7` (`git rev-parse HEAD` before any change, branch `task-7`)
- Code commit: `fadc33fa77ba81c540bbbdc0b64af3f5f47fcd7b` (feat: projects share, explore, detail, join requests, invites, team management)
- HEAD: the commit that adds this report (`git rev-parse HEAD` after it is made)

## What was built

### Library (`src/lib/projects/`)
- `schemas.ts`: `projectInputSchema` (title 8–80, summary 20–160, description 80–4000, taxonomy
  category/stage/workMode, city required for YUZ_YUZE and HIBRIT and must be in `CITIES`, forced to
  null for UZAKTAN, tags 0–8 of 2–30 chars, roles 1–6 with title 3–60, disciplineGroup, slots 1–5,
  description 0–200), `roleInputSchema`, `applySchema` (message 20–1000), `inviteSchema`
  (username, optional roleId, message 0–500), `projectStatusSchema`. Turkish messages.
  Zod 4 `{ error }` params; no server imports.
- `filters.ts` (pure, shared by server and client): `parseProjectFilters` (kategori, disiplin,
  calisma, sehir, asama, q, sayfa, filtre=benim; unknown values dropped), `activeFilterCount`,
  `projectsHref`.
- `queries.ts`: `listProjects` (only OPEN unless `ownerOrMemberId`; one `contains` per search
  token; disciplineGroup via roles; newest first; `hasMore` by fetching pageSize + 1),
  `getProjectDetail(id, viewer)` (owner, roles with filled/open/full, members with role title and
  isOwner, counts, viewer state, owner-only requests and invites), `getViewerOpenProjectsForInvite`.
- `actions.ts` (`'use server'`, only async exports): `createProjectAction`, `updateProjectAction`,
  `setProjectStatusAction`, `deleteProjectAction`, `applyToProjectAction`,
  `withdrawApplicationAction`, `decideApplicationAction`, `inviteToProjectAction`,
  `cancelInviteAction`, `respondToInviteAction`, `leaveProjectAction`, `removeMemberAction`,
  `searchInvitableUsersAction`. Each checks verification and ownership, validates with zod, and
  calls `revalidatePath`. Seat checks for accepting a request or invite run inside the same
  transaction as the membership insert (`addMemberInTx`), so two acceptances cannot exceed a
  role's slots.

### Pages
- `/paylas` (`requireVerified`): `ProjectForm` in create mode.
- `/projeler`: discipline chips (URL `disiplin`), "Açık projeler" and "Projelerim" chips
  (`filtre=benim` uses `requireUser`), `ProjectFilters` sheet (q, kategori, calisma, sehir, asama),
  "Filtreleri temizle", `ProjectCard` list, "Daha fazla göster", three empty states.
- `/projeler/[id]`: spine band, title, chips, owner row (name by `displayName`, stamp, university,
  profile link for verified or admin viewers), description with line breaks, roles with "x/y dolu"
  and "Dolu" chip, team, tags, `?yeni=1` banner, sticky action bar (`ProjectActions`), owner panel
  (`OwnerPanel`) for the owner. Unknown id gives `notFound()`.
- `/projeler/[id]/duzenle` (`requireVerified`, owner only, otherwise `notFound()`): `ProjectForm`
  with `updateProjectAction.bind(null, id)`.

### Components (`src/components/projects/`)
- `project-form.tsx`: shared create/edit form. Sections Temel bilgiler, Kategori ve aşama, Çalışma
  şekli (three toggle buttons, city select for YUZ_YUZE/HIBRIT), Etiketler (Enter adds, max 8),
  Aranan roller (horizontal spine preview, role cards with title, discipline select with chip
  preview, stepper 1–5, description, remove, "Rol ekle" up to 6). Client validation uses the same
  zod schema, shown after the first submit. Server field errors are always shown. Payload goes in
  one hidden JSON field `payload`.
- `project-filters.tsx`: "Filtreler" button with active count and a `Sheet` form that pushes the URL.
- `project-actions.tsx`: `ProjectActions` (guest, unverified, open, pending, member, closed) and
  `ApplySheet` (role select of non-full roles, message with counter, min 20).
- `owner-panel.tsx`: `OwnerPanel` (applications with Kabul et / Reddet, invites with Daveti geri al,
  team with Ekipten çıkar, Düzenle, Başvurulara kapat/aç, Projeyi sil with `window.confirm`) and
  `InviteSheet` (300 ms debounced `searchInvitableUsersAction`, select, optional message).
- `use-run-action.ts`: small hook for button-driven actions (pending state and error text).

### Tests (53 new tests in 4 files)
- `schemas.test.ts`: city rules, UZAKTAN city dropped, tag and role limits, slots, apply and invite
  schemas.
- `filters.test.ts`: parsing, invalid values dropped, page, `projectsHref`.
- `queries.test.ts` (DB): q tokens, disciplineGroup, workMode/city, closed hidden in explore but
  visible in `ownerOrMemberId` mode, pagination `hasMore`, owner-only requests, viewer pending
  request, `getViewerOpenProjectsForInvite`.
- `actions.test.ts` (DB; mocks `@/lib/auth/guards`, `next/cache`, `next/navigation`): create with
  owner member, roles, searchText and follower notification; unverified fails; city required;
  cannot delete a role with a member; apply creates a request and JOIN_REQUEST; duplicate pending
  apply fails; blocked and owner cannot apply; accept respects slots (second accept fails with
  "Bu rolün kontenjanı dolu."); reject notifies; withdraw; invite creates INVITE; unverified invitee
  rejected; duplicate invite rejected; respond ACCEPT creates member and INVITE_ACCEPTED; full role
  blocks acceptance; remove member; search excludes blocked and members; delete only by owner.

## Files changed
- New: `src/lib/projects/schemas.ts`, `filters.ts`, `queries.ts`, `actions.ts` and their test files
  (`schemas.test.ts`, `filters.test.ts`, `queries.test.ts`, `actions.test.ts`);
  `src/components/projects/project-form.tsx`, `project-filters.tsx`, `project-actions.tsx`,
  `owner-panel.tsx`, `use-run-action.ts`; this report.
- Replaced stubs: `src/app/(app)/paylas/page.tsx`, `src/app/(app)/projeler/page.tsx`,
  `src/app/(app)/projeler/[id]/page.tsx`, `src/app/(app)/projeler/[id]/duzenle/page.tsx`.
- Outside the brief (minimal, see Decision 1): `vitest.config.ts` (test `DATABASE_URL` made absolute).
- Not touched: `prisma/schema.prisma` (frozen), migrations, `package.json`, any other route.

## Decisions (brief silent or ambiguous)

1. **vitest.config.ts test database path.** The generated Prisma client carries
   `relativePath: "../../../prisma"`. Because `node_modules` is a junction to the main checkout,
   `file:./test.db` resolved to the main checkout's `prisma/test.db`. That file is shared by every
   worktree and was being written by other agents during this run. Result: foreign-key and
   vanishing-row failures across unrelated test files, including the existing
   `permissions.test.ts`. The fix sets the test `DATABASE_URL` to this worktree's absolute
   `prisma/test.db` path. The schema push in `tests/global-setup.ts` already targets this
   worktree's `prisma/`, so the two match. The change is one value and is listed for review.
2. **Owner actions require OPEN.** Sending an invite requires an OPEN project ("Kapalı projeye
   davet gönderemezsin. Önce projeyi aç."). The brief did not say so. Accepting an invite already
   required OPEN, and the profile invite flow (task 8) only lists OPEN projects.
3. **Invite source projects.** `getViewerOpenProjectsForInvite` returns projects the viewer owns
   (OPEN, with role open slots), since only owners invite.
4. **Invite search exclusions.** `searchInvitableUsersAction` also excludes users who already have a
   PENDING invite to the project. The brief did not list this exclusion. It avoids a dead result.
5. **Member applying.** A member who applies gets "Zaten bu projenin ekibindesin." The brief gave
   only the owner and blocked messages ("Bu projeye başvuramazsın.").
6. **Closed projects and decisions.** Decisions on existing requests are allowed when a project is
   CLOSED; only new applications and new invites are blocked.
7. **Username lookup is exact.** `inviteToProjectAction` matches the trimmed username exactly.
   The registration code is not in this worktree, so the stored case convention is unknown.
8. **Confirmation prompts.** Removing a member, leaving a project and deleting a project use
   `window.confirm`. Accept and reject run directly. A Sheet-based confirm was not built.
9. **Profile link.** Shown to verified viewers and admins, matching spec §2 (profile pages need
   verification).
10. **Discipline select.** A native `select` cannot show a colored dot, so each role shows a
    `DisciplineChip` preview under its select. The horizontal spine above the roles list shows
    the selected groups.
11. **Form submit path.** The whole payload is one hidden JSON field (`payload`), as the brief says.
    The form is controlled, so `useActionState` results and client validation share one state.
12. **Notifications.** `NEW_PROJECT_FROM_FOLLOWING` goes to followers of the owner. Application,
    decision, invite and response notifications go through `notify()` with `actorId`, which also
    applies the block check.
13. **Edit keeps role ids.** Roles keep their id in the edit payload. A role id that is not in the
    project fails with "Rol bulunamadı." A role that has members cannot be deleted, and a slot
    count below the member count is rejected per role.
14. **Names.** Names use `displayName(person, viewer)` on the server. Client components receive
    plain strings only.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npx vitest run`: 23 files, 215 tests, all passed (53 new in `src/lib/projects/`).
- `next dev` and `next build` were not run, as the brief requires. The orchestrator must check in a
  browser at 375 px: create, explore, detail, apply, accept, member visible, and the sticky bar.

## Concerns

- **Not browser-verified.** Layout, sticky action bar, sheets, the invite debounce and the
  discipline chips were checked by reading the code only.
- **Attribution conflict.** The computed task asks for `Co-Authored-By: Claude Opus 5.5` on every
  commit. The harness attribution reminder for this session says `Claude Haiku 5.5`. This session
  follows the harness line, as task 3 did. Please confirm the trailer.
- **Shared test database (Decision 1).** Other worktrees that still use the default
  `file:./test.db` will hit the same interference until they get the same path fix. The merge
  agent should check this when it re-runs `npx vitest run` on main.
- **Race in `applyToProjectAction`.** Two applications from one user submitted at the same instant
  can both pass the pending check. This is unlikely and harmless (the owner sees two requests); a
  partial unique index would close it in a later schema task.
- **No paging on owner lists.** The owner sees every pending request and invite. Fine at this scale.
- **Profile route.** `/u/[username]` is task 8. The owner row link points there and will 404 until
  task 8 lands.
