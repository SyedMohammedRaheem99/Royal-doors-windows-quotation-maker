import { getDb } from "./db";

/** "RDW/25-26/0042" — prefix + Indian financial year + zero-padded serial. */
export function formatQuoteNo(prefix: string, fyLabel: string, serial: number): string {
  return `${prefix}/${fyLabel}/${String(serial).padStart(4, "0")}`;
}

/**
 * Atomically increments the settings counter and returns the next quote
 * number. Uses findOneAndUpdate's $inc so concurrent requests from two
 * salespeople can never be handed the same serial.
 */
export async function nextQuoteNo(): Promise<string> {
  const db = await getDb();
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

/** Revision numbers append as a suffix: RDW/25-26/0042-R1, -R2, ... */
export function withRevisionSuffix(quoteNo: string, revision: number): string {
  return revision > 0 ? `${quoteNo}-R${revision}` : quoteNo;
}
