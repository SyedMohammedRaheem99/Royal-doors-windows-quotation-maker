import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { quotations as quotationsCollection, type StoredQuotation } from "./collections";
import { canAccessOwned, ownershipFilter, type Actor } from "./authz";
import { findOrCreateCustomer } from "./customers";
import { nextQuoteNo } from "./numbering";
import { colorFlatSurcharge, computeItem, computeTotals, customAddonFlatTotal, effectiveRate } from "./pricing";
import {
  STATUS_TRANSITIONS,
  type Payment,
  type PaymentInput,
  type QuotationInput,
  type QuotationStatus,
  type StatusEvent,
} from "@/models/schemas";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

/** Shared by create/update/duplicate — never trust a client-sent amount, always derive it from billed dims + rate. */
function computeQuotationPricing(input: QuotationInput) {
  const computedItems = input.items.map((item) => {
    const computed = computeItem({
      billedWidthFt: item.billed.w,
      billedHeightFt: item.billed.h,
      qty: item.qty,
      pricingMode: item.pricingMode,
      // Per-sqft custom add-ons ride inside effectiveRate (so they scale with
      // area); flat ones are added once, after the rate maths, so they survive
      // on per_unit items too.
      rate: effectiveRate({ ...item, colour: item.specs.colour }),
      // A ventilator's colour surcharge is flat-per-unit, not per-sqft (see
      // colorFlatSurcharge()), so it rides alongside the custom-addon flat
      // total rather than inside effectiveRate() above.
      flatAddonTotal:
        customAddonFlatTotal(item.customAddons) +
        colorFlatSurcharge({
          colour: item.specs.colour,
          diagramType: item.diagram.type,
          fanPoint: item.diagram.fanPoint,
        }),
    });
    return { ...item, ...computed };
  });

  const totals = computeTotals(computedItems, input.gst.enabled ? input.gst.rate : 0, input.transportation);
  return { computedItems, totals };
}

/**
 * Loads a quotation and checks the actor is allowed to see it. Every read and
 * every mutation goes through this — a caller can't accidentally skip the
 * ownership check, because it can't get the document without passing one.
 * Returns the same "not found" error for missing and forbidden so a sales user
 * can't probe for the existence of other reps' quotations.
 */
export async function loadQuotationFor(id: string, actor: Actor): Promise<Result<StoredQuotation>> {
  if (!ObjectId.isValid(id)) return fail("Quotation not found.");

  const col = await quotationsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return fail("Quotation not found.");
  if (!canAccessOwned(actor, doc.createdBy)) return fail("Quotation not found.");

  return ok(doc);
}

export const QUOTATIONS_PAGE_SIZE = 25;

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  page: number;
}

export async function listQuotationsFor(
  actor: Actor,
  opts: { search?: string; status?: QuotationStatus; page?: number; pageSize?: number } = {}
): Promise<Page<StoredQuotation>> {
  const col = await quotationsCollection();
  const filter: Record<string, unknown> = { ...ownershipFilter(actor) };

  if (opts.status) filter.status = opts.status;
  if (opts.search) {
    // A regex can't use the createdBy_createdAt / createdAt_desc indexes
    // directly, but the ownership + status equality filters above narrow the
    // candidate set first, so this scans a bounded working set rather than
    // the whole collection — acceptable at this scale. See docs/archive/ROADMAP.md Phase 3.
    const re = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ quoteNo: re }, { "customer.name": re }, { "customer.project": re }];
  }

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? QUOTATIONS_PAGE_SIZE;

  // Fetch one extra row instead of a separate countDocuments() call — cheaper,
  // and "is there a next page" is all the UI actually needs to know.
  const rows = await col
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize + 1)
    .toArray();

  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize, page };
}

/** The single place a NEW quotation is ever created — see computeQuotationPricing for the anti-stale-GST discipline. */
export async function createQuotation(input: QuotationInput, userId: string) {
  const { computedItems, totals } = computeQuotationPricing(input);

  const db = await getDb();
  const customerId = await findOrCreateCustomer(db, input.customer, userId);
  const quoteNo = await nextQuoteNo();

  const now = new Date();
  const col = await quotationsCollection();
  const result = await col.insertOne({
    quoteNo,
    revision: 0,
    status: "draft",
    date: now,
    customer: input.customer,
    customerId,
    items: computedItems,
    transportation: input.transportation,
    gst: input.gst,
    totals,
    terms: input.terms,
    statusHistory: [],
    payments: [],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return { id: result.insertedId.toString(), quoteNo };
}

/**
 * Moves a quotation along its status workflow, recording who did it and when.
 * Rejects transitions that aren't in STATUS_TRANSITIONS rather than trusting
 * the caller — the buttons only offer valid ones, but a stale page or a direct
 * API call shouldn't be able to put a quotation into a nonsense state.
 */
export async function setQuotationStatus(
  id: string,
  to: QuotationStatus,
  actor: Actor
): Promise<Result<null>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;

  const from = loaded.data.status;
  if (from === to) return ok(null);

  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    return fail(`Cannot move a ${from} quotation to ${to}.`);
  }

  const event: StatusEvent = { from, to, at: new Date(), by: actor.id };
  const col = await quotationsCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: to, updatedAt: new Date() }, $push: { statusHistory: event } }
  );

  return ok(null);
}

/**
 * Edits an EXISTING quotation in place. If it's still a draft (never sent),
 * the edit is silent — no revision bump, since nothing external has seen it
 * yet. If it was already sent/approved/lost, editing means re-quoting: the
 * revision counter increments (quoteNo gets a fresh "-R1"/"-R2" suffix via
 * withRevisionSuffix at display time) and status resets to draft, since a
 * changed quote needs to go out again before it can be approved.
 */
export async function updateQuotation(
  id: string,
  input: QuotationInput,
  actor: Actor
): Promise<Result<{ id: string; quoteNo: string }>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;
  const existing = loaded.data;

  const { computedItems, totals } = computeQuotationPricing(input);
  const db = await getDb();
  const customerId = await findOrCreateCustomer(db, input.customer, actor.id);

  const wasSent = existing.status !== "draft";
  const revision = wasSent ? existing.revision + 1 : existing.revision;
  const status: QuotationStatus = wasSent ? "draft" : existing.status;
  const now = new Date();

  const $set = {
    customer: input.customer,
    customerId,
    items: computedItems,
    transportation: input.transportation,
    gst: input.gst,
    totals,
    terms: input.terms,
    revision,
    status,
    updatedAt: now,
  };

  const col = await quotationsCollection();
  if (wasSent) {
    // Editing an already-sent quotation is a re-quote: record the automatic
    // drop back to draft so the history explains the revision bump.
    const event: StatusEvent = { from: existing.status, to: "draft", at: now, by: actor.id };
    await col.updateOne({ _id: new ObjectId(id) }, { $set, $push: { statusHistory: event } });
  } else {
    await col.updateOne({ _id: new ObjectId(id) }, { $set });
  }

  return ok({ id, quoteNo: existing.quoteNo });
}

/**
 * Clones a quotation into a brand-new, independent document with its own
 * quote number — the "Jakkur Teak vs White" workflow found in the reference
 * data: same measurements, different rate tier, but two separate quotes a
 * customer can compare, not two versions of one.
 */
export async function duplicateQuotation(
  id: string,
  actor: Actor
): Promise<Result<{ id: string; quoteNo: string }>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;
  const source = loaded.data;

  const input: QuotationInput = {
    customer: source.customer,
    items: source.items.map((item) => ({
      id: crypto.randomUUID(),
      productType: item.productType,
      description: item.description,
      room: item.room ?? "",
      handing: item.handing,
      measuredMm: item.measuredMm,
      billed: item.billed,
      qty: item.qty,
      pricingMode: item.pricingMode,
      rate: item.rate,
      specs: item.specs,
      surcharges: item.surcharges,
      toughenedGlassMm: item.toughenedGlassMm,
      // Copied with fresh ids: a duplicate that dropped these would silently
      // under-price the new quotation against the one it was cloned from.
      customAddons: (item.customAddons ?? []).map((a) => ({ ...a, id: crypto.randomUUID() })),
      diagram: item.diagram,
      remarks: item.remarks,
    })),
    transportation: source.transportation,
    gst: source.gst,
    terms: source.terms,
  };

  // Payments are deliberately NOT copied: a duplicate is a new commercial
  // offer, and carrying the original's receipts across would misstate what
  // the customer owes on it.
  return ok(await createQuotation(input, actor.id));
}

/**
 * Records a payment against a quotation.
 *
 * Only meaningful once a quotation is approved — recording money against a
 * draft or lost quote is almost certainly a mistake, so it's rejected rather
 * than silently accepted. Goes through loadQuotationFor, so the same
 * ownership rules as every other mutation apply.
 */
export async function addPayment(
  id: string,
  input: PaymentInput,
  actor: Actor
): Promise<Result<Payment>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;
  const quotation = loaded.data;

  if (quotation.status !== "approved") {
    return fail("Payments can only be recorded against an approved quotation.");
  }

  const now = new Date();
  const payment: Payment = {
    id: crypto.randomUUID(),
    amount: input.amount,
    method: input.method,
    receivedAt: input.receivedAt,
    note: input.note,
    recordedBy: actor.id,
    recordedAt: now,
  };

  const col = await quotationsCollection();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $push: { payments: payment }, $set: { updatedAt: now } }
  );

  return ok(payment);
}

/** Removes a payment — for correcting a mis-keyed entry. */
export async function removePayment(
  id: string,
  paymentId: string,
  actor: Actor
): Promise<Result<null>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;

  const col = await quotationsCollection();
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $pull: { payments: { id: paymentId } }, $set: { updatedAt: new Date() } }
  );

  if (result.modifiedCount === 0) return fail("Payment not found.");
  return ok(null);
}
