// Creates every index the app depends on (see lib/indexes.ts). Safe to
// re-run: MongoDB's createIndexes no-ops on an index that already exists
// with the same name and spec, and fails loudly if the spec has drifted
// under the same name rather than silently diverging.
//
// Usage: npm run migrate
import { config } from "dotenv";
config({ path: ".env.local" });
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
  const { ensureIndexes, QUOTATION_INDEXES, CUSTOMER_INDEXES, USER_INDEXES, RATE_CARD_INDEXES } = await import(
    "../lib/indexes.ts"
  );

  await ensureIndexes(db);

  const total =
    QUOTATION_INDEXES.length + CUSTOMER_INDEXES.length + USER_INDEXES.length + RATE_CARD_INDEXES.length;
  console.log(`Ensured ${total} indexes across quotations, customers, users, rateCard.`);

  for (const name of ["quotations", "customers", "users", "rateCard"]) {
    const indexes = await db.collection(name).listIndexes().toArray();
    console.log(`  ${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }

  await client.close();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
