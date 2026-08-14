/**
 * All quotation money math lives here — pure functions, no component may
 * compute a rupee value inline. Reverse-engineered from every formula cell
 * (`<f>` tags) across the 76 sheets of `_reference/Royal - March.xlsx`.
 *
 * Two facts the source data proved, both counter to the trade-standard
 * assumption:
 *  - There is NO minimum-chargeable-area rule (zero MAX/MIN/IF/ROUND/CEILING
 *    formulas in the entire dataset). Area is plain width x height.
 *  - Two pricing modes coexist per line item: "per_sqft" (rate x area) and
 *    "per_unit" (rate x qty, area is tracked but not priced) — proved by two
 *    rows of the same sheet (Rammurthy Nagar row 10 vs row 11).
 */

export type PricingMode = "per_sqft" | "per_unit";

/** Effective combined GST %, split evenly into CGST + SGST. All three regimes are live in the source data. */
export type GstRatePercent = 18 | 9 | 0;

export interface QuotationItemInput {
  billedWidthFt: number;
  billedHeightFt: number;
  qty: number;
  pricingMode: PricingMode;
  rate: number;
}

export interface QuotationItemComputed {
  areaPerUnitSqft: number;
  totalAreaSqft: number;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeItem(item: QuotationItemInput): QuotationItemComputed {
  const areaPerUnitSqft = round2(item.billedWidthFt * item.billedHeightFt);
  const totalAreaSqft = round2(areaPerUnitSqft * item.qty);
  const amount =
    item.pricingMode === "per_sqft"
      ? round2(item.rate * totalAreaSqft)
      : round2(item.rate * item.qty);
  return { areaPerUnitSqft, totalAreaSqft, amount };
}

export interface Totals {
  subtotal: number;
  /** Rounded to the nearest rupee for display — the exact value feeds grandTotal, not this. */
  cgst: number;
  sgst: number;
  transportation: number;
  grandTotal: number;
  /** grandTotal minus the unrounded exact total; always < 1 rupee. */
  roundOff: number;
}

/**
 * GST is always recomputed here from the current subtotal — never read back
 * from a stored value. This is deliberate: four real quotations in the
 * reference data (Jakkur Teak/White, both Bommasandra quotes) shipped with a
 * stale copy-pasted CGST figure that no longer matched its own Amount cell.
 *
 * Rounding is applied exactly once, on the final grand total — matching the
 * source workbooks, where the displayed CGST/SGST cells are rounded only for
 * presentation but the stored formula (and the total it feeds) keeps full
 * precision. Verified against five real quotations' worked totals; see
 * lib/__tests__/pricing.test.ts.
 */
export function computeTotals(
  items: QuotationItemComputed[],
  gstRatePercent: GstRatePercent,
  transportation: number
): Totals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.amount, 0));

  const halfRate = gstRatePercent / 2 / 100;
  const cgstExact = subtotal * halfRate;
  const sgstExact = subtotal * halfRate;

  const grandTotalExact = subtotal + cgstExact + sgstExact + transportation;
  const grandTotal = Math.round(grandTotalExact);

  return {
    subtotal,
    cgst: Math.round(cgstExact),
    sgst: Math.round(sgstExact),
    transportation,
    grandTotal,
    roundOff: round2(grandTotal - grandTotalExact),
  };
}

/**
 * Surcharge rules verbatim from the reference Terms & Conditions block.
 * Applied as rate modifiers (₹/sqft), never silently — the builder shows a
 * chip on the item for each one that's active.
 */
export const SURCHARGES = {
  nonWhiteOrOneWayGlass: 30, // "Other color or one way glass rs 30 extra per sqft."
  ssMesh: 20, // "SS Mesh if required, rs 20/- extra per sqft."
  aluminiumTrack: 20, // "If Aluminum track required, rs 20/- extra per sqft."
} as const;
