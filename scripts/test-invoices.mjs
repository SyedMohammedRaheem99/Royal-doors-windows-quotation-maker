// Verifies tax invoicing end-to-end: the guardrails that stop an invoice
// being raised when it shouldn't be, the tax arithmetic on the resulting
// document, and the one-invoice-per-quotation rule.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , email, password] = process.argv;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// A tax invoice needs a seller GSTIN; make sure one is configured.
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");
await db.collection("settings").updateOne({}, { $set: { gstin: "29BBAPM2758M1Z6" } });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

// --- build a GST quotation: 5x4 = 20 sqft x ₹300 = ₹6,000 + 18% = ₹7,080 ---
await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
await page.locator("main input").nth(0).fill("Invoice Test Buyer");
await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const nums = page.locator('main input[type="number"]');
await nums.nth(2).fill("5");
await nums.nth(3).fill("4");
await page.locator('main input[type="checkbox"]').nth(3).check(); // enable GST
await page.locator('button:has-text("Save quotation")').click();
await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 15000 });
const quoteUrl = page.url();
const quotationId = quoteUrl.split("/").pop();

// --- a DRAFT must not offer invoicing ---
check("draft quotation does NOT offer 'Raise tax invoice'", (await page.locator('a:has-text("Raise tax invoice")').count()) === 0);

// direct URL must also be refused, not just the button hidden
const blockedResp = await page.goto(`${BASE}/invoices/new?from=${quotationId}`, { waitUntil: "networkidle" });
const blockedBody = await page.textContent("body");
check(
  "direct invoice URL on a draft is refused with a reason",
  blockedBody.includes("Cannot raise an invoice") && blockedBody.includes("not approved"),
  `status ${blockedResp.status()}`
);

// --- approve it ---
await page.goto(quoteUrl, { waitUntil: "networkidle" });
await page.locator('button:has-text("Mark as sent")').click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
await page.locator('button:has-text("Mark approved")').click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });

check("approved quotation OFFERS 'Raise tax invoice'", (await page.locator('a:has-text("Raise tax invoice")').count()) === 1);

// --- raise the invoice ---
await page.locator('a:has-text("Raise tax invoice")').click();
await page.waitForURL(/\/invoices\/new/, { timeout: 15000 });
check("buyer name is pre-filled from the quotation", (await page.locator("main input").first().inputValue()) === "Invoice Test Buyer");

await page.locator('button:has-text("Raise tax invoice")').click();
await page.waitForURL(/\/invoices\/[a-f0-9]{24}$/, { timeout: 15000 });
const invoiceUrl = page.url();
const invoiceBody = await page.textContent("body");

check("invoice number was issued", /INV\/\d{2}-\d{2}\/\d{3}/.test(invoiceBody), invoiceBody.match(/INV\/[\d-]+\/\d+/)?.[0] ?? "");
check("taxable value is ₹6,000", invoiceBody.includes("6,000"));
check("CGST at 9% is ₹540", invoiceBody.includes("540"));
check("invoice total is ₹7,080", invoiceBody.includes("7,080"));
check("links back to the source quotation", invoiceBody.includes("RDW/"));

// --- one invoice per quotation ---
await page.goto(quoteUrl, { waitUntil: "networkidle" });
const afterInvoice = await page.textContent("body");
check("quotation now shows 'View tax invoice' instead of raising another", afterInvoice.includes("View tax invoice"));
check("the 'Raise tax invoice' action is gone", (await page.locator('a:has-text("Raise tax invoice")').count()) === 0);

await page.goto(`${BASE}/invoices/new?from=${quotationId}`, { waitUntil: "networkidle" });
const secondAttempt = await page.textContent("body");
check(
  "a second raise attempt via direct URL is refused",
  secondAttempt.includes("already been invoiced")
);

// --- the printed document ---
await page.goto(`${invoiceUrl}/print`, { waitUntil: "networkidle" });
const printBody = await page.textContent("body");
check("printed invoice is titled 'Tax Invoice'", printBody.includes("Tax Invoice"));
check("printed invoice carries the seller GSTIN", printBody.includes("29BBAPM2758M1Z6"));
check("printed invoice carries HSN/SAC 3917", printBody.includes("3917"));
check("printed invoice carries the amount in words", printBody.includes("INR."));
check("printed invoice carries the declaration", printBody.includes("actual price of the goods"));
check("printed invoice shows an HSN summary", printBody.includes("Taxable Value"));

await page.screenshot({
  path: "C:/Users/muska/AppData/Local/Temp/claude/c--Users-muska-Downloads-Royal-doors-windows-quotation-maker/2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d/scratchpad/invoice_print.png",
  fullPage: true,
});

// --- it appears in the invoices list ---
await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle" });
const listBody = await page.textContent("body");
check("invoice appears in the invoices list", listBody.includes("Invoice Test Buyer"));
check("list shows the supply type", listBody.includes("CGST + SGST"));

await browser.close();
await client.close();

console.log("Console errors:", errors.length ? errors.join("\n") : "none");
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
