# Roadmap — to industry standard

15 phases, ordered so that each one rests on the last. Correctness and security
come before features; features come before polish; infrastructure and branding
land at the end, once the thing they'd be decorating is actually finished.

## Where the code stands today

A working v1: pricing engine (26 tests, reproduces 5 real historical quotations to
the rupee), auth with roles, 17-type SVG diagram engine, live-calculating builder,
branded A4 print document, quotation/customer lists, duplicate, edit-with-revision.
Verified end-to-end in a production build. ~4,900 lines.

**What the audit found — the honest gaps:**

| Area | Finding |
|---|---|
| **Authorization** | `updateQuotation` / `duplicateQuotation` / `setQuotationStatus` never check ownership. A sales user can mutate another rep's quotation by guessing the URL — the *page* guards it, the *mutation* doesn't. |
| **Authorization** | Customer list and customer detail have **no** ownership filter at all. Any sales user sees every customer and every quotation value in the business. |
| **Error handling** | Two `try/catch` blocks in the entire app. A dropped Mongo connection shows a raw Next.js crash page. |
| **Route boundaries** | Zero `loading.tsx`, `error.tsx`, `not-found.tsx`. No loading states anywhere. |
| **Database** | Zero indexes. Every list and search is a full collection scan — fine at 20 quotations, not at 5,000. |
| **Tests** | 26 tests, all on `lib/pricing` + `lib/dimensions` + `lib/words`. Nothing covers the API routes, auth rules, the builder, or the diagram engine. |
| **Data integrity** | No unique index on `quoteNo`; the counter is atomic but nothing enforces it at the DB level. |
| **UX** | No confirm on destructive actions. No toasts — errors surface as inline text or not at all. Not usable on a phone. |
| **Dashboard** | An empty placeholder. |
| **Status** | Workflow exists in the data model but nothing can move a quotation out of `draft`. *(in progress)* |

---

## Phase 1 — Authorization, properly

Close the two real security holes before building anything on top of them.

- A single `assertCanAccessQuotation(id, session)` helper; every mutation
  (`update` / `duplicate` / `setStatus`) and every read goes through it.
- Ownership filter on customers list + customer detail.
- Sales sees own; admin sees all — enforced in `lib/`, not in pages, so a new
  page can't forget it.
- Tests for each rule, including the "sales user guesses another rep's URL" case.

## Phase 2 — Error handling & route boundaries

- `error.tsx`, `loading.tsx`, `not-found.tsx` at the app and route-group level.
- A `Result<T>` convention for server actions instead of thrown strings.
- Friendly DB-unavailable state rather than a stack trace.
- Toast system for success/failure feedback.

## Phase 3 — Database hardening

- Indexes: `quotations.quoteNo` (unique), `createdBy`, `customerId`, `status`,
  `createdAt`; `customers.name`; `users.email` (unique); `rateCard.productType` (unique).
- An idempotent `scripts/migrate.mjs` that creates them, safe to re-run.
- Text index for search instead of unanchored regex scans.
- Pagination on the quotations list (currently capped at a hard 200).

## Phase 4 — Quotation status workflow

*(started)* Move quotations through draft → sent → approved / lost, with a
recorded audit trail (who, what, when). Unlocks pipeline value, conversion rate,
and "approved value" on the customer page — all currently meaningless.

## Phase 5 — Dashboard

Replace the placeholder: this-month quotations and value, pipeline (sent, awaiting
decision), conversion rate, recent activity, top products by value, quotations
going stale (sent >N days, no decision). Sales sees own; admin sees everyone plus
a per-rep breakdown.

## Phase 6 — Test coverage that means something

- API route tests (auth, validation, the ownership rules from Phase 1).
- Server action tests.
- Diagram engine snapshot tests so a refactor can't silently break drawings.
- A Playwright suite from the existing ad-hoc scripts, runnable as one command.
- CI-ready `npm run verify` = typecheck + lint + test.

## Phase 7 — Payment tracking

The `HKBK - Suhail` reference sheet had an advance/balance ledger appended below
the quotation — that workflow exists already, just in Excel. Record payments
against an approved quotation, show balance due, flag overdue.

## Phase 8 — Tax Invoice

Convert an approved quotation into a GST tax invoice: own number series, HSN/SAC
(`3917` in the reference invoices), buyer GSTIN, CGST/SGST split, amount in words,
declaration block. Today this is done separately in Tally.

## Phase 9 — Sharing & delivery

- Server-side PDF generation for a real download (not just browser print).
- WhatsApp share with the quotation attached or linked.
- Optional public link the customer can open without logging in, with expiry.

## Phase 10 — Quotation UX

- Reorder line items (drag).
- Duplicate a single item.
- Room/area grouping ("Ground floor", "Master bedroom") with subtotals.
- Templates for repeat configurations.
- Autosave drafts so a closed tab doesn't lose work.
- Keyboard-first entry for fast on-site quoting.

## Phase 11 — Rate master & terms admin

- Full CRUD on products, not just editing default rates.
- Rate history — what changed, when, by whom.
- Terms library editable in the UI (currently seed-script only).
- Bulk rate adjustment ("raise all sliding windows 5%").

## Phase 12 — Mobile & PWA

Genuinely usable on a phone at a site visit: responsive builder, installable PWA,
offline draft capture that syncs on reconnect.

## Phase 13 — Reporting

Sales by period / product / rep, quotation-to-order conversion, customer value
ranking, CSV export, GST summary for filing.

---

*The last three phases are infrastructure and identity — deliberately last, since
they polish and deploy what the previous twelve build.*

## Phase 14 — MongoDB Atlas & production data

- Provision the Atlas cluster; move off the local test database.
- Connection pooling tuned for serverless; retry and timeout policy.
- Automated backups + a **restore drill** (an untested backup isn't a backup).
- Migration runner for schema changes against real data.
- Seed/import path for the historical quotations in `_reference/`.
- Environment separation: dev / staging / production databases.

## Phase 15 — Deployment, branding & launch

- Deploy to Vercel; custom domain; environment variables and secret rotation.
- **Real logo and brand assets** from the company poster — replacing the current
  placeholder "R" mark — favicon, app icons, PWA icons, login artwork, and the
  print document's letterhead.
- Email delivery for quotations.
- Error monitoring and uptime checks.
- Security pass: rate limiting on login, session policy, dependency audit.
- Onboarding for real users; handover documentation.

---

## Sequencing notes

- **Phases 1–3 are not optional.** They're the difference between a demo and
  software a business runs on. Two are live security holes.
- **Phase 4 before 5** — the dashboard's headline numbers are meaningless until
  quotations can actually change status.
- **Phase 6 before 7–13** — coverage before the codebase doubles in size, not after.
- **Phase 8 depends on 7** (an invoice needs payment terms) **and on 4** (only an
  approved quotation should become an invoice).
- **Phase 14 before 15** — the database has to be real before deploying to it.
- Branding sits in 15 because a logo on a broken app is worth nothing, and it's
  the cheapest phase to move earlier if the client asks.
