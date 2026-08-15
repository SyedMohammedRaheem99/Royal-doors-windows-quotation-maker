import { ObjectId, type Db } from "mongodb";
import { customers as customersCollection, quotations as quotationsCollection, type StoredCustomer, type StoredQuotation } from "./collections";
import { canAccessOwned, ownershipFilter, type Actor } from "./authz";
import type { CustomerSnapshot } from "@/models/schemas";

/**
 * Finds a customer by case-insensitive exact name match and refreshes their
 * contact details, or inserts a new one. Used both by the standalone
 * customers API and when saving a quotation, so the searchable customer
 * list stays populated without a separate "create customer" step getting in
 * the salesperson's way.
 */
export async function findOrCreateCustomer(
  db: Db,
  data: CustomerSnapshot,
  createdBy: string
): Promise<string> {
  const customers = db.collection("customers");
  const nameRegex = new RegExp(`^${data.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const existing = await customers.findOne({ name: nameRegex });
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
    name: data.name.trim(),
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
  opts: { search?: string; limit?: number } = {}
): Promise<StoredCustomer[]> {
  const col = await customersCollection();
  const filter: Record<string, unknown> = { ...ownershipFilter(actor) };

  if (opts.search) {
    filter.name = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }

  return col
    .find(filter)
    .sort({ name: 1 })
    .limit(opts.limit ?? 200)
    .toArray();
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
