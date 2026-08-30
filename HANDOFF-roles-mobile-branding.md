# Handoff — three-tier roles, user management, mobile responsiveness, branding

**Status:** complete and verified. `npm run verify` (typecheck + lint + 130 tests) and `npm run build` both pass.
**Base commit:** `760d4ee` (Phase 10). All work below is **uncommitted** in the working tree.

This was a client-driven scope addition, not a roadmap phase. It slots in beside the existing
ROADMAP.md phases rather than replacing any of them — see *Roadmap impact* at the bottom.

---

## ⚠️ Read this first if you are working on Phase 11 (Rate admin)

The working tree contains **someone else's uncommitted Phase 11 work** that is **not** part of this
handoff:

- `lib/rateCard.ts`
- `components/rates/RateCardEditor.tsx`
- `app/dev/rates/page.tsx`

I did not write those and have not modified them. **But there is one interaction you must know
about:** `lib/rateCard.ts` calls `canManageSettings(actor)` in six places, and I changed what that
function means (see below). It now returns true for **both** `admin` and `super_admin` instead of
the old single `admin` role. That was the confirmed intent — rate changes are day-to-day
operational work and shouldn't require the owner — but the error strings in that file still say
*"Only an admin can change rates."*, which is now slightly misleading. Worth a copy tweak when you
next touch it.

Also note `app/dev/rates/page.tsx` has a pre-existing lint warning (`RateCardInput` unused) that is
not mine.

---

## 1. Three-tier role hierarchy

Replaces the old two-role `admin` / `sales` model.

| Role | Sees | Can create | Notes |
|---|---|---|---|
| `super_admin` | Everything | admins + workers | One account. Seed script only — never created in-app. |
| `admin` | Own records + their own workers' | workers only | Cannot see other admins', their workers', or super_admin's records. |
| `worker` | Own records only | nobody | Renamed from `sales`. |

### The chokepoint: `lib/authz.ts` (rewritten)

Everything routes through here. Read this file before touching any data-access code.

- **`Actor` now carries `managedUserIds: string[]`.** Populated once per request; only ever
  non-empty for an `admin`.
- **`resolveActor(session)` — new, async, and the function you should call.** It narrows the
  session *and* resolves which workers an admin manages (one indexed query on
  `users.managedBy`). It skips that query entirely for `worker` and `super_admin`, since
  neither role's filter consults the list.
- **`actorFromSession(session)` still exists but is now sync-only and returns an empty
  `managedUserIds`.** It is kept for tests and for callers that only need `role`. **Do not use it
  in a page, server action, or API route** — an `admin` resolved this way would silently see only
  their own records, not their workers'. Every one of the 21 existing call sites was migrated to
  `resolveActor`.
- **`ownershipFilter(actor)`** — `super_admin` → `{}`; `admin` →
  `{ createdBy: { $in: [self, ...managedUserIds] } }`; `worker` → `{ createdBy: self }`.
- **`canAccessOwned(actor, createdBy)`** — same rule in boolean form.
- **`isAdmin()` was split into two functions**, because the old one meant two different things in
  different call sites and those meanings diverged once a middle tier existed:
  - `isSuperAdmin(actor)` — "sees everything"
  - `isAdminTier(actor)` — "is admin or above" (gates Rate Master, Settings, Users)
  If you are adding a check, pick deliberately. They are not interchangeable.
- **`canManageUser(actor, target)` — new.** Governs *account* management (reset password,
  deactivate) via the `managedBy` edge. This is a **different relation** from `canAccessOwned`,
  which governs *record* ownership via `createdBy`. Don't conflate them. It unconditionally
  refuses any `super_admin` target, including from another super_admin.
- **`canManageSettings(actor)`** now wraps `isAdminTier` (was: admin-only). See the Phase 11 note
  above.

### Schema (`models/schemas.ts`)

- `UserRole` → `z.enum(["super_admin", "admin", "worker"])`
- `UserSchema` gains `managedBy?: string` (the hierarchy edge) and `active: boolean`
- New `CreateUserInputSchema`, `ResetPasswordInputSchema`

### Auth wiring

- `auth.ts`, `auth.config.ts`, `types/next-auth.d.ts`: the six hardcoded `"admin" | "sales"` literal
  unions now import `UserRole` from `models/schemas.ts` (single source of truth).
- `auth.ts` now **rejects login for a deactivated user** (`active === false`).
- **Known limitation, by design:** sessions are JWT strategy, so a role or `managedBy` change only
  takes effect at that user's *next login*. The Users screen says so in its copy. Fixing this
  properly means DB sessions — out of scope, don't "fix" it accidentally.

### Route protection — `proxy.ts`

Next.js 16 renamed `middleware.ts` → `proxy.ts`. **This project already had it and it already
guarded every route** — if you go looking for `middleware.ts` you will wrongly conclude route
protection is missing. I only added `/users/:path*` to the matcher. Every new authenticated area
must be added there too.

---

## 2. Bug found and fixed along the way

**`lib/dashboard.ts` — the admin "rep breakdown" aggregate had no `$match` stage at all.** It
grouped over *every quotation in the database* regardless of the `ownership` filter computed a few
lines above and never used. Under the old two-role model this was harmless (admin's filter was
`{}` anyway), but it would have become a real cross-tenant leak the moment `admin` became scoped.

Fixed: added `{ $match: ownership }`, gated the branch on `isAdminTier`, and scoped the follow-up
`users.find({})` name lookup to just the ids in the breakdown instead of the whole users
collection.

**This is not covered by a unit test** — see *Testing gaps* below.

---

## 3. User management (new)

- **`lib/users.ts`** — `listUsersFor`, `createUser`, `resetUserPassword`, `deactivateUser`,
  `reactivateUser`. Uses the existing `Result<T>` convention from `lib/quotations.ts`.
  The role-creation matrix is enforced **server-side**; the UI only hides options.
- **`lib/password.ts`** — extracted the `bcryptjs` usage that was duplicated inline in `auth.ts`
  and `scripts/seed.ts`. Cost factor 10, unchanged. Use `hashPassword` / `verifyPassword` from here.
- **`app/(app)/users/page.tsx`** + **`components/users/UserManagementForm.tsx`** — follows the
  server-component-page + inline `"use server"` action pattern used by Settings and Rate Master
  (not the REST-route pattern used by quotations).
- Added `/users` to `ADMIN_NAV_LINKS`.

**Deactivation never deletes and never touches `createdBy`.** A deactivated worker's quotations
stay visible to whoever manages them and still resolve to a name. Keep it that way.

---

## 4. Password reset policy

Deliberate and client-confirmed. **There is no email infrastructure in this app**, so there is no
self-service reset for anyone:

- **`super_admin`: no reset path at all.** Credentials set once via the seed script. If lost, only
  direct DB access can rotate them. There is a comment in `app/(auth)/login/page.tsx` explaining
  this — **please don't "helpfully" add a forgot-password link.**
- **`admin` / `worker`: admin-assisted reset.** Whoever manages the account sets a new password
  from the Users screen and relays it out of band (WhatsApp/call). The UI says this explicitly.

Real self-service reset would require adding email infra first — a separate scoped decision.

---

## 5. Migration — run this before the app is used

`scripts/migrate.mjs` (extended, still idempotent, safe to re-run):

1. Promotes the **oldest existing `admin`** to `super_admin`. If more than one `admin` exists it
   promotes only the oldest and **logs the rest for manual review** rather than guessing.
2. Migrates `sales` → `worker`, setting `managedBy` to the super_admin.
3. Backfills `active: true`.

Also added a `{ managedBy: 1 }` index on `users` in `lib/indexes.ts` — `resolveActor` hits this on
every admin request, so it is a hot path.

`scripts/seed.ts` now only ever creates a `super_admin`; the `--role` flag is gone.

---

## 6. Mobile responsiveness

The app previously had **zero** responsive classes outside one dev page. Approach: mobile-first —
unprefixed classes target phones, `md:` restores the existing desktop layout. Desktop should look
unchanged.

| File | Change |
|---|---|
| `app/(app)/layout.tsx` | Hamburger + slide-in drawer below `md:`; full horizontal nav at `md:+` |
| `components/nav/MobileNavDrawer.tsx` | **New.** Client component (needs `useState`); layout stays a server component for `auth()` |
| `components/builder/ItemRow.tsx` | Outer `[1fr_auto]` → stacked; inner `grid-cols-4` → `grid-cols-2 md:grid-cols-4`; all `col-span-*` given mobile equivalents; diagram column no longer fixed-width |
| `components/builder/QuotationBuilder.tsx` | Root `[1fr_320px]` → stacked; customer/terms grids collapse; desktop sidebar hidden below `md:` |
| `components/builder/MobileTotalsBar.tsx` | **New.** Sticky bottom bar with live grand total + Save, tap to expand full `TotalsPanel` |
| `app/(app)/quotations/page.tsx`, `customers/page.tsx` | Table at `md:+`, stacked cards below — two render paths off the same data, not a CSS table hack |

**Pattern to follow for any new list page:** `hidden md:block` on the table, `md:hidden` on a card
list. The columns in this app don't collapse cleanly enough for a single-markup responsive table.

The sticky totals bar exists because the client's core promise is that a worker can build and hand
over a quotation from a phone on site — the running total has to stay visible while adding items.
Verified visually at 375px.

**Print documents were deliberately left alone** — they must stay A4-oriented.

---

## 7. Branding

Client supplied `public/Logo.jpg` (765×676, dark green background baked in, no alpha).

Derived with `sharp`: `public/logo-mark.png` (the "R" window mark, cropped square, 256px),
`app/apple-icon.png`, and a multi-size `app/favicon.ico` replacing the placeholder.

Placed in four spots: quotation print letterhead (replacing the placeholder text `"R"`), **invoice
print letterhead** (which previously had no mark at all), app header (now also a link to
dashboard), and login page (full lockup). Also fixed `app/layout.tsx` metadata, which was still
Next's default `"Create Next App"`.

**Asset gap:** the JPEG's dark green background is baked in. It works everywhere it's currently
placed because those surfaces are all brand green. **If you need the mark on a white or light
surface, request a transparent PNG or SVG from the client** — don't try to key out the background.

---

## 8. Testing — what's covered and what isn't

**Covered:** `lib/__tests__/authz.test.ts` rewritten with a full hierarchy fixture set (super_admin,
two admins each managing a different worker). Covers `ownershipFilter`, `canAccessOwned`,
`canManageUser` — including "an admin cannot reach another admin's worker" and "nobody can reset a
super_admin". Plus a new `lib/__tests__/password.test.ts`. 130 tests pass.

**Now also covered — `scripts/test-hierarchy.mjs` (new, 13/13 passing).** Proves the client's
headline rule against a real running server, in both directions: a super admin's quotations are
unreachable by an admin or worker (by URL, by API, and by list/search), an admin's are unreachable
by a worker, customers are scoped identically, `/users` redirects a worker away — and upward,
a super admin sees everyone and an admin sees the workers they manage. Wired into
`npm run test:e2e` when super-admin credentials are supplied (it needs all three tiers):

```bash
npm run test:e2e -- <adminEmail> <adminPass> <workerEmail> <workerPass> <superEmail> <superPass>
```

Note this suite requires `worker.managedBy === admin._id` for the "admin sees their worker" check.
After a fresh migration the migrated workers are managed by the *super admin*, so reassign them
via the Users screen (or directly) before running it.

**Still not covered:**

1. **`lib/users.ts` has no unit tests** — its functions hit the DB, and *no vitest test in this
   project mocks Mongo or uses `mongodb-memory-server`*; that's what the `scripts/test-*.mjs`
   Playwright layer is for. The authorization *rules* it depends on are tested via `canManageUser`,
   and the end-to-end behaviour is now covered by `test-hierarchy.mjs`; the DB plumbing is not.
2. **The `repBreakdown` scoping fix** is exercised indirectly (the dashboard suite asserts the
   admin breakdown renders) but has no test that specifically proves an admin's breakdown excludes
   another admin's reps.
3. **`scripts/test-dashboard.mjs` needs a clean database.** It seeds 6 quotations and asserts
   absolute counts, so pre-existing data makes the conversion-rate checks fail (observed: 4 won vs
   an expected 3). Not a product bug — run it against an empty DB.

**Watch out:** `loadCustomerWithHistory` in `lib/customers.ts` applies scoping **twice** (once via
`canAccessOwned` on the customer doc, once via `ownershipFilter` on that customer's quotations).
Both move together correctly now, but it's the easiest place to introduce an inconsistency.

---

## Roadmap impact

Nothing in ROADMAP.md was completed or superseded by this work. Phases 12–15 stand as written,
with two caveats:

- **Phase 12 (Mobile & PWA)** — the *responsive* half is now largely done. What remains is the PWA
  half: installability, offline draft capture, sync on reconnect.
- **Phase 15 (Deployment & branding)** — the branding half is done except for the transparent-asset
  gap noted above.

`ROADMAP.md`, `README.md` and `DEMO.md` still describe the two-role `admin`/`sales` model and have
**not** been updated. Worth doing before client handover.
