import { describe, expect, it } from "vitest";
import { computeItem, computeTotals, SURCHARGES } from "../pricing";
import type { QuotationInput } from "@/models/schemas";

/**
 * lib/quotations.ts recomputes every item's area/amount server-side rather
 * than trusting the client — that's the discipline that makes the historical
 * stale-GST bug impossible. computeQuotationPricing() is private to that
 * module, so this reproduces its exact logic and asserts the properties that
 * matter. If the real implementation ever diverges from this, the
 * end-to-end scripts (e2e-test.mjs) catch it against a live server.
 */
function recomputeLikeServer(input: Pick<QuotationInput, "items" | "gst" | "transportation">) {
  const computedItems = input.items.map((item) => {
    const surchargeSum =
      item.pricingMode === "per_sqft"
        ? item.surcharges.reduce((sum, key) => sum + (SURCHARGES[key as keyof typeof SURCHARGES] ?? 0), 0)
        : 0;
    const effectiveRate = item.rate + surchargeSum;
    return {
      ...item,
      ...computeItem({
        billedWidthFt: item.billed.w,
        billedHeightFt: item.billed.h,
        qty: item.qty,
        pricingMode: item.pricingMode,
        rate: effectiveRate,
      }),
    };
  });
  const totals = computeTotals(computedItems, input.gst.enabled ? input.gst.rate : 0, input.transportation);
  return { computedItems, totals };
}

function item(overrides: Partial<QuotationInput["items"][number]> = {}): QuotationInput["items"][number] {
  return {
    id: "i1",
    productType: "sliding_2_track",
    description: "2 Track sliding window",
    room: "",
    handing: "none",
    billed: { w: 5, h: 4 },
    qty: 1,
    pricingMode: "per_sqft",
    rate: 300,
    specs: { profile: "", colour: "", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
    surcharges: [],
    diagram: { type: "sliding_2_track", panels: 2, meshPanels: 0, handing: "none", fanPoint: false },
    remarks: "",
    ...overrides,
  };
}

describe("server-side recomputation — the anti-stale-GST discipline", () => {
  it("derives the amount from billed dimensions and rate, ignoring anything a client might have sent", () => {
    // The input type deliberately omits amount/areaPerUnitSqft/totalAreaSqft
    // (QuotationItemInputSchema), so a client literally cannot supply them.
    // 5ft x 4ft = 20 sqft x 1 x ₹300 = ₹6,000
    const { computedItems } = recomputeLikeServer({
      items: [item()],
      gst: { enabled: false, rate: 0 },
      transportation: 0,
    });
    expect(computedItems[0].amount).toBe(6000);
    expect(computedItems[0].totalAreaSqft).toBe(20);
  });

  it("recomputes GST from the item amounts every time, so a stale stored figure cannot survive", () => {
    const { totals } = recomputeLikeServer({
      items: [item({ rate: 300 })], // ₹6,000
      gst: { enabled: true, rate: 18 },
      transportation: 0,
    });
    expect(totals.subtotal).toBe(6000);
    expect(totals.cgst).toBe(540); // 9% of 6000
    expect(totals.sgst).toBe(540);
    expect(totals.grandTotal).toBe(7080);
  });

  it("applies per-sqft surcharges to the rate before computing the amount", () => {
    // +₹30/sqft for non-white or one-way glass -> rate becomes 330
    // 20 sqft x ₹330 = ₹6,600
    const { computedItems } = recomputeLikeServer({
      items: [item({ surcharges: ["nonWhiteOrOneWayGlass"] })],
      gst: { enabled: false, rate: 0 },
      transportation: 0,
    });
    expect(computedItems[0].amount).toBe(6600);
  });

  it("stacks multiple surcharges additively", () => {
    // +30 +20 +20 = rate 370; 20 sqft x 370 = ₹7,400
    const { computedItems } = recomputeLikeServer({
      items: [item({ surcharges: ["nonWhiteOrOneWayGlass", "ssMesh", "aluminiumTrack"] })],
      gst: { enabled: false, rate: 0 },
      transportation: 0,
    });
    expect(computedItems[0].amount).toBe(7400);
  });

  it("does NOT apply per-sqft surcharges to a per-piece item", () => {
    // Surcharges are quoted "per sqft" in the business's own terms, so they
    // are meaningless on an item priced per piece — applying them anyway
    // would silently inflate ventilator pricing.
    const { computedItems } = recomputeLikeServer({
      items: [item({ pricingMode: "per_unit", rate: 1800, qty: 3, surcharges: ["ssMesh"] })],
      gst: { enabled: false, rate: 0 },
      transportation: 0,
    });
    expect(computedItems[0].amount).toBe(5400); // 1800 x 3, no surcharge
  });

  it("adds transportation AFTER tax and does not tax it", () => {
    // Matches the reference quotations: transportation is a flat line added
    // to the taxed total, never part of the taxable value.
    const { totals } = recomputeLikeServer({
      items: [item()], // ₹6,000
      gst: { enabled: true, rate: 18 },
      transportation: 1000,
    });
    expect(totals.subtotal).toBe(6000);
    expect(totals.cgst + totals.sgst).toBe(1080); // 18% of 6000 only
    expect(totals.grandTotal).toBe(8080); // 6000 + 1080 + 1000
  });

  it("ignores the GST rate entirely when the toggle is off", () => {
    const { totals } = recomputeLikeServer({
      items: [item()],
      gst: { enabled: false, rate: 18 }, // rate set but disabled
      transportation: 0,
    });
    expect(totals.cgst).toBe(0);
    expect(totals.sgst).toBe(0);
    expect(totals.grandTotal).toBe(6000);
  });

  it("sums a mixed per-sqft and per-piece quotation correctly", () => {
    const { totals } = recomputeLikeServer({
      items: [
        item({ id: "a", rate: 300 }), // 20 sqft x 300 = 6000
        item({ id: "b", pricingMode: "per_unit", rate: 1800, qty: 2 }), // 3600
      ],
      gst: { enabled: false, rate: 0 },
      transportation: 0,
    });
    expect(totals.subtotal).toBe(9600);
  });
});
