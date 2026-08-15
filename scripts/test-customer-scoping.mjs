// Proves the findOrCreateCustomer fix: two different users each quoting a
// same-named customer must get two SEPARATE customer records, and neither
// user's save may overwrite the other's contact details.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , adminEmail, adminPass, salesEmail, salesPass] = process.argv;
const SHARED_NAME = `Same Name Customer ${Date.now()}`;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

async function saveQuotationFor(page, customerName, phone) {
  await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
  await page.locator("main input").nth(0).fill(customerName);
  await page.locator("main input").nth(1).fill(phone);
  await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
  const nums = page.locator('main input[type="number"]');
  await nums.nth(2).fill("3");
  await nums.nth(3).fill("3");
  await page.locator('button:has-text("Save quotation")').click();
  await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 15000 });
}

// Admin quotes a customer with phone A
const adminCtx = await browser.newContext();
const adminPage = await adminCtx.newPage();
await login(adminPage, adminEmail, adminPass);
await saveQuotationFor(adminPage, SHARED_NAME, "+91 11111 11111");

// Sales quotes a DIFFERENT real person who happens to share the exact name, phone B
const salesCtx = await browser.newContext();
const salesPage = await salesCtx.newPage();
await login(salesPage, salesEmail, salesPass);
await saveQuotationFor(salesPage, SHARED_NAME, "+91 99999 99999");

// Admin's customer record must still show phone A, not have been overwritten
// by sales's save. Admins see EVERYONE's customers by design (ownershipFilter
// is unrestricted for admins), so admin's list legitimately shows both phone
// numbers — the two-separate-records check on the admin side is "both A and B
// appear", not "only A appears". Searched by name (not just the unfiltered
// first page) since accumulated test data across a long session can push a
// specific record past the pagination page size otherwise.
await adminPage.goto(`${BASE}/customers?q=${encodeURIComponent(SHARED_NAME)}`, { waitUntil: "networkidle" });
const adminBody = await adminPage.textContent("body");
check(
  "admin's customer record keeps its OWN phone number (not overwritten by sales's save)",
  adminBody.includes("11111 11111")
);
check(
  "admin (unrestricted visibility) sees BOTH records as distinct — not merged into one",
  adminBody.includes("11111 11111") && adminBody.includes("99999 99999")
);

// Sales is NOT an admin — ownershipFilter restricts them to their own
// records, so this is the real cross-tenant-leak check.
await salesPage.goto(`${BASE}/customers?q=${encodeURIComponent(SHARED_NAME)}`, { waitUntil: "networkidle" });
const salesBody = await salesPage.textContent("body");
check("sales's customer record has their OWN phone number", salesBody.includes("99999 99999"));
check("sales (restricted visibility) does NOT see admin's phone number on the shared name", !salesBody.includes("11111 11111"));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
