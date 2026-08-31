// Creates every index the app depends on (see lib/indexes.ts). Safe to
// re-run: MongoDB's createIndexes no-ops on an index that already exists
// with the same name and spec, and fails loudly if the spec has drifted
// under the same name rather than silently diverging.
//
// Usage: npm run migrate
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
// See scripts/seed.ts for why: some ISP resolvers can't answer the SRV
// lookup mongodb+srv:// needs even though the OS resolver can.
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.local.example to .env.local first.");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

  // Imported dynamically after env is loaded, and re-implemented against the
  // plain driver here rather than importing lib/indexes.ts directly — that
  // module is TypeScript and this script runs standalone via tsx, so a
  // direct import works, but keeping the index specs co-located in one file
  // and just calling it is simplest.
  const {
    ensureIndexes,
    QUOTATION_INDEXES,
    CUSTOMER_INDEXES,
    INVOICE_INDEXES,
    USER_INDEXES,
    RATE_CARD_INDEXES,
    LOGIN_ATTEMPT_INDEXES,
  } = await import("../lib/indexes.ts");

  await ensureIndexes(db);

  const total =
    QUOTATION_INDEXES.length +
    CUSTOMER_INDEXES.length +
    INVOICE_INDEXES.length +
    USER_INDEXES.length +
    RATE_CARD_INDEXES.length +
    LOGIN_ATTEMPT_INDEXES.length;
  console.log(`Ensured ${total} indexes across quotations, customers, invoices, users, rateCard, loginAttempts.`);

  for (const name of ["quotations", "customers", "invoices", "users", "rateCard", "loginAttempts"]) {
    const indexes = await db.collection(name).listIndexes().toArray();
    console.log(`  ${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }

  // Settings fields added after this deployment was first seeded — see
  // lib/settingsMigration.ts for why the seed script alone isn't enough.
  const { backfillSettings } = await import("../lib/settingsMigration.ts");
  const backfilled = await backfillSettings(db);
  console.log(
    backfilled.length > 0
      ? `Backfilled ${backfilled.length} settings field(s): ${backfilled.join(", ")}`
      : "Settings are up to date — nothing to backfill."
  );

  // --- three-tier role migration (old 2-role "admin"/"sales" -> super_admin/admin/worker) ---
  // Idempotent: re-running finds nothing left to migrate once done.
  const users = db.collection("users");

  // The original seeded "admin" becomes the one super_admin (the business
  // owner). If more than one "admin" document exists at migration time, only
  // the oldest is promoted — the rest are left as "admin" for manual review
  // rather than guessed, since which one is the real owner isn't derivable.
  const legacyAdmins = await users.find({ role: "admin" }).sort({ createdAt: 1 }).toArray();
  if (legacyAdmins.length > 0) {
    const owner = legacyAdmins[0];
    await users.updateOne({ _id: owner._id }, { $set: { role: "super_admin", active: true } });
    console.log(`Promoted legacy admin ${owner.email} to super_admin.`);
    if (legacyAdmins.length > 1) {
      console.log(
        `Left ${legacyAdmins.length - 1} other legacy "admin" user(s) as role "admin" — ` +
          `review and assign managedBy manually via the Users screen.`
      );
    }
  }

  const legacySales = await users.find({ role: "sales" }).toArray();
  if (legacySales.length > 0) {
    const superAdmin = await users.findOne({ role: "super_admin" });
    const result = await users.updateMany(
      { role: "sales" },
      { $set: { role: "worker", managedBy: superAdmin?._id?.toString(), active: true } }
    );
    console.log(`Migrated ${result.modifiedCount} legacy "sales" user(s) to "worker", managed by the super_admin.`);
  }

  const backfillActive = await users.updateMany({ active: { $exists: false } }, { $set: { active: true } });
  if (backfillActive.modifiedCount > 0) {
    console.log(`Backfilled active:true on ${backfillActive.modifiedCount} user(s).`);
  }

  await client.close();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
