/**
 * Pure, browser-safe numbering helpers.
 * DO NOT import anything from ./db or any server-only module here.
 * These functions are safe to use in Client Components and print documents.
 */

/** "RDW/25-26/0042" — prefix + Indian financial year + zero-padded serial. */
export function formatQuoteNo(prefix: string, fyLabel: string, serial: number): string {
  return `${prefix}/${fyLabel}/${String(serial).padStart(4, "0")}`;
}

/** "INV/25-26/001" — invoices use a 3-digit serial, matching the reference Tally series. */
export function formatInvoiceNo(prefix: string, fyLabel: string, serial: number): string {
  return `${prefix}/${fyLabel}/${String(serial).padStart(3, "0")}`;
}

/** Revision numbers append as a suffix: RDW/25-26/0042-R1, -R2, ... */
export function withRevisionSuffix(quoteNo: string, revision: number): string {
  return revision > 0 ? `${quoteNo}-R${revision}` : quoteNo;
}
