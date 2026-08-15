import type { Db, IndexDescription } from "mongodb";

/**
 * The full set of indexes this app depends on for correctness and
 * performance. Defined once here so scripts/migrate.mjs (which creates them)
 * and anything that wants to reason about query performance share a single
 * source of truth.
 *
 * Every index has an explicit `name` so re-running the migration is safe:
 * MongoDB's createIndexes no-ops when an index with the same name and spec
 * already exists, and errors clearly (rather than silently drifting) if the
 * spec ever changes under the same name.
 */

export const QUOTATION_INDEXES: IndexDescription[] = [
  {
    // Data-integrity backstop for nextQuoteNo()'s atomic counter — a unique
    // index means a race condition or bug can produce a 500, never two
    // quotations silently sharing a number.
    key: { quoteNo: 1 },
    name: "quoteNo_unique",
    unique: true,
  },
  {
    // Serves listQuotationsFor's ownership-filtered, newest-first list for a
    // sales user — the hot path on the Quotations page and the dashboard.
    key: { createdBy: 1, createdAt: -1 },
    name: "createdBy_createdAt",
  },
  {
    // Serves the same list for an admin, who has no createdBy filter — a
    // compound index with createdBy leading can't serve a createdAt-only
    // sort efficiently, so this covers that case separately.
    key: { createdAt: -1 },
    name: "createdAt_desc",
  },
  {
    // Serves loadCustomerWithHistory: customerId equality narrows first
    // (typically to a handful of documents), then createdAt sorts them.
    key: { customerId: 1, createdAt: -1 },
    name: "customerId_createdAt",
  },
  {
    // Serves the status filter on the Quotations list.
    key: { status: 1 },
    name: "status",
  },
];

export const CUSTOMER_INDEXES: IndexDescription[] = [
  {
    // Serves listCustomersFor's ownership filter + name sort.
    key: { createdBy: 1, name: 1 },
    name: "createdBy_name",
  },
  {
    // A case-insensitive COLLATION index, distinct from the plain one above:
    // findOrCreateCustomer does an exact (not regex) match on name scoped to
    // createdBy, and only queries that explicitly request this same
    // collation can use it — so it's kept separate rather than merged.
    key: { createdBy: 1, name: 1 },
    name: "createdBy_name_collated",
    collation: { locale: "en", strength: 2 },
  },
];

export const INVOICE_INDEXES: IndexDescription[] = [
  {
    // GST requires a continuous, non-duplicated invoice series — this is a
    // legal correctness constraint, not just a performance index.
    key: { invoiceNo: 1 },
    name: "invoiceNo_unique",
    unique: true,
  },
  {
    // One invoice per quotation. The quotation's invoiceId is the primary
    // guard; this backstops it against a race between two concurrent raises.
    key: { quotationId: 1 },
    name: "quotationId_unique",
    unique: true,
  },
  {
    key: { createdBy: 1, createdAt: -1 },
    name: "createdBy_createdAt",
  },
];

export const USER_INDEXES: IndexDescription[] = [
  {
    // Auth looks up by email on every login; must also be unique — two users
    // with the same email would make login ambiguous.
    key: { email: 1 },
    name: "email_unique",
    unique: true,
  },
];

export const RATE_CARD_INDEXES: IndexDescription[] = [
  {
    // The rate master is upserted by productType (scripts/seed.ts,
    // lib/rateCard.ts) and looked up the same way when pricing an item.
    key: { productType: 1 },
    name: "productType_unique",
    unique: true,
  },
];

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("quotations").createIndexes(QUOTATION_INDEXES);
  await db.collection("customers").createIndexes(CUSTOMER_INDEXES);
  await db.collection("invoices").createIndexes(INVOICE_INDEXES);
  await db.collection("users").createIndexes(USER_INDEXES);
  await db.collection("rateCard").createIndexes(RATE_CARD_INDEXES);
}
