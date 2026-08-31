// One-off, idempotent migration: rewrites the stored specOptions.colours
// array on every rate-card entry that currently has the OLD shared
// COLOUR_OPTIONS list (see models/rateCardSeed.ts's pre-change value) to the
// new, reordered/expanded list — Black/Gray/Brown and Golden Oak/Walnut/
// Mahogany first (see lib/pricing.ts's COLOR_SURCHARGES for why those exact
// string values matter), the original entries kept after.
//
// Deliberately scoped to entries whose colours array matches the OLD list
// exactly (order-independent) — the aluminium ("Silver, White, Black"), WPC
// ("Teak, Walnut, White"), and PVC-door ("White, Teak color, Brown") variant
// lists are left untouched: they already contain the string values the
// pricing rule matches on (e.g. aluminium's existing "Black"), and no
// reordering of those was requested.
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set.");

const OLD_COLOUR_OPTIONS = ["White", "Half white", "Milk white", "Teak", "Brown", "Golden Oak"];
const NEW_COLOUR_OPTIONS = ["Black", "Gray", "Brown", "Golden Oak", "Walnut", "Mahogany", "White", "Half white", "Milk white", "Teak"];

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");
const col = db.collection("rateCard");

const docs = await col.find({ "specOptions.colours": { $exists: true, $ne: [] } }).toArray();

let updated = 0;
for (const doc of docs) {
  const colours = doc.specOptions.colours;
  if (sameSet(colours, NEW_COLOUR_OPTIONS)) continue; // already migrated
  if (!sameSet(colours, OLD_COLOUR_OPTIONS)) continue; // a custom list (aluminium/WPC/PVC door) — leave alone

  await col.updateOne({ _id: doc._id }, { $set: { "specOptions.colours": NEW_COLOUR_OPTIONS } });
  updated++;
}

console.log(`Updated ${updated} of ${docs.length} rate card entries with a non-empty colours array.`);
await client.close();
