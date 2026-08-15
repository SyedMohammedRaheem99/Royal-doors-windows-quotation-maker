import type { Db } from "mongodb";

/**
 * Backfills settings fields added after a deployment was first seeded.
 *
 * scripts/seed.ts deliberately does NOT overwrite an existing settings
 * document — that would risk resetting the quote-number counter and
 * reissuing numbers. The consequence is that any field added later is simply
 * absent on existing installations, which is how invoices first shipped with
 * a blank declaration: the field existed in the schema and the seed data,
 * but never reached a database seeded before it was written.
 *
 * This fills only fields that are missing ($setOnInsert semantics per field),
 * so it never clobbers a value an admin has deliberately changed. Safe to
 * re-run.
 */

export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  stateName: "Karnataka",
  stateCode: "29",
  defaultHsnSac: "3917",
  invoiceDeclaration:
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
};

export async function backfillSettings(db: Db): Promise<string[]> {
  const settings = await db.collection("settings").findOne({});
  if (!settings) return [];

  const missing: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const current = settings[key];
    if (current === undefined || current === null || current === "") {
      missing[key] = value;
    }
  }

  // invoiceNumbering is a nested block; treat it as one unit.
  if (!settings.invoiceNumbering) {
    const fy = settings.quoteNumbering?.financialYearLabel ?? currentIndianFinancialYearLabel();
    missing.invoiceNumbering = { prefix: "INV", financialYearLabel: fy, counter: 0 };
  }

  if (Object.keys(missing).length === 0) return [];

  await db.collection("settings").updateOne({}, { $set: missing });
  return Object.keys(missing);
}

function currentIndianFinancialYearLabel(date = new Date()): string {
  const year = date.getFullYear();
  const fyStartYear = date.getMonth() >= 3 ? year : year - 1;
  return `${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
}
