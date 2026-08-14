import { describe, expect, it } from "vitest";
import { computeItem, computeTotals } from "../pricing";
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
