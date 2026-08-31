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
  /**
   * Flat custom add-ons only — the per_sqft ones are already folded into
   * `rate` by effectiveRate() before this is called, exactly as the
   * toughened-glass surcharge is. Passing them here instead would
   * double-charge them. See customAddonFlatTotal().
   */
  flatAddonTotal?: number;
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
  const rateAmount =
    item.pricingMode === "per_sqft"
      ? round2(item.rate * totalAreaSqft)
      : round2(item.rate * item.qty);
  // Flat add-ons are added ONCE per line, not per piece and not per sqft —
  // a WPC door's ₹1500 fitting charge is a single charge for the job on that
  // line, regardless of how many doors or how large they are. This is the one
  // charge shape that cannot ride on `rate`, because a per_unit item's rate is
  // multiplied by qty and a per_sqft item's by area; either would scale it.
  const amount = round2(rateAmount + (item.flatAddonTotal ?? 0));
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
  frenchWindowDesign: 50, // Client-confirmed: French window design, +₹50/sqft flat.
} as const;

/**
 * Toughened glass is priced by thickness, not a flat add-on like the
 * SURCHARGES map above — client-confirmed: +₹50/sqft at 5mm, then +₹10/sqft
 * for every additional mm above 5mm. Kept as its own function rather than
 * forced into SURCHARGES because it takes a thickness argument; SURCHARGES'
 * keys are all flat amounts with no parameter.
 */
export const TOUGHENED_GLASS_BASE_MM = 5;
export const TOUGHENED_GLASS_BASE_RATE = 50; // ₹/sqft at TOUGHENED_GLASS_BASE_MM
export const TOUGHENED_GLASS_RATE_PER_MM = 10; // ₹/sqft for each mm above the base

export function toughenedGlassSurcharge(thicknessMm: number): number {
  if (thicknessMm <= 0) return 0;
  if (thicknessMm <= TOUGHENED_GLASS_BASE_MM) return TOUGHENED_GLASS_BASE_RATE;
  return (
    TOUGHENED_GLASS_BASE_RATE +
    (thicknessMm - TOUGHENED_GLASS_BASE_MM) * TOUGHENED_GLASS_RATE_PER_MM
  );
}

/**
 * Colour-based pricing, client-confirmed:
 *  - Black / Gray / Brown: +₹100/sqft flat, on top of everything else.
 *  - Golden Oak / Walnut / Mahogany ("wood-tone"): the colour itself costs as
 *    much again as the item's own base rate — a ₹350/sqft product becomes
 *    ₹700/sqft. Deliberately computed as a multiple of the item's OWN rate
 *    (not a flat constant) so a ₹500 product and a ₹350 product each get a
 *    wood-tone surcharge proportional to their own price, matching how the
 *    client described it ("if 320 then default price would be 320").
 *  - Ventilators are a separate rule entirely, independent of dark/wood-tone:
 *    ANY non-white colour on a ventilator adds a flat amount per unit (not
 *    per sqft — ventilators are priced per_unit), ₹1000 if "with fan point"
 *    is checked, ₹500 if not. This is checked first/takes priority over the
 *    dark/wood-tone rule above when the item is a ventilator.
 *
 * All four numbers are plain constants for now, not yet admin-editable via
 * Settings/Rate Master — that UI is a deferred follow-up. Keeping them here,
 * named and commented like SURCHARGES/TOUGHENED_GLASS_* above, so they're
 * easy to find and change without hunting through the codebase.
 */
export const COLOR_SURCHARGES = {
  darkColor: 100, // Black / Gray / Brown, +₹100/sqft
  woodToneMultiplier: 1, // Golden Oak / Walnut / Mahogany — "1x" of the item's own rate
  ventilatorFanPointColor: 1000, // non-white colour on a ventilator, WITH fan point (flat, per unit)
  ventilatorNoFanPointColor: 500, // non-white colour on a ventilator, WITHOUT fan point (flat, per unit)
} as const;

const DARK_COLORS = new Set(["Black", "Gray", "Brown"]);
const WOOD_TONE_COLORS = new Set(["Golden Oak", "Walnut", "Mahogany"]);

/** True for anything that should NOT trigger the ventilator "non-white colour" rule. */
function isWhiteOrUnset(colour: string): boolean {
  return colour === "" || /white/i.test(colour);
}

/**
 * The ₹/sqft rate addition from a Black/Gray/Brown or wood-tone colour
 * choice, folded into effectiveRate() below exactly like a per_sqft
 * surcharge. Returns 0 for a colour with no pricing rule, and 0 on a
 * per_unit item — see colorFlatSurcharge() for the ventilator (per_unit)
 * case, which this function deliberately does not handle.
 */
export function colorPerSqftSurcharge(colour: string, baseRate: number): number {
  if (DARK_COLORS.has(colour)) return COLOR_SURCHARGES.darkColor;
  if (WOOD_TONE_COLORS.has(colour)) return baseRate * COLOR_SURCHARGES.woodToneMultiplier;
  return 0;
}

/**
 * The flat, once-per-line colour surcharge for a ventilator — ANY non-white
 * colour, not just Black/Gray/Brown/wood-tone, since the client's rule for
 * ventilators is broader than the general dark-colour rule. Returns 0 for
 * anything that isn't a ventilator (see diagramType), so it's safe to call
 * unconditionally alongside colorPerSqftSurcharge() without double-charging
 * a non-ventilator item.
 */
export function colorFlatSurcharge(params: { colour: string; diagramType: string; fanPoint: boolean }): number {
  if (params.diagramType !== "ventilator") return 0;
  if (isWhiteOrUnset(params.colour)) return 0;
  return params.fanPoint ? COLOR_SURCHARGES.ventilatorFanPointColor : COLOR_SURCHARGES.ventilatorNoFanPointColor;
}

/**
 * The rate an item is actually priced at once its surcharges are folded in —
 * i.e. what `amount / area` (or `amount / qty`) works out to. lib/quotations.ts
 * computes an item's stored `amount` from exactly this rate; any document that
 * prints a rate for an item must call this rather than reading `item.rate`
 * directly, or the printed rate and the printed amount stop agreeing with each
 * other. (This is what RDW/26-27/0302 got wrong: it printed the base rate
 * while billing the effective rate, a ₹3,41,550 gap the customer couldn't
 * account for.) Surcharges only ever apply to per_sqft items — a per_unit
 * item's surcharges list is ignored here exactly as it is when the amount
 * itself is computed.
 */
export interface CustomAddonLike {
  amount: number;
  basis: "flat" | "per_sqft";
}

/**
 * The ₹/sqft portion of an item's custom add-ons — folded into the rate by
 * effectiveRate() so it scales with area, exactly like toughened glass.
 * per_unit items get nothing here: there is no area for a per-sqft charge to
 * scale against, so entering one on a per-piece door would be meaningless.
 * A flat charge on such an item is the correct shape, and is handled by
 * customAddonFlatTotal() instead.
 */
export function customAddonPerSqftTotal(
  addons: CustomAddonLike[] | undefined,
  pricingMode: PricingMode
): number {
  if (pricingMode !== "per_sqft") return 0;
  return (addons ?? []).reduce((sum, a) => (a.basis === "per_sqft" ? sum + a.amount : sum), 0);
}

/**
 * The flat portion — added once to the item's amount, never multiplied by qty
 * or area. Applies on BOTH pricing modes: a WPC flush door is per_unit, and
 * its ₹1500 fitting charge still has to reach the bill. This is the gap the
 * SURCHARGES map structurally cannot fill.
 */
export function customAddonFlatTotal(addons: CustomAddonLike[] | undefined): number {
  return (addons ?? []).reduce((sum, a) => (a.basis === "flat" ? sum + a.amount : sum), 0);
}

export function effectiveRate(item: {
  rate: number;
  pricingMode: PricingMode;
  surcharges: string[];
  /** See toughenedGlassSurcharge() — a variable-by-thickness charge, not a
   *  flat SURCHARGES key, so it's folded in as its own parameter. */
  toughenedGlassMm?: number;
  /** Only the per_sqft-basis entries affect the rate; see customAddonPerSqftTotal(). */
  customAddons?: CustomAddonLike[];
  /** See colorPerSqftSurcharge() — Black/Gray/Brown/wood-tone only; a
   *  ventilator's colour surcharge is flat, not per-sqft, and is handled
   *  separately by colorFlatSurcharge() in computeQuotationPricing(). */
  colour?: string;
}): number {
  if (item.pricingMode !== "per_sqft") return item.rate;
  const flatSurchargeSum = item.surcharges.reduce(
    (sum, key) => sum + (SURCHARGES[key as keyof typeof SURCHARGES] ?? 0),
    0
  );
  const toughenedSurcharge = item.toughenedGlassMm ? toughenedGlassSurcharge(item.toughenedGlassMm) : 0;
  const customPerSqft = customAddonPerSqftTotal(item.customAddons, item.pricingMode);
  const colorSurcharge = item.colour ? colorPerSqftSurcharge(item.colour, item.rate) : 0;
  return item.rate + flatSurchargeSum + toughenedSurcharge + customPerSqft + colorSurcharge;
}

export interface PaymentStage {
  /** The configured step text, e.g. "50% advance." */
  text: string;
  /** Parsed percentage, or null when the step carries none. */
  percent: number | null;
  /** Rupee value of this stage, or null when no percentage was parsable. */
  amount: number | null;
}

/**
 * Turns a configured payment scheme ("50% advance.", "30% before dispatch.",
 * "20% after installation.") into rupee amounts against a grand total.
 *
 * Lifted out of the print document so it is unit-testable: a payment schedule
 * that doesn't add up to the amount due is exactly the class of error this app
 * exists to prevent, and it could not previously be tested at all.
 *
 * The LAST stage carrying a percentage is computed as the REMAINDER of the
 * grand total rather than its own rounded percentage. Three independently
 * rounded figures can each be a rupee off and leave the schedule failing to
 * reconcile; taking the remainder guarantees the stages sum to the total
 * exactly. A step with no parsable percentage (e.g. "100% payment for amount
 * less than 20,000/-") still renders, just without an amount, rather than
 * printing NaN.
 */
export function computePaymentStages(steps: string[], grandTotal: number): PaymentStage[] {
  const parsed = steps.map((text) => {
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
    return { text, percent: match ? Number(match[1]) : null };
  });

  const lastWithPercent = parsed.map((p) => p.percent !== null).lastIndexOf(true);

  return parsed.reduce<PaymentStage[]>((acc, stage, i) => {
    if (stage.percent === null) return [...acc, { ...stage, amount: null }];
    if (i === lastWithPercent) {
      const priorSum = acc.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      return [...acc, { ...stage, amount: Math.max(0, grandTotal - priorSum) }];
    }
    return [...acc, { ...stage, amount: Math.round((grandTotal * stage.percent) / 100) }];
  }, []);
}
