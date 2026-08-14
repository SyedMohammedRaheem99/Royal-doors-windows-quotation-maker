// Removes quotations/customers created during dev verification, keeping the
// rate card, settings, and admin login intact — leaves a clean slate for a
// client demo without needing to re-seed everything.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

const q = await db.collection("quotations").deleteMany({});
const c = await db.collection("customers").deleteMany({});
console.log(`Cleared ${q.deletedCount} quotation(s) and ${c.deletedCount} customer(s).`);

await client.close();
