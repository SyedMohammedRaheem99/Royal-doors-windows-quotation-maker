/**
 * Seeds MongoDB with the rate card, settings, and one super_admin user.
 * Safe to re-run: rate card and settings upsert by productType / singleton,
 * the user is only created if no user with that email exists yet.
 *
 * super_admin is the one owner account and is ONLY ever created this way —
 * there is deliberately no in-app UI to create one, and no forgot-password
 * flow for it either (see lib/authz.ts / lib/users.ts). Admin and worker
 * accounts are created afterwards from the app's Users screen by whoever
 * manages them.
 *
 * Usage:
 *   npm run seed -- --email you@example.com --password "changeme" --name "Azgar"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
// Some ISP resolvers return SRV records that Node's DNS module can't parse
// (seen locally: mongodb+srv:// lookups fail with ECONNREFUSED even though
// `nslookup` resolves fine). Pointing Node at a public resolver for this
// script only sidesteps it without touching the OS/network config; the
// mongodb+srv:// URI itself is unaffected wherever DNS works normally
// (Vercel's servers included).
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { MongoClient } from "mongodb";
import { RATE_CARD_SEED } from "../models/rateCardSeed";
import { SETTINGS_SEED } from "../models/settingsSeed";
import { hashPassword } from "../lib/password";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      out[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return out;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.local.example to .env.local first.");
  }

  const { email, password, name } = parseArgs();
  if (!email || !password || !name) {
    throw new Error(
      'Usage: npm run seed -- --email you@example.com --password "changeme" --name "Your Name"'
    );
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

  // --- rate card: upsert each entry by productType ---
  const rateCard = db.collection("rateCard");
  for (const entry of RATE_CARD_SEED) {
    await rateCard.updateOne({ productType: entry.productType }, { $set: entry }, { upsert: true });
  }
  console.log(`Rate card seeded: ${RATE_CARD_SEED.length} product types.`);

  // --- settings: singleton, upsert ---
  const settingsCol = db.collection("settings");
  const existingSettings = await settingsCol.findOne({});
  if (existingSettings) {
    // Never overwrite an existing counter — that would risk reissuing quote numbers.
    console.log("Settings document already exists — leaving quoteNumbering.counter untouched.");
  } else {
    await settingsCol.insertOne(SETTINGS_SEED);
    console.log("Settings document created.");
  }

  // --- super_admin user ---
  const users = db.collection("users");
  const existingUser = await users.findOne({ email });
  if (existingUser) {
    console.log(`User ${email} already exists — skipping.`);
  } else {
    const passwordHash = await hashPassword(password);
    await users.insertOne({
      name,
      email,
      passwordHash,
      role: "super_admin",
      active: true,
      createdAt: new Date(),
    });
    console.log(`Super admin user created: ${email}`);
  }

  await client.close();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
