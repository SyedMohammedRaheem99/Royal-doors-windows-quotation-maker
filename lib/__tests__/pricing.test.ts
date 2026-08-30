import { describe, expect, it } from "vitest";
import {
  computeItem,
  computePaymentStages,
  computeTotals,
  effectiveRate,
  SURCHARGES,
  TOUGHENED_GLASS_BASE_MM,
  TOUGHENED_GLASS_BASE_RATE,
  TOUGHENED_GLASS_RATE_PER_MM,
  toughenedGlassSurcharge,
} from "../pricing";
import { feetToArchLabel, mmToFeet, snapToHalfFoot, suggestBilledFeet } from "../dimensions";
import { amountInWords, rupeesInWords } from "../words";

describe("computeItem — worked examples from Royal - March.xlsx", () => {
  it("Rammurthy Nagar row 10 — per-sqft: 5.5x6.5, qty 14, rate 370", () => {
    const result = computeItem({
      billedWidthFt: 5.5,
      billedHeightFt: 6.5,
      qty: 14,
      pricingMode: "per_sqft",
      rate: 370,
    });
    expect(result.areaPerUnitSqft).toBe(35.75);
    expect(result.totalAreaSqft).toBe(500.5);
    expect(result.amount).toBe(185185);
  });

  it("Rammurthy Nagar row 11 — per-unit: 2.5x2.0, qty 26, rate 1600 (proves per-piece mode is NOT area-priced)", () => {
    const result = computeItem({
      billedWidthFt: 2.5,
      billedHeightFt: 2.0,
      qty: 26,
      pricingMode: "per_unit",
      rate: 1600,
    });
    expect(result.totalAreaSqft).toBe(130); // area is still tracked...
    expect(result.amount).toBe(41600); // ...but pricing ignores it. 1600*26, not 1600*130.
  });

  it("HKBK Suhail qty-1 per-piece shorthand: rate 1400, qty 1", () => {
    const result = computeItem({
      billedWidthFt: 3,
      billedHeightFt: 3,
      qty: 1,
      pricingMode: "per_unit",
      rate: 1400,
    });
    expect(result.amount).toBe(1400);
  });

  it("has no minimum-chargeable-area floor — a tiny opening prices at its true area", () => {
    // Confirms the negative finding: zero MAX/MIN/IF/ROUND formulas exist in the
    // source dataset. Area is plain width x height, however small.
    const result = computeItem({
      billedWidthFt: 1,
      billedHeightFt: 1,
      qty: 1,
      pricingMode: "per_sqft",
      rate: 300,
    });
    expect(result.totalAreaSqft).toBe(1);
    expect(result.amount).toBe(300);
  });
});

describe("computeTotals — real quotation totals, reproduced to the rupee", () => {
  it("Rabbani - Quotation.pdf: 18% GST, transport 1000", () => {
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 128520 }],
      18,
      1000
    );
    expect(totals.subtotal).toBe(128520);
    expect(totals.cgst).toBe(11567); // display-rounded from 11566.8
    expect(totals.sgst).toBe(11567);
    expect(totals.grandTotal).toBe(152654); // exact 152653.6 rounds once, at the end
  });

  it("Nayaz bhai - Arkavati.......pdf: 18% GST, transport 1000, exact division", () => {
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 87800 }],
      18,
      1000
    );
    expect(totals.cgst).toBe(7902);
    expect(totals.sgst).toBe(7902);
    expect(totals.grandTotal).toBe(104604);
  });

  it("Shampur - Acrylic.......pdf: 18% GST, transport 1000", () => {
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 135750 }],
      18,
      1000
    );
    expect(totals.cgst).toBe(12218); // display-rounded from 12217.5
    expect(totals.grandTotal).toBe(161185); // exact 12217.5 x2 keeps the total a whole rupee
  });

  it("Rammurhty Nagar - Quote Balcony.pdf: the 4.5% half-rate regime (effective 9% GST)", () => {
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 350900 }],
      9,
      1000
    );
    expect(totals.cgst).toBe(15791); // display-rounded from 15790.5
    expect(totals.grandTotal).toBe(383481);
  });

  it("JP NAGAR - QUOTE......pdf: zero-rated (cash job), transport 1500", () => {
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 177580 }],
      0,
      1500
    );
    expect(totals.cgst).toBe(0);
    expect(totals.sgst).toBe(0);
    expect(totals.grandTotal).toBe(179080);
  });

  it("regression: GST is always recomputed live, so the Jakkur stale-CGST bug cannot occur", () => {
    // The real Jakkur Teak quotation shipped with Amount 73175 / CGST 11052 —
    // a value copy-pasted from an unrelated sheet (9% of 73175 is 6586, not
    // 11052). Our totals are derived only from the item amounts, so a
    // mismatched stored figure has nowhere to come from.
    const totals = computeTotals(
      [{ areaPerUnitSqft: 0, totalAreaSqft: 0, amount: 73175 }],
      18,
      0
    );
    expect(totals.cgst).toBe(6586);
    expect(totals.cgst).not.toBe(11052);
  });
});

describe("dimensions — mm to billed feet, mined pairs from the site-measurement columns", () => {
  // Only pairs where the mined mm value snaps cleanly to the nearest 0.5 ft are
  // asserted exactly. Two mined pairs (802mm -> billed 3ft, 1750mm -> billed
  // 6ft) are DOCUMENTED HUMAN INCONSISTENCIES — the operator rounded past the
  // nearest half-foot on those specific rows (1715mm -> 5.5ft but 1750mm ->
  // 6ft on the same sheet). suggestBilledFeet() gives the consistent
  // nearest-0.5 answer; the builder UI must let the user override it, which
  // is exactly the case those two rows exist to justify — not a bug to fix.
  const cases: Array<[mm: number, billedFt: number]> = [
    [145, 1],
    [195, 1],
    [341, 2],
    [415, 2],
    [466, 2],
    [619, 2],
    [697, 2.5],
    [1204, 4],
    [1325, 4.5],
    [4327, 14],
  ];

  it.each(cases)("suggestBilledFeet(%i) -> %s ft", (mm, expected) => {
    expect(suggestBilledFeet(mm)).toBe(expected);
  });

  it("mmToFeet converts without snapping", () => {
    expect(mmToFeet(304.8)).toBe(1);
  });

  it("snapToHalfFoot rounds to the nearest 0.5", () => {
    expect(snapToHalfFoot(5.63)).toBe(5.5);
    expect(snapToHalfFoot(5.8)).toBe(6);
  });

  it("feetToArchLabel formats billed feet as feet-inches for diagrams", () => {
    expect(feetToArchLabel(5)).toBe("5'-0\"");
    expect(feetToArchLabel(5.5)).toBe("5'-6\"");
    expect(feetToArchLabel(0.5)).toBe("0'-6\"");
  });
});

describe("amount in words — Indian lakh/crore grouping", () => {
  it("matches the verbatim Whitefield invoice wording", () => {
    // "INR. Forty nine thousand five hundred & sixty only." (& simplified to "and" here)
    expect(rupeesInWords(49560)).toBe("Forty Nine Thousand Five Hundred Sixty");
  });

  it("handles lakhs", () => {
    expect(rupeesInWords(152654)).toBe("One Lakh Fifty Two Thousand Six Hundred Fifty Four");
  });

  it("wraps with the INR prefix and 'only' suffix", () => {
    expect(amountInWords(1000)).toBe("INR. One Thousand only.");
  });
});

describe("effectiveRate — what a customer-facing document must print as the rate", () => {
  it("adds a single surcharge to the base rate for a per_sqft item", () => {
    const rate = effectiveRate({ rate: 250, pricingMode: "per_sqft", surcharges: ["nonWhiteOrOneWayGlass"] });
    expect(rate).toBe(250 + SURCHARGES.nonWhiteOrOneWayGlass);
  });

  it("stacks multiple surcharges", () => {
    const rate = effectiveRate({
      rate: 355,
      pricingMode: "per_sqft",
      surcharges: ["ssMesh", "aluminiumTrack"],
    });
    expect(rate).toBe(355 + SURCHARGES.ssMesh + SURCHARGES.aluminiumTrack);
  });

  it("ignores surcharges on a per_unit item, matching computeQuotationPricing's rule", () => {
    const rate = effectiveRate({ rate: 1800, pricingMode: "per_unit", surcharges: ["ssMesh"] });
    expect(rate).toBe(1800);
  });

  it("returns the base rate unchanged when there are no surcharges", () => {
    expect(effectiveRate({ rate: 300, pricingMode: "per_sqft", surcharges: [] })).toBe(300);
  });

  /**
   * The regression this whole function exists to prevent: RDW/26-27/0302
   * printed "₹250/sqft x 11,385 sqft" (= ₹28,46,250) while billing
   * ₹31,87,800 — the non-white-glass surcharge was applied in the stored
   * amount but never reflected in the printed rate, a ₹3,41,550 gap with no
   * explanation on the page. Printing effectiveRate() × area must equal the
   * stored amount for any surcharged item, always.
   */
  it("real case: printed rate x area reproduces the stored amount exactly (RDW/26-27/0302)", () => {
    const item = { rate: 250, pricingMode: "per_sqft" as const, surcharges: ["nonWhiteOrOneWayGlass"] };
    const totalAreaSqft = 11385;
    const storedAmount = 3187800;

    const printedRate = effectiveRate(item);
    expect(printedRate).toBe(280);
    expect(printedRate * totalAreaSqft).toBe(storedAmount);
  });

  it("printed rate x area matches computeItem's amount for any surcharged per_sqft item", () => {
    const item = { rate: 355, pricingMode: "per_sqft" as const, surcharges: ["ssMesh", "aluminiumTrack"] };
    const billedWidthFt = 5.5;
    const billedHeightFt = 6.5;
    const qty = 14;

    const computed = computeItem({ billedWidthFt, billedHeightFt, qty, pricingMode: "per_sqft", rate: effectiveRate(item) });
    expect(effectiveRate(item) * computed.totalAreaSqft).toBe(computed.amount);
  });

  it("adds the flat French window design surcharge, same as any other SURCHARGES key", () => {
    const rate = effectiveRate({ rate: 500, pricingMode: "per_sqft", surcharges: ["frenchWindowDesign"] });
    expect(rate).toBe(500 + SURCHARGES.frenchWindowDesign);
  });

  it("folds in the toughened-glass surcharge alongside flat surcharges", () => {
    const rate = effectiveRate({
      rate: 300,
      pricingMode: "per_sqft",
      surcharges: ["ssMesh"],
      toughenedGlassMm: 8,
    });
    expect(rate).toBe(300 + SURCHARGES.ssMesh + toughenedGlassSurcharge(8));
  });

  it("ignores toughenedGlassMm on a per_unit item, same rule as flat surcharges", () => {
    const rate = effectiveRate({ rate: 1800, pricingMode: "per_unit", surcharges: [], toughenedGlassMm: 12 });
    expect(rate).toBe(1800);
  });
});

describe("toughenedGlassSurcharge — client-confirmed: +₹50 at 5mm, +₹10/sqft per mm above that", () => {
  it("charges the base rate at exactly the base thickness (5mm)", () => {
    expect(toughenedGlassSurcharge(TOUGHENED_GLASS_BASE_MM)).toBe(TOUGHENED_GLASS_BASE_RATE);
    expect(toughenedGlassSurcharge(5)).toBe(50);
  });

  it("adds the per-mm rate for every mm above the base", () => {
    expect(toughenedGlassSurcharge(6)).toBe(60);
    expect(toughenedGlassSurcharge(8)).toBe(80);
    expect(toughenedGlassSurcharge(10)).toBe(100);
    expect(toughenedGlassSurcharge(12)).toBe(120);
  });

  it("never charges more than the base rate below the base thickness", () => {
    // Below 5mm isn't a real toughened-glass thickness in this trade, but the
    // function should still degrade sanely rather than go negative.
    expect(toughenedGlassSurcharge(3)).toBe(TOUGHENED_GLASS_BASE_RATE);
  });

  it("is zero for a non-positive thickness", () => {
    expect(toughenedGlassSurcharge(0)).toBe(0);
    expect(toughenedGlassSurcharge(-5)).toBe(0);
  });

  it("scales linearly using the confirmed per-mm rate, not a hardcoded table", () => {
    for (const mm of [5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(toughenedGlassSurcharge(mm)).toBe(
        TOUGHENED_GLASS_BASE_RATE + (mm - TOUGHENED_GLASS_BASE_MM) * TOUGHENED_GLASS_RATE_PER_MM
      );
    }
  });
});

describe("computePaymentStages — the schedule must reconcile to the grand total", () => {
  const SCHEME_50_30_20 = ["50% advance.", "30% before dispatch.", "20% after installation."];

  it("splits the client-confirmed 50/30/20 scheme against a real grand total", () => {
    // The 14-item reference quotation: 540 sqft, 5,94,000 subtotal, 18% GST,
    // 2,500 transportation -> 7,03,420. These are the figures the business
    // signed off on, used here as a fixed regression target.
    const stages = computePaymentStages(SCHEME_50_30_20, 703420);
    expect(stages.map((s) => s.amount)).toEqual([351710, 211026, 140684]);
  });

  it("always sums to exactly the grand total, never a rupee off", () => {
    // Independently rounding each percentage can drift; the last stage is the
    // remainder specifically to prevent that. Check across awkward totals.
    for (const total of [703420, 1, 999, 100001, 33333, 7, 250000, 8675309]) {
      const sum = computePaymentStages(SCHEME_50_30_20, total).reduce((s, x) => s + (x.amount ?? 0), 0);
      expect(sum).toBe(total);
    }
  });

  it("reconciles for any scheme whose percentages total 100", () => {
    const schemes = [
      ["60% advance.", "30% before dispatch.", "10% after installation."],
      ["70% advance.", "30% after installation."],
      ["25% a.", "25% b.", "25% c.", "25% d."],
    ];
    for (const scheme of schemes) {
      const sum = computePaymentStages(scheme, 703420).reduce((s, x) => s + (x.amount ?? 0), 0);
      expect(sum).toBe(703420);
    }
  });

  it("renders a step with no percentage without inventing an amount", () => {
    const stages = computePaymentStages(["100% payment for amount less than 20,000/-"], 15000);
    // "100%" IS parsable here, so it takes the remainder — the whole total.
    expect(stages[0].amount).toBe(15000);

    const noPercent = computePaymentStages(["Payable on completion."], 15000);
    expect(noPercent[0].amount).toBeNull();
    expect(noPercent[0].percent).toBeNull();
  });

  it("handles an empty scheme without throwing", () => {
    expect(computePaymentStages([], 703420)).toEqual([]);
  });
});

describe("14-item reference quotation — end-to-end regression (client-signed figures)", () => {
  it("reproduces the agreed subtotal, GST split, and grand total exactly", () => {
    // Rebuilt from the same shape as the stored quotation: 14 items totalling
    // 540 sqft at the rates on record. Guards the whole money path — if any
    // future layout or pricing change moves these numbers, this fails loudly.
    const items = [
      { w: 4, h: 5, qty: 1, rate: 320 },
      { w: 4, h: 5, qty: 2, rate: 380 },
      { w: 4, h: 5, qty: 3, rate: 450 },
      { w: 4, h: 5, qty: 1, rate: 1800 },
      { w: 4, h: 5, qty: 2, rate: 4000 },
      { w: 4, h: 5, qty: 3, rate: 320 },
      { w: 4, h: 5, qty: 1, rate: 380 },
      { w: 4, h: 5, qty: 2, rate: 450 },
      { w: 4, h: 5, qty: 3, rate: 1800 },
      { w: 4, h: 5, qty: 1, rate: 4000 },
      { w: 4, h: 5, qty: 2, rate: 320 },
      { w: 4, h: 5, qty: 3, rate: 380 },
      { w: 4, h: 5, qty: 1, rate: 450 },
      { w: 4, h: 5, qty: 2, rate: 1800 },
    ].map((i) =>
      computeItem({
        billedWidthFt: i.w,
        billedHeightFt: i.h,
        qty: i.qty,
        pricingMode: "per_sqft",
        rate: i.rate,
      })
    );

    const totalArea = items.reduce((s, i) => s + i.totalAreaSqft, 0);
    expect(totalArea).toBe(540);

    const totals = computeTotals(items, 18, 2500);
    expect(totals.subtotal).toBe(594000);
    expect(totals.cgst).toBe(53460);
    expect(totals.sgst).toBe(53460);
    expect(totals.transportation).toBe(2500);
    expect(totals.grandTotal).toBe(703420);

    // The payment schedule printed on that document must reconcile to it.
    const stages = computePaymentStages(
      ["50% advance.", "30% before dispatch.", "20% after installation."],
      totals.grandTotal
    );
    expect(stages.reduce((s, x) => s + (x.amount ?? 0), 0)).toBe(totals.grandTotal);
  });
});
