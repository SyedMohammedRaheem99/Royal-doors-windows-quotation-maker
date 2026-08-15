import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { quotations as quotationsCollection } from "./collections";
import { canAccessOwned, ownershipFilter, type Actor } from "./authz";
import { nextInvoiceNo } from "./numbering";
import { loadQuotationFor, type Page, type Result } from "./quotations";
import { SETTINGS_DEFAULTS } from "./settingsMigration";
import type { Invoice, InvoiceInput, InvoiceLine, Settings } from "@/models/schemas";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

async function invoicesCollection() {
  const db = await getDb();
  return db.collection<Omit<Invoice, "_id">>("invoices");
}

/**
 * Splits an inclusive-of-tax or exclusive-of-tax quotation into the taxable
 * value and tax components an invoice must show separately.
 *
 * A quotation's totals already separate these, so this is mostly a
 * re-projection — but it recomputes rather than copying, for the same reason
 * lib/quotations.ts does: a stored tax figure that drifts from its own
 * taxable value is exactly the bug found in the reference data.
 */
export function computeInvoiceTotals(
  taxableValue: number,
  gstRate: number,
  transportation: number,
  supplyType: "intra_state" | "inter_state"
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalTax = taxableValue * (gstRate / 100);

  const cgst = supplyType === "intra_state" ? round2(totalTax / 2) : 0;
  const sgst = supplyType === "intra_state" ? round2(totalTax / 2) : 0;
  const igst = supplyType === "inter_state" ? round2(totalTax) : 0;

  const exact = taxableValue + totalTax + transportation;
  const grandTotal = Math.round(exact);

  return {
    taxableValue: round2(taxableValue),
    cgst,
    sgst,
    igst,
    transportation,
    grandTotal,
    roundOff: round2(grandTotal - exact),
  };
}

/**
 * Raises a GST tax invoice from an approved quotation.
 *
 * Guarded three ways, because an invoice is a legal document rather than an
 * internal record:
 *  - only an APPROVED quotation can be invoiced;
 *  - only one invoice per quotation (invoiceId acts as the lock);
 *  - the seller must have a GSTIN configured, since a tax invoice without
 *    one isn't a valid tax invoice.
 */
export async function createInvoiceFromQuotation(
  quotationId: string,
  input: InvoiceInput,
  actor: Actor
): Promise<Result<{ id: string; invoiceNo: string }>> {
  const loaded = await loadQuotationFor(quotationId, actor);
  if (!loaded.ok) return loaded;
  const quotation = loaded.data;

  if (quotation.status !== "approved") {
    return fail("Only an approved quotation can be invoiced.");
  }
  if (quotation.invoiceId) {
    return fail("This quotation has already been invoiced.");
  }
  if (!quotation.gst.enabled) {
    return fail("This quotation has GST turned off — a tax invoice needs GST applied.");
  }

  const db = await getDb();
  const settings = (await db.collection("settings").findOne({})) as Settings | null;
  if (!settings) return fail("Settings not found — run the seed script first.");
  if (!settings.gstin?.trim()) {
    return fail("Add your company GSTIN in Settings before raising a tax invoice.");
  }

  const sellerStateCode = settings.stateCode ?? "29";
  const buyerStateCode = input.buyer.stateCode?.trim() || sellerStateCode;
  const supplyType = buyerStateCode === sellerStateCode ? "intra_state" : "inter_state";

  const lines: InvoiceLine[] = quotation.items.map((item) => ({
    id: item.id,
    description: item.description,
    hsnSac: input.hsnSac,
    quantity: item.pricingMode === "per_sqft" ? item.totalAreaSqft : item.qty,
    unit: item.pricingMode === "per_sqft" ? "sqft" : "nos",
    rate: item.rate,
    amount: item.amount,
  }));

  const totals = computeInvoiceTotals(
    quotation.totals.subtotal,
    quotation.gst.rate,
    quotation.totals.transportation,
    supplyType
  );

  const now = new Date();
  const invoiceNo = await nextInvoiceNo();
  const col = await invoicesCollection();

  const result = await col.insertOne({
    invoiceNo,
    date: now,
    quotationId,
    quoteNo: quotation.quoteNo,
    buyer: input.buyer,
    lines,
    gstRate: quotation.gst.rate,
    supplyType,
    totals,
    vehicleNo: input.vehicleNo,
    // Fall back rather than storing an empty declaration: a tax invoice
    // without one is incomplete, and settings seeded before this field
    // existed would otherwise silently produce blank ones (see
    // lib/settingsMigration.ts).
    declaration: settings.invoiceDeclaration?.trim() || SETTINGS_DEFAULTS.invoiceDeclaration as string,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  const invoiceId = result.insertedId.toString();

  // Link it back so the quotation can't be invoiced twice.
  const quotationsCol = await quotationsCollection();
  await quotationsCol.updateOne(
    { _id: new ObjectId(quotationId) },
    { $set: { invoiceId, updatedAt: now } }
  );

  return ok({ id: invoiceId, invoiceNo });
}

export async function loadInvoiceFor(id: string, actor: Actor): Promise<Result<Invoice>> {
  if (!ObjectId.isValid(id)) return fail("Invoice not found.");

  const col = await invoicesCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return fail("Invoice not found.");
  if (!canAccessOwned(actor, doc.createdBy)) return fail("Invoice not found.");

  return ok({ ...doc, _id: doc._id.toString() } as Invoice);
}

export const INVOICES_PAGE_SIZE = 25;

export async function listInvoicesFor(
  actor: Actor,
  opts: { search?: string; page?: number } = {}
): Promise<Page<Invoice>> {
  const col = await invoicesCollection();
  const filter: Record<string, unknown> = { ...ownershipFilter(actor) };

  if (opts.search) {
    const re = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ invoiceNo: re }, { quoteNo: re }, { "buyer.name": re }];
  }

  const page = Math.max(1, opts.page ?? 1);
  const rows = await col
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * INVOICES_PAGE_SIZE)
    .limit(INVOICES_PAGE_SIZE + 1)
    .toArray();

  return {
    items: rows.slice(0, INVOICES_PAGE_SIZE).map((d) => ({ ...d, _id: d._id.toString() }) as Invoice),
    hasMore: rows.length > INVOICES_PAGE_SIZE,
    page,
  };
}

/** Aggregates lines by HSN/SAC for the summary table a GST invoice must carry. */
export function hsnSummary(invoice: Invoice) {
  const byHsn = new Map<string, number>();
  for (const line of invoice.lines) {
    byHsn.set(line.hsnSac, (byHsn.get(line.hsnSac) ?? 0) + line.amount);
  }

  const halfRate = invoice.supplyType === "intra_state" ? invoice.gstRate / 2 : 0;

  return Array.from(byHsn.entries()).map(([hsnSac, taxableValue]) => ({
    hsnSac,
    taxableValue: Math.round(taxableValue * 100) / 100,
    centralRate: halfRate,
    centralAmount: Math.round(taxableValue * (halfRate / 100) * 100) / 100,
    stateRate: halfRate,
    stateAmount: Math.round(taxableValue * (halfRate / 100) * 100) / 100,
    igstRate: invoice.supplyType === "inter_state" ? invoice.gstRate : 0,
    igstAmount:
      invoice.supplyType === "inter_state"
        ? Math.round(taxableValue * (invoice.gstRate / 100) * 100) / 100
        : 0,
    totalTax: Math.round(taxableValue * (invoice.gstRate / 100) * 100) / 100,
  }));
}
