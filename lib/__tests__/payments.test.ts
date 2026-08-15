import { describe, expect, it } from "vitest";
import { paymentStages, summarisePayments } from "../payments";
import type { Payment, PaymentScheme } from "@/models/schemas";

function payment(amount: number, overrides: Partial<Payment> = {}): Payment {
  return {
    id: crypto.randomUUID(),
    amount,
    method: "cash",
    receivedAt: new Date("2026-01-01"),
    note: "",
    recordedBy: "u1",
    recordedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("summarisePayments", () => {
  it("sums receipts and computes the outstanding balance", () => {
    const s = summarisePayments([payment(60000), payment(30000)], 100000);
    expect(s.received).toBe(90000);
    expect(s.balance).toBe(10000);
    expect(s.isFullyPaid).toBe(false);
  });

  it("reports a zero balance and full payment when settled exactly", () => {
    const s = summarisePayments([payment(100000)], 100000);
    expect(s.balance).toBe(0);
    expect(s.isFullyPaid).toBe(true);
    expect(s.progress).toBe(1);
  });

  it("treats a sub-rupee remainder as settled", () => {
    // Quotation totals can carry a rounding remainder no customer would
    // ever pay separately — chasing ₹0.40 is not a real receivable.
    const s = summarisePayments([payment(99999.6)], 100000);
    expect(s.isFullyPaid).toBe(true);
  });

  it("handles no payments at all", () => {
    const s = summarisePayments([], 50000);
    expect(s.received).toBe(0);
    expect(s.balance).toBe(50000);
    expect(s.progress).toBe(0);
    expect(s.isFullyPaid).toBe(false);
  });

  it("caps progress at 100% and reports the overpayment separately", () => {
    // An overpayment shouldn't render a >100% progress bar, but it also
    // must not be silently hidden — the business needs to see it.
    const s = summarisePayments([payment(120000)], 100000);
    expect(s.progress).toBe(1);
    expect(s.balance).toBe(-20000);
    expect(s.overpaidBy).toBe(20000);
    expect(s.isFullyPaid).toBe(true);
  });

  it("does not divide by zero on a zero-value quotation", () => {
    const s = summarisePayments([], 0);
    expect(s.progress).toBe(0);
    expect(Number.isFinite(s.progress)).toBe(true);
  });

  it("avoids floating-point drift across many small receipts", () => {
    const s = summarisePayments([payment(0.1), payment(0.2)], 0.3);
    expect(s.received).toBe(0.3); // not 0.30000000000000004
    expect(s.balance).toBe(0);
  });
});

describe("paymentStages — mapping the payment scheme onto rupees", () => {
  const sixtyThirtyTen: PaymentScheme = {
    label: "60 / 30 / 10",
    steps: ["60% advance.", "30% before dispatch.", "10% after installation."],
  };

  it("converts each percentage step into an amount", () => {
    const stages = paymentStages(sixtyThirtyTen, 100000, 0);
    expect(stages.map((s) => s.amount)).toEqual([60000, 30000, 10000]);
  });

  it("marks stages covered cumulatively, not individually", () => {
    // ₹60,000 received covers the advance only — not the dispatch stage,
    // even though 60,000 is larger than the 30,000 that stage is worth.
    const stages = paymentStages(sixtyThirtyTen, 100000, 60000);
    expect(stages.map((s) => s.covered)).toEqual([true, false, false]);
  });

  it("marks two stages covered once cumulative receipts reach 90%", () => {
    const stages = paymentStages(sixtyThirtyTen, 100000, 90000);
    expect(stages.map((s) => s.covered)).toEqual([true, true, false]);
  });

  it("marks every stage covered when fully paid", () => {
    const stages = paymentStages(sixtyThirtyTen, 100000, 100000);
    expect(stages.every((s) => s.covered)).toBe(true);
  });

  it("ignores non-percentage steps such as the validity line", () => {
    const scheme: PaymentScheme = {
      label: "70 / 30",
      steps: ["70% advance.", "30% after installation.", "This Invoice is valid for 5 days from the date."],
    };
    const stages = paymentStages(scheme, 10000, 0);
    expect(stages).toHaveLength(2);
    expect(stages.map((s) => s.amount)).toEqual([7000, 3000]);
  });

  it("returns nothing rather than guessing when a scheme has no percentages", () => {
    // The "100% payment for amount less than 20,000/-" variant in the
    // reference data is a rule, not a stage breakdown.
    const scheme: PaymentScheme = {
      label: "100% upfront (small jobs)",
      steps: ["100% payment for amount less than 20,000/-."],
    };
    const stages = paymentStages(scheme, 15000, 0);
    // "100%" IS a percentage, so this one does parse — a single full stage.
    expect(stages).toHaveLength(1);
    expect(stages[0].amount).toBe(15000);
  });

  it("returns an empty list when there is no scheme at all", () => {
    expect(paymentStages(undefined, 100000, 0)).toEqual([]);
  });
});
