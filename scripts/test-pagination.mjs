// Proves pagination actually paginates: creates enough quotations to exceed
// one page, confirms Next/Prev work and no quotation appears twice.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , email, password] = process.argv;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

// Find this user's id from the session cookie isn't easy here, so seed
// directly via the API the user is authenticated for instead — simpler and
// exercises the real save path.
const marker = `PAGINATION-TEST-${Date.now()}`;
for (let i = 0; i < 30; i++) {
  const resp = await page.request.post(`${BASE}/api/quotations`, {
    data: {
      customer: { name: `${marker} ${i}`, phone: "", siteAddress: "", project: "", referredBy: "", gstin: "" },
      items: [
        {
          id: crypto.randomUUID(),
          productType: "sliding_2_track",
          description: "2 Track sliding window",
          handing: "none",
          billed: { w: 2, h: 2 },
          qty: 1,
          pricingMode: "per_sqft",
          rate: 300,
          specs: { profile: "", colour: "", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
          surcharges: [],
          diagram: { type: "sliding_2_track", panels: 2, meshPanels: 0, handing: "none", fanPoint: false },
          remarks: "",
        },
      ],
      transportation: 0,
      gst: { enabled: false, rate: 0 },
      terms: { profile: "", glass: "", warrantyYears: 15, validityDays: 5, extraNotes: [] },
    },
  });
  if (!resp.ok()) {
    console.log("Seed failed:", resp.status(), await resp.text());
    process.exit(1);
  }
}
console.log("Seeded 30 quotations via the real API.");

// Page 1 via UI
await page.goto(`${BASE}/quotations?q=${encodeURIComponent(marker)}`, { waitUntil: "networkidle" });
const page1Rows = await page.locator("tbody tr").count();
check("page 1 shows exactly 25 rows (the page size), not all 30", page1Rows === 25, `got ${page1Rows}`);

const nextLink = page.locator('a:has-text("Next")');
check("a 'Next' link is present when there are more results", (await nextLink.count()) === 1);

await nextLink.click();
await page.waitForLoadState("networkidle");
const page2Rows = await page.locator("tbody tr").count();
check("page 2 shows the remaining 5 rows", page2Rows === 5, `got ${page2Rows}`);

const page1Text = await page.locator('a:has-text("Previous")').count();
check("a 'Previous' link is present on page 2", page1Text === 1);

// Confirm no overlap between the two pages
await page.goto(`${BASE}/quotations?q=${encodeURIComponent(marker)}`, { waitUntil: "networkidle" });
const page1Ids = await page.locator('tbody tr td:first-child a').evaluateAll((els) => els.map((e) => e.textContent));
await page.goto(`${BASE}/quotations?q=${encodeURIComponent(marker)}&page=2`, { waitUntil: "networkidle" });
const page2Ids = await page.locator('tbody tr td:first-child a').evaluateAll((els) => els.map((e) => e.textContent));
const overlap = page1Ids.filter((id) => page2Ids.includes(id));
check("no quotation appears on both pages", overlap.length === 0, `overlap: ${overlap.join(", ")}`);

await browser.close();

// Cleanup
const deleted = await db.collection("quotations").deleteMany({ "customer.name": new RegExp(`^${marker}`) });
console.log(`Cleaned up ${deleted.deletedCount} test quotations.`);
await client.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
