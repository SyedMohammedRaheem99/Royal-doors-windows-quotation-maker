// One-off, idempotent migration: adds "Clear glass" to any rate card entry's
// specOptions.glass array that doesn't already have it, right before "Clear
// or pinned" so it reads as the plainer, more basic option. Only touches
// entries whose glass array is non-empty (entries with no glass option at
// all, e.g. doors, are correctly left untouched — they never showed a Glass
// dropdown to begin with).
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
// See scripts/seed.ts for why: some ISP resolvers can't answer the SRV
// lookup mongodb+srv:// needs even though the OS resolver can.
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set.");

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");
const col = db.collection("rateCard");

const docs = await col
  .find({ "specOptions.glass": { $exists: true, $ne: [] }, "specOptions.glass": { $nin: ["Clear glass"] } })
  .toArray();

let updated = 0;
for (const doc of docs) {
  const glass = doc.specOptions.glass;
  if (glass.includes("Clear glass")) continue; // belt-and-braces given the $nin above operates per-array-membership

  const idx = glass.indexOf("Clear or pinned");
  const next = idx >= 0 ? [...glass.slice(0, idx), "Clear glass", ...glass.slice(idx)] : ["Clear glass", ...glass];

  await col.updateOne({ _id: doc._id }, { $set: { "specOptions.glass": next } });
  updated++;
}

console.log(`Updated ${updated} of ${docs.length} matching rate card entries.`);
await client.close();
