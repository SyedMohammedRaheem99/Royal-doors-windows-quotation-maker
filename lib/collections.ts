import type { Collection, Document, OptionalId, WithId } from "mongodb";
import { getDb } from "./db";
import type { Customer, Quotation, RateCardEntry, Settings, User } from "@/models/schemas";

/**
 * Typed accessors for each collection.
 *
 * Calling `db.collection("quotations")` returns `Collection<Document>`, which
 * types every field as `any` — update operators like `$push` then fail to
 * resolve, and a typo in a field name is invisible. These wrappers bind the
 * document type once so queries and updates are checked.
 *
 * The stored shape differs slightly from the Zod types: Mongo supplies `_id`,
 * and quotations carry a `customerId` link that the input schema doesn't have.
 */

export type QuotationDoc = Omit<Quotation, "_id"> & { customerId: string };
export type CustomerDoc = Omit<Customer, "_id">;
export type UserDoc = Omit<User, "_id">;
export type RateCardDoc = Omit<RateCardEntry, "_id">;
export type SettingsDoc = Omit<Settings, "_id">;

async function collection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export const quotations = () => collection<QuotationDoc>("quotations");
export const customers = () => collection<CustomerDoc>("customers");
export const users = () => collection<UserDoc>("users");
export const rateCard = () => collection<RateCardDoc>("rateCard");
export const settings = () => collection<SettingsDoc>("settings");

/** Convenience aliases for the shapes that come back from these collections. */
export type StoredQuotation = WithId<QuotationDoc>;
export type StoredCustomer = WithId<CustomerDoc>;
export type NewQuotation = OptionalId<QuotationDoc>;
