import { ObjectId, type Db } from "mongodb";
import { customers as customersCollection, quotations as quotationsCollection, type StoredCustomer, type StoredQuotation } from "./collections";
import { canAccessOwned, ownershipFilter, type Actor } from "./authz";
import type { CustomerSnapshot } from "@/models/schemas";
import type { Page } from "./quotations";

export const CUSTOMERS_PAGE_SIZE = 25;

/**
 * Finds a customer by case-insensitive exact name match and refreshes their
 * contact details, or inserts a new one.
 *
 * Scoped to `createdBy` — two different sales users quoting a same-named
 * customer must each get their own record. Without this, the lookup used to
 * match ANY user's customer by name alone: rep B saving a quotation for a
 * customer named the same as one of rep A's would silently overwrite rep A's
 * contact details and reassign that customerId to rep B's quotation, which
 * rep A could then no longer find on their own Customers page. Same class of
 * bug as the Phase 1 authorization gaps, just in a write path rather than a
 * read. Admins share one pool with each other and with no one else, since an
 * admin's quotations are visible to all sales users' ownership checks anyway.
 */
export async function findOrCreateCustomer(
  db: Db,
  data: CustomerSnapshot,
  createdBy: string
): Promise<string> {
  const customers = db.collection("customers");
  const name = data.name.trim();

  // Exact case-insensitive equality via collation, not a regex — this is the
  // one lookup that needs to be fast (it runs on every quotation save), and
  // it wants exact-match semantics anyway, not pattern matching. Matches the
  // "createdBy_name_collated" index in lib/indexes.ts.
  const existing = await customers.findOne(
    { name, createdBy },
    { collation: { locale: "en", strength: 2 } }
  );
  if (existing) {
    await customers.updateOne(
      { _id: existing._id },
      {
        $set: {
          phone: data.phone || existing.phone,
          siteAddress: data.siteAddress || existing.siteAddress,
          project: data.project || existing.project,
          referredBy: data.referredBy || existing.referredBy,
          gstin: data.gstin || existing.gstin,
        },
      }
    );
    return existing._id.toString();
  }

  const result = await customers.insertOne({
    name,
    phone: data.phone,
    siteAddress: data.siteAddress,
    project: data.project,
    referredBy: data.referredBy,
    gstin: data.gstin,
    createdBy,
    createdAt: new Date(),
  });
  return result.insertedId.toString();
}

/**
 * Customers a given actor may see. Admins see all; a sales user sees only the
 * ones they created — previously this list was unscoped, exposing every
 * customer in the business to every login.
 */
export async function listCustomersFor(
  actor: Actor,
  opts: { search?: string; page?: number; pageSize?: number } = {}
): Promise<Page<StoredCustomer>> {
  const col = await customersCollection();
  const filter: Record<string, unknown> = { ...ownershipFilter(actor) };

  if (opts.search) {
    filter.name = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? CUSTOMERS_PAGE_SIZE;

  const rows = await col
    .find(filter)
    .sort({ name: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize + 1)
    .toArray();

  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize, page };
}

/**
 * A customer plus the quotations of theirs this actor may see. Both halves are
 * scoped: a sales user viewing a shared customer must not see another rep's
 * quotation values for them.
 */
export async function loadCustomerWithHistory(
  id: string,
  actor: Actor
): Promise<{ customer: StoredCustomer; quotations: StoredQuotation[] } | null> {
  if (!ObjectId.isValid(id)) return null;

  const col = await customersCollection();
  const customer = await col.findOne({ _id: new ObjectId(id) });
  if (!customer) return null;
  if (!canAccessOwned(actor, customer.createdBy)) return null;

  const quotationsCol = await quotationsCollection();
  const history = await quotationsCol
    .find({ customerId: id, ...ownershipFilter(actor) })
    .sort({ createdAt: -1 })
    .toArray();

  return { customer, quotations: history };
}
