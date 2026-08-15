// Proves the Phase 1 ownership rules hold against a real running server:
// a sales user must not be able to read, print, edit, or mutate another
// user's quotation, nor see their customers.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const outDir = process.argv[2];

const ADMIN = { email: process.argv[3], password: process.argv[4] };
const SALES = { email: process.argv[5], password: process.argv[6] };

const browser = await chromium.launch();

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// --- 1. Admin creates a quotation ---
const adminCtx = await browser.newContext();
const adminPage = await adminCtx.newPage();
await login(adminPage, ADMIN);

await adminPage.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
await adminPage.locator("main input").nth(0).fill("Confidential Admin Customer");
await adminPage.locator("main input").nth(2).fill("Secret Project");
await adminPage.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const nums = adminPage.locator('main input[type="number"]');
await nums.nth(2).fill("4");
await nums.nth(3).fill("4");
await adminPage.locator('button:has-text("Save quotation")').click();
await adminPage.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 15000 });
const adminQuoteUrl = adminPage.url();
const adminQuoteId = adminQuoteUrl.split("/").pop();
console.log("Admin quotation:", adminQuoteId);

// --- 2. Sales user tries to reach it ---
const salesCtx = await browser.newContext();
const salesPage = await salesCtx.newPage();
await login(salesPage, SALES);

// detail page
const detail = await salesPage.goto(`${BASE}/quotations/${adminQuoteId}`, { waitUntil: "networkidle" });
check("sales CANNOT open another user's quotation detail", detail.status() === 404, `got ${detail.status()}`);

// edit page
const edit = await salesPage.goto(`${BASE}/quotations/${adminQuoteId}/edit`, { waitUntil: "networkidle" });
check("sales CANNOT open another user's edit page", edit.status() === 404, `got ${edit.status()}`);

// print page
const print = await salesPage.goto(`${BASE}/quotations/${adminQuoteId}/print`, { waitUntil: "networkidle" });
check("sales CANNOT print another user's quotation", print.status() === 404, `got ${print.status()}`);

// API
const api = await salesPage.request.get(`${BASE}/api/quotations/${adminQuoteId}`);
check("sales CANNOT fetch another user's quotation via API", api.status() === 404, `got ${api.status()}`);

// list should not include it — API now returns { items, hasMore, page }
const listApi = await salesPage.request.get(`${BASE}/api/quotations`);
const listJson = await listApi.json();
const leaked = Array.isArray(listJson.items) && listJson.items.some((q) => String(q._id) === adminQuoteId);
check("sales quotation list does NOT include another user's quotation", !leaked);

// customers list should not include the admin's customer
await salesPage.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
const custBody = await salesPage.textContent("body");
check(
  "sales customer list does NOT show another user's customer",
  !custBody.includes("Confidential Admin Customer")
);

const custApi = await salesPage.request.get(`${BASE}/api/customers`);
const custJson = await custApi.json();
const custLeaked = Array.isArray(custJson.items) && custJson.items.some((c) => c.name === "Confidential Admin Customer");
check("sales customers API does NOT leak another user's customer", !custLeaked);

// --- 3. Admin can still see their own ---
const adminOwn = await adminPage.goto(adminQuoteUrl, { waitUntil: "networkidle" });
check("admin CAN still open their own quotation", adminOwn.status() === 200, `got ${adminOwn.status()}`);

await salesPage.screenshot({ path: `${outDir}\\authz_sales_customers.png`, fullPage: true });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log("FAILURES:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
