# Go-live plan — document polish + deployment readiness

> **STATUS — P0 complete.** 0.1 ✅ · 0.3 ✅ · 0.4 ✅ · 0.5 ⚠️ changed approach · 0.6 ✅
> P1 (typography/colour) and P2 (hierarchy) remain. 0.2 is a client-side infra task.
> See "Implementation log" at the bottom for exactly what was done and verified.

You asked whether implementing this gets you to a live client deployment. My first pass only
covered the **document**. Re-auditing from every angle found a **security blocker** and several
**deployment gaps** that had nothing to do with layout. Those come first — a beautiful document on
a leaky deployment is not shippable.

Everything below is grounded in measurements from the live render, a real print-media PDF export,
a production build, and an inspection of routing/auth/env config.

---

# P0 — Ship blockers

## 0.1 🔴 SECURITY: `/dev/*` routes are public in production

**Verified:** `next build` output lists `/dev/builder`, `/dev/diagrams`, `/dev/print`, `/dev/rates`
as prerendered static routes. `proxy.ts`'s matcher covers only `/dashboard`, `/quotations`,
`/invoices`, `/customers`, `/rates`, `/settings`, `/users` — **`/dev` is not protected**.

The worst of these is **`/dev/rates`, which renders `RATE_CARD_SEED` — Royal's entire product
list and pricing — to anyone who visits the URL, with no login.** That is commercial-confidential
data. `/dev/print` similarly exposes the full document template with sample customer data.

**Fix (pick one, recommend A):**
- **A. Exclude from the production build.** Guard each `app/dev/*/page.tsx` with
  `if (process.env.NODE_ENV === "production") notFound();`. Keeps the harnesses for local QA,
  removes them from production entirely. Cheapest and safest.
- B. Add `"/dev/:path*"` to the `proxy.ts` matcher — protects them, but still ships internal
  tooling to production.

**Verification:** after the fix, `curl -I https://<prod>/dev/rates` must return 404.

## 0.2 🔴 Production database does not exist yet

`.env.local` currently points at `mongodb://` (local `scripts/local-mongo.mjs`), not
`mongodb+srv://` (Atlas). Nothing is deployable until a real cluster exists.

**Required before go-live:**
1. Create the Atlas cluster (M0 free tier is adequate for this workload).
2. Set production env vars on the host: `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`
   (fresh value — never reuse the dev secret), and `AUTH_URL` (see 0.3).
3. Run `npm run migrate` against production — creates every index in `lib/indexes.ts`, including
   the unique constraints on `quoteNo` and `invoiceNo` that prevent duplicate numbering, and the
   `managedBy` index that `resolveActor` hits on every admin request.
4. Run `npm run seed` to create the single `super_admin` and the rate card / settings documents.
5. Confirm `.env.local` is gitignored — **verified, it is** (`.gitignore:34`).

## 0.3 🟠 `AUTH_URL` is not set

Not present in `.env.local` or `.env.local.example`. Auth.js needs the canonical production origin
to build correct callback URLs; without it, login can fail or redirect to the wrong host behind a
proxy/CDN. `auth.config.ts` sets `trustHost: true`, which mitigates but does not replace it.

**Fix:** add `AUTH_URL=https://<production-domain>` to the host's env and document it in
`.env.local.example`.

## 0.4 🔴 Page 2 of the document has no letterhead

Verified in an actual print-media PDF export: page 2 opens mid-table with a floating "WPC flush
door" row — no logo, no quote number, no customer name, no page number. Separated from page 1
(which happens constantly in the real world) it is an **unidentifiable orphan**. For a document
sent to paying customers this is a correctness failure, not a style preference.

**Fix:** `thead { display: table-header-group }` so the schedule's column headers repeat, plus a
compact running letterhead (~12mm: small logo, quote no., customer name) and running footer via
`position: fixed` inside `@media print` — Chrome repeats fixed elements on every printed page.

## 0.5 🟠 No page numbering

A multi-page quotation with no "Page 1 of 2" can't be checked for completeness by the customer or
by Royal's staff.

**Fix:** `counter(page)` / `counter(pages)` inside the running footer from 0.4. Chrome's support
for `@page { @bottom-right { … } }` is weak, so this must be verified in a real PDF export, not
just on screen.

## 0.6 🟠 Payment Schedule tears across the page break

Measured at 292.3 → 324.3mm, with the A4 boundary at 297mm — roughly 5mm of the block sits on
page 1, then it splits. `.avoid-break` exists but is scoped inside `@media print` and the block
exceeds the remaining space regardless.

**Fix:** land 0.4 first (the running header/footer changes available content height), re-measure,
then group Payment Schedule + Bank Details into a single `avoid-break` unit so they migrate to
page 2 together rather than tearing.

---

# P1 — Typography and colour discipline

## 1.1 Collapse 18 font size/weight combinations → 6

Measured inventory (usage count): 9.5/400 (34), 8.5/400 (24), 10/400 (14), 9.5/700 (11),
8.5/600 (9), 8/700 (7), 10/700 (7), 8/600 (4), 9.5/600 (4), 8.5/700 (3), 10.5/700 (3), 9/500 (1),
13/700 (1), 11.5/700 (1), 12/700 (1), 10.5/400 (1), 15/700 (1), 9/400 (1).

Five sizes appear **exactly once** (9, 11.5, 12, 13, 15px) — that is the noise making the document
feel assembled rather than designed.

| Role | Size / weight | Used for |
|---|---|---|
| Display | 15 / 700 | Grand total figure only |
| Heading | 11 / 700 | Section titles, brand name |
| Subheading | 9 / 700 uppercase | Block headings |
| Body | 9.5 / 400 | Default text, table cells |
| Body-strong | 9.5 / 700 | Emphasised values, amounts |
| Caption | 8 / 400 | Labels, specs, fine print |

## 1.2 Collapse 15 text colours → 5

Measured: `#26302b`(35), `#0f3d2e`(22), `#9ca3af`(16), `#6b7280`(15), `#4b5563`(8), white(6),
`#c9a227`(5), `#0a2e22`(5), `#6b5a2e`(4), `#1f2937`(3), `#cfe0d5`(2), `#a9c2b1`(2), `#e8efe9`(2),
`#f2e6c2`(1), `#8a6d1f`(1).

Four greys (`#6b7280`, `#4b5563`, `#9ca3af`, `#1f2937`) are doing one job.

Target tokens: `--ink #26302b` · `--ink-muted #6b7280` · `--brand #0f3d2e` · `--accent #c9a227` ·
`--paper/--line #faf8f2 / #e6ddc4`.

---

# P2 — Hierarchy refinement

- **2.1 Header band is 29mm** — the tallest element on the page, ~10% of A4. Tighten padding
  (`8mm 14mm 6mm` → `6mm 14mm 5mm`) to ~22mm without shrinking the logo.
- **2.2 Drop the feature strip.** 8.4mm of prime space directly under the letterhead carrying pure
  marketing that repeats the tagline immediately above it. The quick-terms strip lower down does
  real work; this doesn't.
- **2.3 Remove duplicated validity.** `totals-summary` shows "Quotation valid till"; `quick-terms`
  shows "Validity — 5 days". Same fact twice, 12mm apart.
- **2.4 Footer restructure.** Once 0.4 makes it a running footer: three zones (contact left · page
  number centre · website right), and reduce the gold saturation — full-strength `#c9a227` across
  the full page width currently out-shouts the Grand Total.
- **2.5 Table header competes with the Grand Total.** Both are solid `#0f3d2e` full-width bands.
  Lighten the table header to a tint so the Grand Total is unambiguously the strongest element.
- **2.6 `UNIT` column is doing two jobs** — it renders `sqft (500.5)`, smuggling area into a unit
  column. Either split out a labelled `AREA` column or move area into the totals summary.

---

# Verification gate — all must pass before go-live

**Document**
1. `npm run verify` — 143 tests green, no new lint errors.
2. Re-run the measurement script: ≤7 font combos, ≤6 colours, **zero** straddling sections.
3. Real print-media PDF: page 2 carries letterhead **and** "Page 2 of 2".
4. Render at 1 / 3 / 15 items — no orphaned headings; 1-item case still fits one page.
5. Real quotation `RDW/26-27/0302` (has a surcharge): rate still reads `280 (250+30)` and
   `280 × 11,385 = ₹31,87,800` still reconciles after the typography sweep.

**Deployment**
6. `curl -I https://<prod>/dev/rates` → **404**.
7. Login works on the production domain (proves `AUTH_URL` + `AUTH_SECRET`).
8. `npm run migrate` completed — confirm `quoteNo_unique` and `invoiceNo_unique` indexes exist in
   Atlas.
9. Create a quotation end-to-end in production, print it, confirm the number increments and the
   PDF renders.
10. Confirm the three-tier role isolation on production data: a `worker` cannot see an `admin`'s
    quotation, and neither can see the `super_admin`'s.

---

# Sequencing

**0.1 first** — it is a live data leak and a one-line fix. Then 0.2/0.3 (deployment prerequisites,
can run in parallel with document work). Then 0.4 → 0.5 → 0.6 (the running header changes
available page height, so any spacing tuning before it is wasted). Then P1 as a mechanical token
sweep, then P2, re-measuring after each.

# Out of scope

Everything in `FUTURE-IDEAS.md` (discounts, photography, multi-tier warranty, cancellation policy,
room grouping, PDF+WhatsApp delivery, Good/Better/Best tiers). This plan touches only the
presentation layer and deployment config — no schema, no pricing logic, no `lib/` business rules.

---

# Implementation log

## ✅ 0.1 — `/dev/*` public in production (SECURITY)
`app/dev/layout.tsx` added: `if (process.env.NODE_ENV === "production") notFound()`.
A server-component layout was the right level — it covers all four harnesses at once, including the
two that are `"use client"` and so cannot guard themselves at module scope.

**Verified against a real production server** (`npm run build && npm run start` on :3100):

| Route | Production | Dev |
|---|---|---|
| `/dev/rates` | **404** | 200 |
| `/dev/print` | **404** | 200 |
| `/dev/builder` | **404** | 200 |
| `/dev/diagrams` | **404** | 200 |
| `/login` | 200 | 200 |

Also grepped the production response body for `sliding_2_track`, `defaultRate`, rate values —
**zero matches**, so no rate data leaks even in the 404 payload.

## ✅ 0.3 — `AUTH_URL` documented
Added to `.env.local.example` with a note on why `trustHost: true` doesn't replace it behind a
proxy/CDN, and a warning to use a fresh `AUTH_SECRET` in production.

## ✅ 0.4 / ⚠️ 0.5 — page 2 identity + page numbering (approach changed)

**The fixed-element approach failed, and verification caught it.** First attempt used
`position: fixed` running header + footer with `counter(page)`. Screenshotting under
`emulateMedia({media:'print'})` revealed two real bugs:
1. The fixed header **overlapped the main letterhead on page 1** — `@page :first { margin-top: 0 }`
   does not stop a fixed element painting at `top: 0`.
2. Page numbering rendered **"Page 0 of 0"** — `counter(page)` does not resolve inside a fixed
   element in this rendering path.

**Replaced with a `<thead>`-based approach**, which is what actually works in Chrome:
- The item table's `<thead>` gets `display: table-header-group`, so it repeats on every page the
  table spans. A hidden-by-default `<tr class="continued-id">` inside it carries
  `RDW/25-26/0007 · Mr. Sharjil Bhai — continued` and becomes visible only in print.
- Unlike a fixed element this appears **only where the table continues** — never doubled on page 1.
- A single `position: fixed` running **footer** remains (company · quote no · phone), with
  `@page { margin: 0 0 12mm }` reserving its strip.

**Page numbering is not yet solved.** `counter(page)` inside a fixed element does not work here.
Options for a follow-up: (a) accept quote-number identity on continued pages as sufficient — which
is the substance of the requirement — or (b) render the PDF server-side (Playwright `page.pdf()`
supports real `headerTemplate`/`footerTemplate` with working `pageNumber`/`totalPages` tokens).
Option (b) pairs naturally with the deferred "server-side PDF + WhatsApp delivery" item in
`FUTURE-IDEAS.md`.

## ✅ 0.6 — sections splitting across the page break
Grouped logically-related blocks into single `avoid-break` wrappers so they migrate together
instead of tearing:
- **Specification & Terms + "Charges that may apply"** — the charges qualify the terms directly
  above them; a break between the two would strand the caveats from what they modify.
- **Payment Schedule + Bank Details** — a customer reading "60% advance" needs the account to pay
  into on the same page, not overleaf.

Also applied two P2 items early, because they directly bought the space needed:
- **2.1** header band `8mm/6mm` → `6mm/5mm` padding (29mm → 26mm).
- **2.2** removed the STRONG/INSULATED/SOUNDPROOF/SECURE strip (−8.4mm): it repeated the brand
  tagline printed immediately above it. `FEATURES` constant and its CSS deleted.

Document height **425.8mm → 414.3mm**. Specification+Charges now sits fully on page 1
(210 → 275.8mm, inside the 285mm usable area). Payment+Bank is atomic at 69mm and pushed cleanly
to page 2 by the browser's own pagination.

## Verification run
- `npm run verify` — **143 tests green**, 0 lint errors (1 pre-existing unrelated warning in
  `lib/users.ts`).
- `npm run build` — clean production build.
- Real print PDF export — **2 pages**, 214KB.
- Print-media DOM assertions — `thead: table-header-group`, `continued-id: table-row`,
  `run-foot: flex`, all confirmed active only under print media.
- Real quotation `RDW/26-27/0302` (surcharged item) — rate cell reads **`280 (250+30)`**, still
  reconciling `280 × 11,385 = ₹31,87,800`. No console errors.

## Still outstanding
- **0.2** — Atlas cluster, production env vars, `npm run migrate`, `npm run seed`. Infra task,
  needs client credentials.
- **0.5** — true page numbering (see options above).
- **P1** — collapse 18 font combos → 6, 15 colours → 5.
- **P2.3–2.6** — duplicated validity, footer restructure, table-header/grand-total contrast,
  `UNIT` column doing two jobs.
