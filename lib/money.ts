/**
 * Rupee formatting for anything a customer reads.
 *
 * Bare `toLocaleString("en-IN")` drops trailing zeros, so a real total of
 * 177677.50 printed as "₹1,77,677.5" — a single decimal place, which reads as
 * a broken number on a document that goes to a paying customer. Money on a
 * quotation or invoice always shows exactly two decimals.
 *
 * Display only. Never round with these — all money math lives in lib/pricing.ts.
 */

/** "1,77,677.50" — Indian digit grouping, always two decimals. */
export function formatAmount(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "₹1,77,677.50" */
export function formatINR(n: number): string {
  return `₹${formatAmount(n)}`;
}

/**
 * Whole-rupee variant for dense UI chrome (list rows, dashboard tiles) where
 * two decimals are noise rather than precision. Not for printed documents.
 */
export function formatINRCompact(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
