# Future ideas — deferred, not forgotten

Things raised during the quotation-document work that are deliberately **not** built now, and why.
Nothing here needs client sign-off to revisit later — this file is the memory of what was discussed
so nobody has to re-derive it.

---

## Rate card additions — source and what's still outstanding

The aluminium range, uPVC 2.5-Track/foldable/openable-double/bathroom-door products, pleated mesh,
PVC/digital doors, WPC products, DGU glass, and the toughened-glass/French-window surcharges were
all added from the client's handwritten rate sheet (photographed pages, transcribed and confirmed
back to the client line by line before any code was written). Every default rate above uses either
the client's own written default, or the midpoint of their written min–max range where no single
default was given — confirmed explicitly as the rule to use.

**Still outstanding — not guessed, deliberately left for the client to specify:**
- **Warranty text.** Client asked for two new warranty lines (15 years on colour shade, 15 years on
  the main profile) to be added to the printed Specification & Terms section. Exact wording not yet
  provided — this is the one item from this whole pass not yet implemented, specifically because
  warranty text is a real commitment printed on a customer-facing document and shouldn't be phrased
  by guesswork.
- **Ventilators with/without fan point.** Client raised this; on inspection both already exist as
  distinct rate-card products with their own diagrams (`ventilator` / `ventilator_fan_point`) and a
  `fanPoint` checkbox in the builder. Flagged back to the client to confirm whether anything beyond
  what already exists was actually being asked for — nothing changed here pending that answer.
- **Two page-2 notes from the rate sheet not yet acted on**, per the client's own instruction to skip
  them for this pass: the "Balcony doors 66/85/92 → Sash" line (clarified as a sash-width *option*
  list, not a product — not yet added as a selectable spec anywhere), and the WPC-door fitting
  charge (confirmed as a flat ₹1500, but not yet wired into the product/surcharge as its own line —
  currently just recorded here as a number, not implemented in `lib/pricing.ts` or the rate card).

## Quotation document optimization — what was deferred and why

A full pass was made over the printed quotation (structure, typography,
pagination, page numbering, acceptance block). These items from that brief were
deliberately NOT built, each for a stated reason rather than for lack of time:

- **Premium cover page.** Explicitly removed earlier at the client's own
  instruction ("we are making things too complicated") in favour of a plain
  single-document layout matching their reference. Re-adding it would reverse
  that decision and add a page to every quotation. Needs the client to change
  their mind, not a code change.
- **Multi-tier warranty (profile / glass / hardware / installation).** Still
  blocked on the business stating what it actually warrants per component. The
  stated terms today are 15 years on the frame and NO warranty on glass, mesh or
  hardware — printing a four-tier table would imply coverage that does not
  exist. See the existing "Multi-tier warranty" entry above.
- **Legal acceptance wording.** The acceptance block prints a plain confirmation
  of specifications, quantities and pricing. Anything stronger — cancellation
  terms, liability, dispute resolution — has to be supplied and approved by the
  business; it must not be drafted here.
- **"Professional installation" as an inclusion.** Not present in the client's
  configured terms. Adding it would be inventing a commitment.
- **Discounts, quotation status workflow, category grouping, room-wise
  grouping, WhatsApp/email send, customer web quotation.** All separate
  features rather than document changes. Discounts in particular touch the
  money core and are covered by the "Discounts" entry above.

**Reduced-borders table style.** A "minimal vertical borders, avoid an
Excel look" direction was raised, but the client had specifically asked for the
opposite ("make it rows and columns properly") and the fully ruled grid was
built to that instruction. The ruled version was kept. Worth re-confirming with
them if the question comes up again.

---

## Tax invoicing — hidden from the nav, not removed

The whole invoicing feature (raise a GST tax invoice from an approved quotation, its own
`INV/25-26/001` numbering series, CGST/SGST vs IGST by buyer state, the HSN/SAC summary) was judged
more than is needed right now and hidden from the UI — deliberately **not deleted**, since it's
fully built, tested, and correctly authorized; it's just adding complexity before it's needed.

**What was actually changed** (three small edits, nothing in `lib/`):
- `app/(app)/layout.tsx` — removed the `/invoices` entry from `NAV_LINKS`. No nav link to it.
- `app/(app)/quotations/[id]/page.tsx` — commented out the "Raise tax invoice" / "View tax invoice"
  button block (left in place as a JSX comment, not deleted, so restoring it is uncommenting one
  block, not rebuilding it).

**What was deliberately left alone:**
- `lib/invoices.ts`, the `Invoice`/`InvoiceInput` schemas, `app/(app)/invoices/*`,
  `app/(print)/invoices/[id]/print`, and `lib/numbering.ts`'s invoice-numbering counter are all
  still there, unmodified, and still fully functional.
- `proxy.ts`'s route matcher still includes `/invoices/:path*` — so the pages are still
  authentication- and ownership-gated exactly as before. Nothing about hiding them from the nav
  makes them less secure; they're just unlinked, not unprotected.
- A user who already knows the URL (e.g. `/invoices`) can still reach it directly and it will
  still work. This was a deliberate choice, not an oversight: the ask was "hide it," not "block
  it," and adding extra route-blocking would have been scope creep beyond what was asked.

**To bring it back:** re-add the `{ href: "/invoices", label: "Invoices" }` line to `NAV_LINKS`,
and un-comment the button block in the quotation detail page. Nothing else needs to change.

---

## Customer history — hidden from the nav, not removed

**Open question for the client, not yet decided — this needs a conversation before either direction
is finalized.** Discussed why the feature exists (repeat-customer history: "has Royal quoted this
person before, what did we charge, what's approved") versus whether it's needed day-to-day (it
isn't — no quotation, pricing, or print logic depends on the Customers *page* existing). Judged not
worth the UI surface right now given the goal of keeping things lean, so it's hidden — same
"hide it, don't delete it" treatment as tax invoicing above.

**Important distinction from the invoicing case: the underlying tracking could NOT be cleanly
turned off even if we wanted to.** Unlike invoices (which are only ever created by an explicit
"Raise tax invoice" click), a `Customer` record is written automatically, silently, on **every
single quotation save** — `createQuotation`/`updateQuotation` in `lib/quotations.ts` both call
`findOrCreateCustomer` unconditionally. There is no flag to opt out of it short of changing the
quotation save path itself, which is exactly the piece of code this whole app is built around
getting right. So "removing customers" was never actually a small nav change — it's either (a) hide
the page and keep the quiet background tracking (what was done), or (b) touch the core quotation
write path to stop writing `customerId`/customer records at all, which is a materially bigger and
riskier change than it sounds. Worth being explicit about that distinction when discussing this with
the client — "turn it off" and "hide the page" are not the same size of change here.

**What was actually changed** (one edit):
- `app/(app)/layout.tsx` — removed the `/customers` entry from `NAV_LINKS`.

**What was deliberately left alone:**
- `lib/customers.ts` (`findOrCreateCustomer`, `listCustomersFor`, `loadCustomerWithHistory`) is
  fully unmodified and keeps running on every quotation save, exactly as before.
- `app/(app)/customers/page.tsx` and `app/(app)/customers/[id]/page.tsx` are untouched and still
  fully functional if reached directly by URL.
- `proxy.ts`'s route matcher still includes `/customers/:path*` — still authentication- and
  ownership-gated, just unlinked, same reasoning as the invoicing entry above.
- The `customers` MongoDB collection and its indexes (`lib/indexes.ts`) are untouched — customer
  history for every quotation ever saved, past and future, is quietly accumulating in the
  background whether or not the page is ever opened.

**To bring it back:** re-add the `{ href: "/customers", label: "Customers" }` line to `NAV_LINKS`.
Nothing else needs to change — the data has been there the whole time.

---

## Room / area grouping in the printed schedule

The product table currently lists every item in plain product-wise order (S.No 1, 2, 3…), no
"Living Room" / "Bathroom" section headers. This has been removed twice now, on the same direct
instruction each time: once from the original single-design print document, and again from
`QuotationDesignB.tsx` (the live "Corporate" design) — that file had briefly reintroduced
room-header rows with per-room subtotals (via `groupItemsByRoom`/`usesRooms` from `lib/grouping.ts`)
during the A/B/C prototyping pass, and was reverted to plain numbering when the client asked for it
to come out again. The client's stated intent is to revisit this later, not to drop it permanently.

**Nothing was lost.** Every item still carries its `room` field in the database exactly as before;
the builder UI still lets a worker tag "Master bedroom", "Balcony", etc. per item. Only the *printed
table* stopped grouping by it. `lib/grouping.ts` (`groupItemsByRoom`/`usesRooms`, fully unit-tested
in `grouping.test.ts`) was untouched both times — the print components just stopped calling it.

**If this needs to come back in `QuotationDesignB.tsx`:** re-add the import, build a `RenderRow`
union with a `"room"` variant again (room name + per-room subtotal, folded in via
`groupItemsByRoom`), and render a header `<tr>` (full-width `colSpan`, left accent border) before
each room's items in the `.db-table` body — this is exactly what was removed to get back to plain
numbering, so the git history for this file has the working version to reference. The tests in
`grouping.test.ts` still pass today — the underlying grouping logic was never broken, just unused by
the print layout. Worth shipping as a per-quotation toggle ("group by room?") rather than an
all-or-nothing choice, since some jobs want it and others don't.

---

## Discounts

No discount field exists anywhere — not in the schema, not in `lib/pricing.ts`, not in the builder.
Deliberately scoped as a paid follow-on because it touches the money core:

- Needs a schema field (quotation-level discount amount or %).
- Must apply **before** GST — applying after would change the taxable value and be a compliance
  error, not just a display choice.
- Needs new unit tests proving the totals still reconcile (`subtotal − discount + GST = grand
  total`, to the rupee) — the same rigor as the existing 143-test suite around
  `lib/pricing.ts`/`lib/quotations.ts`.
- Needs a UI field in the builder and a line on the printed document ("Subtotal / Discount /
  Taxable value / GST / Grand total").

## Product photography

No image upload/storage exists in the app at all. The SVG diagrams (drawn to each item's actual
measurements) currently stand in for product photos. Real photos would need:

- File upload (worker attaches a photo per line item, or an admin attaches one per rate-card
  product as a stock image).
- Storage — a real infra decision (S3/Blob/Cloudinary or similar), not just a code change.
- Print-safe sizing/compression so the document doesn't balloon in file size.

## Multi-tier warranty (Profile / Glass / Hardware / Installation)

The schema has one `warrantyYears: number`. The business's actual stated terms today are: 15 years
on the frame, **no** warranty on glass, mesh, or hardware. Do not print a four-tier warranty
breakdown implying coverage that doesn't exist — this is blocked on the client stating what Royal
actually warrants per component, not on build effort. Once they do, the "quick terms" strip and the
Specification & Terms list are both structured to hold more detail without a layout change.

## Cancellation policy card

The small icon-terms strip (Payment / Timeline / Warranty / Validity) deliberately has no
Cancellation card — nothing in `Settings.terms` or `Quotation.terms` captures a cancellation policy
today. Printing one would mean inventing wording the business hasn't agreed to. Add a
`cancellationPolicy` field to `TermsLibrarySchema` (settings) once the client specifies the actual
terms, then it's a one-line addition to the existing icon strip.

## Dedicated "product visuals" page

An earlier draft of this document (per an initial mockup) had a separate page showing large product
category photos (Windows / Doors / etc.) as a "what you're getting" showcase. Explicitly dropped —
with a diagram already on every schedule row, a separate gallery page would mostly repeat content
without adding new information. Worth reconsidering *only* once product photography (above) exists,
since then a gallery page would show something the schedule rows don't.

## Real PDF generation + WhatsApp send

Today the document is browser-print-to-PDF only (`PrintButton` triggers `window.print()`). A
server-side PDF (Puppeteer/Playwright rendering the same React component headlessly) plus a
one-tap "send to customer's WhatsApp" action would close the loop on the on-site quoting workflow —
build the quote on a phone, hand over a PDF before leaving the site, no separate save/attach step.
Medium-large scope: needs a PDF rendering service or serverless function, plus WhatsApp Business
API integration (or a `wa.me` deep link as a lighter first cut).

## Quotation comparison / tiers (Good / Better / Best)

Raised as the highest-commercial-value idea early in this work. The historical reference data
showed the same job quoted twice by hand at two spec tiers ("Jakkur Teak vs White") — evidence this
is a real workflow already happening manually. A single quotation carrying two or three pricing
columns side by side (same items, different profile/glass/hardware tier) would let a customer
choose on the page instead of waiting for a second quote. Large scope — changes the data model
(multiple rate sets per item) and the print layout meaningfully. Not started.
