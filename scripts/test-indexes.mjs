// Proves the unique indexes actually reject duplicates against the real
// local database — an index that exists but was never tested for the
// behavior it's supposed to provide isn't verified, just hoped for.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

  // --- quoteNo uniqueness ---
  const quotations = db.collection("quotations");
  const dupeQuoteNo = `TEST-DUPE-${Date.now()}`;
  const baseDoc = {
    quoteNo: dupeQuoteNo,
    revision: 0,
    status: "draft",
    date: new Date(),
    customer: { name: "Index Test", phone: "", siteAddress: "", project: "", referredBy: "", gstin: "" },
    customerId: "test",
    items: [],
    transportation: 0,
    gst: { enabled: false, rate: 0 },
    totals: { subtotal: 0, cgst: 0, sgst: 0, transportation: 0, grandTotal: 0, roundOff: 0 },
    terms: { profile: "", glass: "", warrantyYears: 15, validityDays: 5, extraNotes: [] },
    statusHistory: [],
    createdBy: "test",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await quotations.insertOne(baseDoc);
  let rejected = false;
  try {
    await quotations.insertOne({ ...baseDoc, _id: undefined });
  } catch (err) {
    rejected = err.code === 11000; // MongoDB duplicate key error
  }
  check("duplicate quoteNo is REJECTED by the unique index", rejected);
  await quotations.deleteMany({ quoteNo: dupeQuoteNo });

  // --- user email uniqueness ---
  const users = db.collection("users");
  const dupeEmail = `test-dupe-${Date.now()}@example.com`;
  await users.insertOne({ name: "A", email: dupeEmail, passwordHash: "x", role: "sales", createdAt: new Date() });
  let userRejected = false;
  try {
    await users.insertOne({ name: "B", email: dupeEmail, passwordHash: "y", role: "sales", createdAt: new Date() });
  } catch (err) {
    userRejected = err.code === 11000;
  }
  check("duplicate user email is REJECTED by the unique index", userRejected);
  await users.deleteMany({ email: dupeEmail });

  // --- rateCard productType uniqueness ---
  const rateCard = db.collection("rateCard");
  const dupeProduct = `test_dupe_${Date.now()}`;
  await rateCard.insertOne({
    productType: dupeProduct,
    label: "Test",
    category: "sliding",
    pricingMode: "per_sqft",
    defaultRate: 100,
    minRate: 100,
    maxRate: 100,
    diagramType: "fixed",
    specOptions: { profiles: [], colours: [], glass: [], mesh: [] },
    active: true,
  });
  let productRejected = false;
  try {
    await rateCard.insertOne({
      productType: dupeProduct,
      label: "Test 2",
      category: "sliding",
      pricingMode: "per_sqft",
      defaultRate: 200,
      minRate: 200,
      maxRate: 200,
      diagramType: "fixed",
      specOptions: { profiles: [], colours: [], glass: [], mesh: [] },
      active: true,
    });
  } catch (err) {
    productRejected = err.code === 11000;
  }
  check("duplicate rate-card productType is REJECTED by the unique index", productRejected);
  await rateCard.deleteMany({ productType: dupeProduct });

  await client.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
