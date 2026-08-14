import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { findOrCreateCustomer } from "./customers";
import { nextQuoteNo } from "./numbering";
import { computeItem, computeTotals, SURCHARGES } from "./pricing";
import type { Quotation, QuotationInput } from "@/models/schemas";

/** Shared by create/update/duplicate — never trust a client-sent amount, always derive it from billed dims + rate. */
function computeQuotationPricing(input: QuotationInput) {
  const computedItems = input.items.map((item) => {
    const surchargeSum =
      item.pricingMode === "per_sqft"
        ? item.surcharges.reduce((sum, key) => sum + (SURCHARGES[key as keyof typeof SURCHARGES] ?? 0), 0)
        : 0;
    const effectiveRate = item.rate + surchargeSum;
    const computed = computeItem({
      billedWidthFt: item.billed.w,
      billedHeightFt: item.billed.h,
      qty: item.qty,
      pricingMode: item.pricingMode,
      rate: effectiveRate,
    });
    return { ...item, ...computed };
  });

  const totals = computeTotals(computedItems, input.gst.enabled ? input.gst.rate : 0, input.transportation);
  return { computedItems, totals };
}

/** The single place a NEW quotation is ever created — see computeQuotationPricing for the anti-stale-GST discipline. */
export async function createQuotation(input: QuotationInput, userId: string) {
  const { computedItems, totals } = computeQuotationPricing(input);

  const db = await getDb();
  const customerId = await findOrCreateCustomer(db, input.customer, userId);
  const quoteNo = await nextQuoteNo();

  const now = new Date();
  const doc = {
    quoteNo,
    revision: 0,
    status: "draft" as const,
    date: now,
    customer: input.customer,
    customerId,
    items: computedItems,
    transportation: input.transportation,
    gst: input.gst,
    totals,
    terms: input.terms,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("quotations").insertOne(doc);
  return { id: result.insertedId.toString(), quoteNo };
}

export async function getQuotationById(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection("quotations").findOne({ _id: new ObjectId(id) });
}

/**
 * Edits an EXISTING quotation in place. If it's still a draft (never sent),
 * the edit is silent — no revision bump, since nothing external has seen it
 * yet. If it was already sent/approved/lost, editing means re-quoting: the
 * revision counter increments (quoteNo gets a fresh "-R1"/"-R2" suffix via
 * withRevisionSuffix at display time) and status resets to draft, since a
 * changed quote needs to go out again before it can be approved.
 */
export async function updateQuotation(id: string, input: QuotationInput, userId: string) {
  const db = await getDb();
  const existing = await db.collection("quotations").findOne({ _id: new ObjectId(id) });
  if (!existing) throw new Error("Quotation not found");

  const { computedItems, totals } = computeQuotationPricing(input);
  const customerId = await findOrCreateCustomer(db, input.customer, userId);

  const wasSent = existing.status !== "draft";
  const revision = wasSent ? (existing.revision ?? 0) + 1 : (existing.revision ?? 0);
  const status = wasSent ? "draft" : existing.status;

  await db.collection("quotations").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        customer: input.customer,
        customerId,
        items: computedItems,
        transportation: input.transportation,
        gst: input.gst,
        totals,
        terms: input.terms,
        revision,
        status,
        updatedAt: new Date(),
      },
    }
  );

  return { id, quoteNo: existing.quoteNo as string };
}

/**
 * Clones a quotation into a brand-new, independent document with its own
 * quote number — the "Jakkur Teak vs White" workflow found in the reference
 * data: same measurements, different rate tier, but two separate quotes a
 * customer can compare, not two versions of one.
 */
export async function duplicateQuotation(id: string, userId: string) {
  const source = await getQuotationById(id);
  if (!source) throw new Error("Quotation not found");

  const input: QuotationInput = {
    customer: source.customer,
    items: source.items.map((item: Quotation["items"][number]) => ({
      id: crypto.randomUUID(),
      productType: item.productType,
      description: item.description,
      handing: item.handing,
      measuredMm: item.measuredMm,
      billed: item.billed,
      qty: item.qty,
      pricingMode: item.pricingMode,
      rate: item.rate,
      specs: item.specs,
      surcharges: item.surcharges,
      diagram: item.diagram,
      remarks: item.remarks,
    })),
    transportation: source.transportation,
    gst: source.gst,
    terms: source.terms,
  };

  return createQuotation(input, userId);
}
