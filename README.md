# Royal Doors &amp; Windows — Quotation Maker

A quotation system for a uPVC / aluminium / WPC doors-and-windows fabricator in Bengaluru,
replacing a manual Excel workflow.

A salesperson enters the customer, adds each window or door with its site measurement and specs, and
gets a branded A4 quotation — with an auto-drawn scale diagram of every unit — in a few minutes.
Rates come from a central master so pricing stays consistent, tax is recomputed on every save, and
every quotation is numbered, searchable and revisable.

## Why

The previous process was one Excel workbook per customer. Analysing the real historical quotations
turned up concrete failure modes this app is built to prevent:

- **Wrong tax on quotations that went to customers.** One quotation showed Amount ₹73,175 with CGST
  ₹11,052 — 9% of 73,175 is ₹6,586. The same stale `11052` had been copy-pasted into three other
  quotations, each with a different amount. Sheets were duplicated and the tax cell never
  recalculated.
- **Rates drifting with nothing to anchor them.** A 2-Track sliding window appears at 270, 280, 290,
  300, 310, 320, 340 and 350 ₹/sqft across different sheets.
- **No quote numbers at all**, so nothing was traceable or revisable.
- **Unrounded floats** stored straight into totals (`168009.72499999998`).

## Features

- **Quotation builder** — live-calculating, with site measurements entered in **mm** and converted
  to billed feet automatically (overridable, because the conversion is a judgement call).
- **Auto-drawn SVG diagrams** for 17 product types — sliding (2 / 2.5 / 3 track), casement, fixed,
  ventilators, doors, mesh, aluminium — with dimension lines, opening direction arrows and hinge
  symbols. Drawn from the entered sizes; nothing is hand-drawn.
- **Two pricing modes per line item** — per sqft, or per piece (ventilators and small units are
  priced per piece in this trade, and mixing them up is a large error).
- **Surcharges** from the business's own terms (+₹30/sqft for non-white or one-way glass,
  +₹20/sqft for SS mesh or aluminium track).
- **Per-quotation GST toggle** (18% / 9% / 0% — all three are in real use), always recomputed,
  never read back from storage.
- **Branded A4 print document** with a diagram beside every line item, totals, amount in words,
  terms and bank details. Printed via the browser, so there's no PDF library or headless-Chrome
  dependency.
- **Quote numbering** — `RDW/25-26/0042`, Indian financial year, atomic counter, `-R1` revision
  suffixes.
- **Duplicate as a variant** — same measurements, new quote number, ready to re-price (a workflow
  the historical data showed was already being done by hand).
- **Customer history**, rate master, company/bank settings, and role-based login (admin / sales).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · MongoDB · Auth.js (NextAuth v5) · Vitest

## Getting started

```bash
npm install
cp .env.local.example .env.local     # then fill in MONGODB_URI and AUTH_SECRET
```

Generate an `AUTH_SECRET` with `openssl rand -base64 32` (or
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

For `MONGODB_URI`, either point at a MongoDB Atlas cluster, or run a local one for development:

```bash
node scripts/local-mongo.mjs   # leave running; prints the URI to use
```

Seed the rate card, settings and an admin user:

```bash
npm run seed -- --email you@example.com --password "<pick-one>" --name "Your Name"
```

Then:

```bash
npm run dev        # development
npm run build && npm run start   # production
```

See [DEMO.md](DEMO.md) for a walkthrough script.

## Tests

Two layers. Unit tests need nothing running:

```bash
npm run verify     # typecheck + lint + unit tests
```

Browser suites need a built app, a database, and two seeded accounts:

```bash
npm run build && npm run start          # in one terminal
npm run test:e2e -- <adminEmail> <adminPass> <salesEmail> <salesPass>
```

The browser suites cover authorization (a sales user must not reach another user's quotation by
URL, API, print view, or list), customer scoping, unique-index enforcement against a real
database, pagination, dashboard figures against a known dataset, and the full create → print →
edit → duplicate journey.

The pricing engine is the correctness anchor, so its tests assert against **real historical
quotations** — five of them reproduce to the exact rupee, and one test specifically proves the
stale-GST bug above cannot recur.

## Project layout

```
app/(app)/        authenticated pages — quotations, customers, rates, settings
app/(print)/      the print-only quotation document route
app/dev/          dev-only visual QA harnesses (diagram gallery, builder, print, rates)
components/
  builder/        the quotation builder UI
  diagram/        the SVG window/door diagram engine
  print/          the branded A4 document
lib/
  pricing.ts      all money math — pure and unit-tested
  dimensions.ts   mm -> billed-feet conversion
  quotations.ts   the single write path for quotations
  words.ts        amount in words (Indian lakh/crore)
models/           Zod schemas, plus rate-card and settings seed data
scripts/          seeding, a local MongoDB, and Playwright QA scripts
```

## Notes

- **Money math lives only in `lib/pricing.ts`.** No component computes a rupee value inline, and no
  client-sent amount is ever persisted — `lib/quotations.ts` recomputes every item from its billed
  dimensions and rate before writing.
- **Customer details and rates are snapshotted into each quotation.** Editing the rate master later
  must never silently change a quotation already sent to a customer.
