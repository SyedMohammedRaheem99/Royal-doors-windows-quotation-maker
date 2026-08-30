import { getDb } from "./db";
import { rateCard as rateCardCollection } from "./collections";
import { canManageSettings, type Actor } from "./authz";
import type { Result } from "./quotations";
import type { RateCardEntry, RateCardInput, RateChange } from "@/models/schemas";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

async function rateChangesCollection() {
  const db = await getDb();
  return db.collection<Omit<RateChange, "_id">>("rateChanges");
}

/**
 * Records what a rate was, what it became, and who changed it.
 *
 * Rates are the most commercially sensitive number here — the reference
 * workbooks had the same product quoted from ₹270 to ₹350 with no record of
 * why. Every write path below logs through this.
 */
async function recordRateChange(entry: Omit<RateChange, "_id" | "changedAt">) {
  const col = await rateChangesCollection();
  await col.insertOne({ ...entry, changedAt: new Date() });
}

/** Applies default-rate edits from the rate master screen, logging each one. */
export async function updateRates(
  updates: Array<{ productType: string; defaultRate: number }>,
  actor: Actor,
  actorName = ""
): Promise<Result<number>> {
  if (!canManageSettings(actor)) return fail("You do not have permission to change rates.");

  const col = await rateCardCollection();
  let applied = 0;

  for (const update of updates) {
    const existing = await col.findOne({ productType: update.productType });
    if (!existing) continue;
    if (existing.defaultRate === update.defaultRate) continue;

    await col.updateOne(
      { productType: update.productType },
      { $set: { defaultRate: update.defaultRate } }
    );
    await recordRateChange({
      productType: update.productType,
      label: existing.label,
      from: existing.defaultRate,
      to: update.defaultRate,
      changedBy: actor.id,
      changedByName: actorName,
      bulkReason: "",
    });
    applied += 1;
  }

  return ok(applied);
}

/**
 * Raises or lowers every rate in a category (or all of them) by a
 * percentage — the "annual price revision" case, which is otherwise 30
 * separate edits and easy to get half-done.
 *
 * Rounds to the nearest rupee: the reference data has no sub-rupee rates,
 * and a rate of ₹318.5 would only produce odd-looking quotation totals.
 */
export async function bulkAdjustRates(
  opts: { category?: RateCardEntry["category"]; percent: number; reason: string },
  actor: Actor,
  actorName = ""
): Promise<Result<number>> {
  if (!canManageSettings(actor)) return fail("You do not have permission to change rates.");
  if (!Number.isFinite(opts.percent) || opts.percent === 0) {
    return fail("Enter a non-zero percentage.");
  }
  if (opts.percent < -90 || opts.percent > 200) {
    // A guard against a mistyped figure wiping out or inflating the whole
    // rate card in one click.
    return fail("Percentage must be between -90% and +200%.");
  }

  const col = await rateCardCollection();
  const filter = opts.category ? { category: opts.category, active: true } : { active: true };
  const entries = await col.find(filter).toArray();

  let applied = 0;
  for (const entry of entries) {
    const next = Math.round(entry.defaultRate * (1 + opts.percent / 100));
    if (next === entry.defaultRate) continue;

    await col.updateOne({ productType: entry.productType }, { $set: { defaultRate: next } });
    await recordRateChange({
      productType: entry.productType,
      label: entry.label,
      from: entry.defaultRate,
      to: next,
      changedBy: actor.id,
      changedByName: actorName,
      bulkReason: opts.reason || `Bulk ${opts.percent > 0 ? "+" : ""}${opts.percent}%`,
    });
    applied += 1;
  }

  return ok(applied);
}

export async function createRateCardEntry(
  input: RateCardInput,
  actor: Actor,
  actorName = ""
): Promise<Result<null>> {
  if (!canManageSettings(actor)) return fail("You do not have permission to add products.");

  const col = await rateCardCollection();
  const clash = await col.findOne({ productType: input.productType });
  if (clash) return fail(`A product with the code "${input.productType}" already exists.`);

  await col.insertOne({
    ...input,
    // Spec options are inherited from an existing product in the same
    // category rather than left empty, so a new product immediately offers
    // the same glass/colour/mesh choices the builder expects.
    specOptions: await inheritSpecOptions(input.category),
  });

  await recordRateChange({
    productType: input.productType,
    label: input.label,
    from: 0,
    to: input.defaultRate,
    changedBy: actor.id,
    changedByName: actorName,
    bulkReason: "Product created",
  });

  return ok(null);
}

export async function updateRateCardEntry(
  productType: string,
  input: RateCardInput,
  actor: Actor,
  actorName = ""
): Promise<Result<null>> {
  if (!canManageSettings(actor)) return fail("You do not have permission to edit products.");

  const col = await rateCardCollection();
  const existing = await col.findOne({ productType });
  if (!existing) return fail("Product not found.");

  // productType is intentionally excluded from the update: it's the key
  // quotations reference, so changing it would orphan them. Everything else
  // is editable.
  const editable = {
    label: input.label,
    category: input.category,
    pricingMode: input.pricingMode,
    defaultRate: input.defaultRate,
    minRate: input.minRate,
    maxRate: input.maxRate,
    diagramType: input.diagramType,
    active: input.active,
  };
  await col.updateOne({ productType }, { $set: editable });

  if (existing.defaultRate !== input.defaultRate) {
    await recordRateChange({
      productType,
      label: input.label,
      from: existing.defaultRate,
      to: input.defaultRate,
      changedBy: actor.id,
      changedByName: actorName,
      bulkReason: "",
    });
  }

  return ok(null);
}

/**
 * Retires a product instead of deleting it.
 *
 * Deleting would break the rate master's link to historical quotations that
 * were priced from it. Retired products stop appearing in the builder but
 * stay resolvable for anything already quoted.
 */
export async function setRateCardActive(
  productType: string,
  active: boolean,
  actor: Actor
): Promise<Result<null>> {
  if (!canManageSettings(actor)) return fail("You do not have permission to retire products.");

  const col = await rateCardCollection();
  const result = await col.updateOne({ productType }, { $set: { active } });
  if (result.matchedCount === 0) return fail("Product not found.");

  return ok(null);
}

export async function listRateChanges(actor: Actor, limit = 100): Promise<RateChange[]> {
  if (!canManageSettings(actor)) return [];

  const col = await rateChangesCollection();
  const rows = await col.find({}).sort({ changedAt: -1 }).limit(limit).toArray();
  return rows.map((r) => ({ ...r, _id: r._id.toString() }) as RateChange);
}

/** Copies spec options from an existing product in the same category. */
async function inheritSpecOptions(category: RateCardEntry["category"]) {
  const col = await rateCardCollection();
  const sibling = await col.findOne({ category });
  return sibling?.specOptions ?? { profiles: [], colours: [], glass: [], mesh: [] };
}
