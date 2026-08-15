import type { Payment, PaymentScheme } from "@/models/schemas";

/**
 * Payment arithmetic, kept pure and separate from persistence — same
 * discipline as lib/pricing.ts. Money is never computed inline in a
 * component or a route handler.
 */

export interface PaymentSummary {
  received: number;
  balance: number;
  /** 0–1; capped at 1 so an overpayment doesn't render a >100% bar. */
  progress: number;
  isFullyPaid: boolean;
  /** Positive when the customer has paid more than the quotation total. */
  overpaidBy: number;
}

export function summarisePayments(payments: Payment[], grandTotal: number): PaymentSummary {
  const received = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  const balance = round2(grandTotal - received);

  return {
    received,
    balance,
    progress: grandTotal > 0 ? Math.min(1, received / grandTotal) : 0,
    // Treat "within one rupee" as settled — a quotation total can carry a
    // rounding remainder that a customer would never pay separately.
    isFullyPaid: balance <= 1,
    overpaidBy: balance < 0 ? Math.abs(balance) : 0,
  };
}

export interface PaymentStage {
  label: string;
  /** The stage's share of the total, e.g. 0.6 for "60% advance." */
  fraction: number;
  amount: number;
  /** True once cumulative receipts cover this stage. */
  covered: boolean;
}

/**
 * Maps the quotation's chosen payment scheme ("60% advance. 30% before
 * dispatch. 10% after installation.") onto rupee amounts and marks which
 * stages the receipts so far have covered — so a salesperson can see
 * "advance received, dispatch payment outstanding" rather than doing the
 * percentage arithmetic in their head.
 *
 * Returns [] when the scheme has no parseable percentages (e.g. the
 * "100% payment for amount less than 20,000/-" variant), rather than
 * guessing.
 */
export function paymentStages(
  scheme: PaymentScheme | undefined,
  grandTotal: number,
  received: number
): PaymentStage[] {
  if (!scheme) return [];

  const stages: PaymentStage[] = [];
  let cumulative = 0;

  for (const step of scheme.steps) {
    const match = step.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!match) continue; // e.g. the validity line, or a non-percentage scheme
    const fraction = Number(match[1]) / 100;
    const amount = round2(grandTotal * fraction);
    cumulative = round2(cumulative + amount);
    stages.push({
      label: step,
      fraction,
      amount,
      covered: received + 1 >= cumulative, // same one-rupee tolerance as above
    });
  }

  return stages;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
