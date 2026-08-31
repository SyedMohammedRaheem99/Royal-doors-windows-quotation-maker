/**
 * Server-side numbering helpers that touch the database.
 * DO NOT import this file in Client Components or print documents.
 * For browser-safe pure helpers, use ./numbering-pure instead.
 */
export { formatQuoteNo, formatInvoiceNo, withRevisionSuffix } from "./numbering-pure";

/**
 * Atomically increments the settings counter and returns the next quote
 * number. Uses findOneAndUpdate's $inc so concurrent requests from two
 * salespeople can never be handed the same serial.
 */
export async function nextQuoteNo(): Promise<string> {
  const { getDb } = await import("./db");
  const db = await getDb();
  const { formatQuoteNo } = await import("./numbering-pure");
  const settings = await db.collection("settings").findOneAndUpdate(
    {},
    { $inc: { "quoteNumbering.counter": 1 } },
    { returnDocument: "after" }
  );

  if (!settings) {
    throw new Error("Settings document not found — run the seed script first.");
  }

  const { prefix, financialYearLabel, counter } = settings.quoteNumbering;
  return formatQuoteNo(prefix, financialYearLabel, counter);
}

function currentIndianFinancialYearLabel(date = new Date()): string {
  const year = date.getFullYear();
  const fyStartYear = date.getMonth() >= 3 ? year : year - 1; // April onwards
  return `${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
}

/**
 * Atomically increments the INVOICE counter, which is separate from the
 * quotation counter — GST expects a continuous invoice series, and the
 * reference Tally invoices numbered independently of any quote number.
 *
 * Upserts the invoiceNumbering block on first use so existing installations
 * seeded before invoicing existed don't need a re-seed.
 */
export async function nextInvoiceNo(): Promise<string> {
  const { getDb } = await import("./db");
  const db = await getDb();
  const { formatInvoiceNo } = await import("./numbering-pure");
  const settings = await db.collection("settings").findOneAndUpdate(
    {},
    {
      $inc: { "invoiceNumbering.counter": 1 },
      $setOnInsert: {},
    },
    { returnDocument: "after" }
  );

  if (!settings) {
    throw new Error("Settings document not found — run the seed script first.");
  }

  const numbering = settings.invoiceNumbering ?? {};
  const prefix = numbering.prefix ?? "INV";
  const fyLabel = numbering.financialYearLabel ?? currentIndianFinancialYearLabel();
  const counter = numbering.counter ?? 1;

  // Backfill prefix/FY if this was the first invoice on a pre-existing
  // settings document, so subsequent reads are consistent.
  if (!numbering.prefix || !numbering.financialYearLabel) {
    await db
      .collection("settings")
      .updateOne({}, { $set: { "invoiceNumbering.prefix": prefix, "invoiceNumbering.financialYearLabel": fyLabel } });
  }

  return formatInvoiceNo(prefix, fyLabel, counter);
}
