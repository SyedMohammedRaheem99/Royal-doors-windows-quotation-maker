/**
 * Seeds MongoDB with the rate card, settings, and one admin user.
 * Safe to re-run: rate card and settings upsert by productType / singleton,
 * the admin user is only created if no user with that email exists yet.
 *
 * Usage:
 *   npm run seed -- --email you@example.com --password "changeme" --name "Azgar"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { RATE_CARD_SEED } from "../models/rateCardSeed";
import { SETTINGS_SEED } from "../models/settingsSeed";

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

  const { email, password, name, role = "admin" } = parseArgs();
  if (!email || !password || !name) {
    throw new Error(
      'Usage: npm run seed -- --email you@example.com --password "changeme" --name "Your Name" [--role admin|sales]'
    );
  }
  if (role !== "admin" && role !== "sales") {
    throw new Error(`--role must be "admin" or "sales", got "${role}".`);
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

  // --- user ---
  const users = db.collection("users");
  const existingUser = await users.findOne({ email });
  if (existingUser) {
    console.log(`User ${email} already exists — skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({ name, email, passwordHash, role, createdAt: new Date() });
    console.log(`${role === "admin" ? "Admin" : "Sales"} user created: ${email}`);
  }

  await client.close();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
