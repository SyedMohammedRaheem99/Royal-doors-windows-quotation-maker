// Seeds a known dataset, then verifies the dashboard's computed numbers
// match what that dataset should produce — a dashboard that renders but
// shows wrong figures is worse than one that doesn't render at all.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient, ObjectId } from "mongodb";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , adminEmail, adminPass] = process.argv;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const adminUser = await db.collection("users").findOne({ email: adminEmail });
if (!adminUser) {
  console.log("Admin user not found — seed first.");
  process.exit(1);
}
const adminId = adminUser._id.toString();

const marker = `DASH-${Date.now()}`;
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

function quote({ suffix, status, total, updatedAt, createdAt, itemDesc, itemAmount }) {
  return {
    quoteNo: `${marker}-${suffix}`,
    revision: 0,
    status,
    date: createdAt,
    customer: { name: `${marker} ${suffix}`, phone: "", siteAddress: "", project: "", referredBy: "", gstin: "" },
    customerId: "dash-test",
    items: [
      {
        id: `${marker}-${suffix}-item`,
        productType: "sliding_2_track",
        description: itemDesc,
        handing: "none",
        billed: { w: 2, h: 2 },
        qty: 1,
        pricingMode: "per_sqft",
        rate: 300,
        areaPerUnitSqft: 4,
        totalAreaSqft: 4,
        amount: itemAmount,
        specs: { profile: "", colour: "", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
        surcharges: [],
        diagram: { type: "sliding_2_track", panels: 2, meshPanels: 0, handing: "none", fanPoint: false },
        remarks: "",
      },
    ],
    transportation: 0,
    gst: { enabled: false, rate: 0 },
    totals: { subtotal: total, cgst: 0, sgst: 0, transportation: 0, grandTotal: total, roundOff: 0 },
    terms: { profile: "", glass: "", warrantyYears: 15, validityDays: 5, extraNotes: [] },
    statusHistory: [],
    createdBy: adminId,
    createdAt,
    updatedAt,
  };
}

// A deliberately known dataset:
//  - 3 created this month (2 recent + 1 stale), 1 created last month
//  - pipeline (status "sent"): 2 quotations, 10000 + 20000 = 30000
//  - 3 approved, 1 lost  -> conversion 3/4 = 75%
//  - 1 sent quotation updated 10 days ago -> 1 stale (threshold is 7 days)
//  - top product by value: "Premium Door" at 50000
const thisMonthStart = new Date();
thisMonthStart.setDate(1);
thisMonthStart.setHours(0, 0, 0, 0);
const inThisMonth = new Date(thisMonthStart.getTime() + 86400000); // 1 day into this month
const lastMonth = new Date(thisMonthStart.getTime() - 5 * 86400000);

const docs = [
  quote({ suffix: "sent-fresh", status: "sent", total: 10000, createdAt: inThisMonth, updatedAt: daysAgo(1), itemDesc: "Budget Window", itemAmount: 10000 }),
  quote({ suffix: "sent-stale", status: "sent", total: 20000, createdAt: inThisMonth, updatedAt: daysAgo(10), itemDesc: "Budget Window", itemAmount: 20000 }),
  quote({ suffix: "approved-1", status: "approved", total: 50000, createdAt: inThisMonth, updatedAt: daysAgo(2), itemDesc: "Premium Door", itemAmount: 50000 }),
  quote({ suffix: "approved-2", status: "approved", total: 5000, createdAt: lastMonth, updatedAt: daysAgo(3), itemDesc: "Budget Window", itemAmount: 5000 }),
  quote({ suffix: "approved-3", status: "approved", total: 5000, createdAt: lastMonth, updatedAt: daysAgo(4), itemDesc: "Budget Window", itemAmount: 5000 }),
  quote({ suffix: "lost-1", status: "lost", total: 1000, createdAt: lastMonth, updatedAt: daysAgo(5), itemDesc: "Budget Window", itemAmount: 1000 }),
];
await db.collection("quotations").insertMany(docs);
console.log(`Seeded ${docs.length} quotations with known values.\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", adminEmail);
await page.fill("#password", adminPass);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

// The dashboard streams (it has a loading.tsx Suspense boundary), so
// "networkidle" fires while the skeleton is still on screen. Wait for real
// content — a stat tile label that only exists in the resolved page.
await page.waitForSelector("text=Conversion rate", { timeout: 15000 });

const body = await page.textContent("body");

// Read each stat tile by structure rather than regexing the whole page — a
// loose regex previously matched a digit from a NEIGHBOURING tile and
// reported a false failure while the UI was in fact correct.
async function tile(label) {
  const el = page.locator("div", { hasText: new RegExp(`^${label}`) }).last();
  const text = await el.textContent();
  return text ?? "";
}
const monthTile = await tile("This month");
const pipelineTile = await tile("Pipeline \\(sent, awaiting decision\\)");
const conversionTile = await tile("Conversion rate");
const followUpTile = await tile("Needs follow-up");

// This test's own 6 quotations share the DB with whatever else is present,
// so absolute counts for "this month" aren't assertable. Assert the values
// this dataset uniquely determines, and the tiles scoped to status instead.
check("pipeline count is exactly 2 (both 'sent' quotations)", /\b2\b/.test(pipelineTile), pipelineTile.trim());
check("pipeline value is ₹30,000", pipelineTile.includes("30,000"), pipelineTile.trim());

// Conversion: 3 approved / (3 approved + 1 lost) = 75%
check("conversion rate is 75%", conversionTile.includes("75%"), conversionTile.trim());
check("conversion sub-label shows 3 won / 1 lost", conversionTile.includes("3 won / 1 lost"), conversionTile.trim());

// This month's tile must at minimum include this test's 3 in-month quotations.
check("this-month tile renders a count and a value", /\d/.test(monthTile) && monthTile.includes("₹"), monthTile.trim());

// Stale: exactly 1 sent quotation not updated in 10 days (threshold 7).
// Match the count immediately after the label — the tile's sub-text
// ("sent 7+ days ago") also contains digits, so a bare digit test is
// ambiguous against the concatenated textContent.
check(
  "needs-follow-up count is exactly 1",
  /^Needs follow-up1(?!\d)/.test(followUpTile.trim()),
  followUpTile.trim()
);
check("the stale quotation is listed by name", body.includes(`${marker}-sent-stale`));
check(
  "the fresh sent quotation is NOT in the follow-up list",
  !/sent-fresh[\s\S]{0,60}days ago/.test(body)
);

// Top products: Premium Door (50000) should outrank Budget Window
check("top products lists 'Premium Door'", body.includes("Premium Door"));

// Admin sees the per-rep breakdown
check("admin sees the 'By salesperson' breakdown", body.includes("By salesperson"));

await page.screenshot({
  path: "C:\\Users\\muska\\AppData\\Local\\Temp\\claude\\c--Users-muska-Downloads-Royal-doors-windows-quotation-maker\\2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d\\scratchpad\\dashboard.png",
  fullPage: true,
});

await browser.close();

const deleted = await db.collection("quotations").deleteMany({ quoteNo: new RegExp(`^${marker}`) });
console.log(`\nCleaned up ${deleted.deletedCount} test quotations.`);
await client.close();

console.log("Console errors:", errors.length ? errors.join("\n") : "none");
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
