# Plan — premium quotation document

Response to the 5-page proposal brief, scoped to the agreed commercial envelope.

**Commercial position:** the current engagement is fixed and modest. This plan delivers the full
*perceived* upgrade — the document a customer holds — inside that scope, and cleanly parks the
genuinely expensive items as a costed Phase 2 the client can buy later. Nothing here is a
half-feature or a stub; the deferred items are deferred whole, so they can be quoted and built
without rework.

---

## The rule I'm applying

> Build everything that changes what the customer *sees and feels*.
> Defer everything that changes what the system *does*.

The brief's high-impact parts — cover page, product cards, visual hierarchy, commercial summary,
acceptance block — are all **presentation-layer**. They reuse data that already exists and are
cheap. The expensive items — discounts, photo upload, multi-tier warranty — all require schema,
pricing, storage or client decisions. Those are the natural paid follow-on.

That split is why this fits the budget without the document looking cheap.

---

## IN SCOPE — now, current engagement

### Phase 1 — Rate disclosure fix *(correctness, small, non-negotiable)*

Not cosmetic. **The document currently contradicts its own arithmetic.** Live example in the
client's own data (`RDW/26-27/0302`): the page prints `₹250/sqft × 11,385 sqft`, which multiplies to
₹28,46,250, but bills **₹31,87,800**. The ₹30/sqft surcharge is applied in the maths and omitted
from the printed rate, leaving a **₹3,41,550 gap the customer cannot account for**.

No amount of design survives a customer finding that. It ships before any redesign.

- Print the **effective rate** (`₹280/sqft`) as the primary figure, with `250 + 30 surcharge` beneath.
- Derive it in the component from the same `SURCHARGES` map `lib/quotations.ts` prices with, so the
  two can never drift apart. Nothing new is stored.
- Unit test: printed rate × area === stored amount, for a surcharged item. This is what stops it
  regressing.

### Phase 2 — Cover / executive summary page

The single biggest lift in perceived value, and it's nearly all existing data.

- Logo, company block, **QUOTATION**, quote no., date, validity.
- Customer / project / site / phone, plus **Prepared by** — `createdBy` is stored on every quotation
  and has never been shown. One lookup; puts a human name on the document.
- **Hero visual: the largest item's diagram rendered large**, at the customer's real dimensions.
- Summary: openings, total area, subtotal, GST, grand total in the brand band.
- "Prepared specifically for your project."

### Phase 3 — Product schedule as cards

The brief's central point, and correct: one giant table is the wrong container.

- Card per item: **diagram | description + specs | dimensions/qty/area | rate + amount**.
- Print the specs already stored but never shown — profile, colour, glass + thickness, mesh, track,
  hardware, reinforcement.
- Grouped by room where used (`lib/grouping.ts`, already built and tested), else by category.
- Keep the aligned numeric columns; cards for readability, alignment for scanning.

### Phase 4 — Commercial summary, terms, acceptance

- **Category subtotals** (Windows / Doors / Mesh / Aluminium) from each item's rate-card `category` —
  the brief asks for this and the data already supports it, no schema change.
- Payment schedule table (already built, sum-to-total rounding rule already proven).
- Terms as short grouped blocks, not a wall.
- Warranty stated **as Royal actually offers it today**, in a section structured to hold more tiers
  later without a rewrite.
- **Customer acceptance block** — name, signature, date. Turns the document into something signable.
  Highest close-rate leverage of anything in this list, and it costs almost nothing.

**Definition of done for the current engagement:** all four phases green on `npm run verify`, and
rendered correctly at 1, 3 and 15 items in print preview.

---

## PHASE 2 — costed follow-on (quote separately)

Deferred *whole*, not stubbed. Each is independently sellable and buildable without rework.

| Feature | Why it costs more | Rough shape |
|---|---|---|
| **Discounts** | Touches the money core. Needs schema, `lib/pricing.ts` change applied **before** GST (wrong order = wrong tax base = compliance error), builder UI, and new tests proving totals still reconcile. Small surface, high blast radius — must be done carefully, not cheaply. | S–M |
| **Product photography** | No image support exists at all. Needs upload, storage, a CDN/hosting decision, per-item association, and print-safe sizing. Real infra, ongoing storage cost. | M–L |
| **Multi-tier warranty** (Profile / Glass / Hardware / Installation) | **Blocked on the client, not on effort.** Royal's current terms say 15 years frame and *no* warranty on glass, mesh or hardware. I will not print warranty commitments the business hasn't made. Cheap to build once they state the tiers. | S (after client input) |
| **Dedicated product-visuals page** (brief's page 3) | With a diagram already on every card, a separate gallery mostly repeats content. Genuinely valuable *once photos exist* — so it naturally bundles with photography. | S (bundled) |

**Suggested pitch to the client:** the document upgrade lands now. Discounts and photo-rich
proposals are a follow-on module — worth quoting once they've seen the new document in front of
customers and know which they actually want.

---

## Why nothing breaks

- **`lib/pricing.ts`, `lib/quotations.ts`, `lib/authz.ts` are untouched** in every in-scope phase.
  The money and authorization cores are correct and carry 137 passing tests. This is
  presentation-layer work throughout — which is *precisely* why it fits the budget.
- Sections are added to the existing `QuotationDocument`, not a parallel rewrite. No big-bang swap,
  no dead code path, no half-migrated state.
- Every phase ends green and is independently shippable — if the budget runs out after Phase 2, what
  shipped is still coherent and complete.
- Print-first: A4 210mm, `@page` rules, `avoid-break` per block, verified in print preview.
- Phase 11 rate-admin files (another agent's uncommitted work) stay untouched.

---

## Sequencing rationale

1 → correctness before polish; a beautiful document with an unexplained ₹3.4L gap is worse than a
plain honest one. 2 → the cover is what the customer sees first and is self-contained. 3 → the
schedule is the bulk. 4 → the closing pages, including the signable block.
