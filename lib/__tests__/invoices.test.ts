import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, hsnSummary } from "../invoices";
import type { Invoice } from "@/models/schemas";

describe("computeInvoiceTotals", () => {
  it("splits GST into equal CGST and SGST for an intra-state supply", () => {
    // Karnataka -> Karnataka, 18% on ₹100,000
    const t = computeInvoiceTotals(100000, 18, 0, "intra_state");
    expect(t.cgst).toBe(9000);
    expect(t.sgst).toBe(9000);
    expect(t.igst).toBe(0);
    expect(t.grandTotal).toBe(118000);
  });

  it("uses IGST and no CGST/SGST for an inter-state supply", () => {
    // The reference invoices were all intra-state, but the IGST column
    // existed on the Tally template — a customer in another state must be
    // billed IGST, not a CGST/SGST split.
    const t = computeInvoiceTotals(100000, 18, 0, "inter_state");
    expect(t.igst).toBe(18000);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
    expect(t.grandTotal).toBe(118000);
  });

  it("adds transportation after tax and does not tax it", () => {
    // Matches the quotation behaviour and the reference documents.
    const t = computeInvoiceTotals(100000, 18, 1000, "intra_state");
    expect(t.cgst + t.sgst).toBe(18000); // tax on 100000 only
    expect(t.grandTotal).toBe(119000);
  });

  it("reproduces the Whitefield reference invoice exactly", () => {
    // 140 sqft x ₹300 = ₹42,000, +9% +9% -> ₹49,560
    const t = computeInvoiceTotals(42000, 18, 0, "intra_state");
    expect(t.taxableValue).toBe(42000);
    expect(t.cgst).toBe(3780);
    expect(t.sgst).toBe(3780);
    expect(t.grandTotal).toBe(49560);
  });

  it("reproduces the Richards reference invoice exactly", () => {
    // 55 sqft x ₹360 = ₹19,800 -> ₹23,364
    const t = computeInvoiceTotals(19800, 18, 0, "intra_state");
    expect(t.grandTotal).toBe(23364);
  });

  it("handles a zero-rated invoice without producing NaN", () => {
    const t = computeInvoiceTotals(50000, 0, 0, "intra_state");
    expect(t.cgst).toBe(0);
    expect(t.grandTotal).toBe(50000);
  });

  it("rounds the grand total once, at the end, and records the round-off", () => {
    // 9% of 12,345 is 1,111.05 per half; the total carries a fraction that
    // must be rounded exactly once rather than per-component.
    const t = computeInvoiceTotals(12345, 18, 0, "intra_state");
    expect(Number.isInteger(t.grandTotal)).toBe(true);
    expect(Math.abs(t.roundOff)).toBeLessThan(1);
  });
});

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceNo: "INV/25-26/001",
    date: new Date(),
    quotationId: "q1",
    quoteNo: "RDW/25-26/0001",
    buyer: { name: "Test", addressLines: [], gstin: "", stateName: "Karnataka", stateCode: "29" },
    lines: [
      { id: "1", description: "2 Track sliding window", hsnSac: "3917", quantity: 100, unit: "sqft", rate: 300, amount: 30000 },
      { id: "2", description: "Ventilator", hsnSac: "3917", quantity: 5, unit: "nos", rate: 1800, amount: 9000 },
    ],
    gstRate: 18,
    supplyType: "intra_state",
    totals: computeInvoiceTotals(39000, 18, 0, "intra_state"),
    vehicleNo: "",
    declaration: "",
    createdBy: "u1",
    ...overrides,
  };
}

describe("hsnSummary — the table a GST invoice must carry", () => {
  it("aggregates lines sharing an HSN code into one row", () => {
    const rows = hsnSummary(invoice());
    expect(rows).toHaveLength(1);
    expect(rows[0].hsnSac).toBe("3917");
    expect(rows[0].taxableValue).toBe(39000);
  });

  it("splits tax at half the rate each for an intra-state supply", () => {
    const rows = hsnSummary(invoice());
    expect(rows[0].centralRate).toBe(9);
    expect(rows[0].stateRate).toBe(9);
    expect(rows[0].centralAmount).toBe(3510); // 9% of 39,000
    expect(rows[0].stateAmount).toBe(3510);
    expect(rows[0].totalTax).toBe(7020);
  });

  it("reports IGST and zero CGST/SGST for an inter-state supply", () => {
    const rows = hsnSummary(invoice({ supplyType: "inter_state" }));
    expect(rows[0].igstRate).toBe(18);
    expect(rows[0].igstAmount).toBe(7020);
    expect(rows[0].centralAmount).toBe(0);
    expect(rows[0].stateAmount).toBe(0);
  });

  it("produces one row per distinct HSN code", () => {
    const rows = hsnSummary(
      invoice({
        lines: [
          { id: "1", description: "uPVC", hsnSac: "3917", quantity: 1, unit: "nos", rate: 1000, amount: 1000 },
          { id: "2", description: "Aluminium", hsnSac: "7610", quantity: 1, unit: "nos", rate: 2000, amount: 2000 },
        ],
      })
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.hsnSac).sort()).toEqual(["3917", "7610"]);
  });

  it("the summary's taxable values sum to the invoice's taxable value", () => {
    // If these ever disagree, the invoice contradicts its own summary table.
    const inv = invoice();
    const rows = hsnSummary(inv);
    const summed = rows.reduce((s, r) => s + r.taxableValue, 0);
    expect(summed).toBe(inv.totals.taxableValue);
  });
});
