import type { Db } from "mongodb";
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
