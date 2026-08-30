// Proves the three-tier visibility rules hold against a real running server.
//
// The client's headline requirement: a super_admin's quotations must not be
// reachable by an admin or a worker, and an admin's must not be reachable by a
// worker — by list, by direct URL, or by API. Also covers the reverse
// direction: a super_admin sees everyone, and an admin sees their own workers.
//
// This is the browser-layer counterpart to lib/__tests__/authz.test.ts, which
// tests the same rules as pure functions. It exists because the unit tests
// can't prove the rules are actually wired into the pages and routes.
//
// Usage:
//   node scripts/test-hierarchy.mjs <outDir> <superEmail> <superPass> <adminEmail> <adminPass> <workerEmail> <workerPass>
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const outDir = process.argv[2];

const SUPER = { email: process.argv[3], password: process.argv[4], label: "super_admin" };
const ADMIN = { email: process.argv[5], password: process.argv[6], label: "admin" };
const WORKER = { email: process.argv[7], password: process.argv[8], label: "worker" };

if (!SUPER.email || !ADMIN.email || !WORKER.email) {
  console.error(
    "Usage: node scripts/test-hierarchy.mjs <outDir> <superEmail> <superPass> <adminEmail> <adminPass> <workerEmail> <workerPass>"
  );
  process.exit(1);
}

const browser = await chromium.launch();
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

async function sessionFor(actor) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, actor);
  return { ctx, page };
}

/** Creates a quotation and returns its id, so we can probe it as another user. */
async function createQuotation(page, customerName) {
  await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
  await page.locator("main input").nth(0).fill(customerName);
  await page.locator("main select").nth(0).selectOption({ index: 1 });
  const nums = page.locator('main input[type="number"]');
  await nums.nth(2).fill("4");
  await nums.nth(3).fill("4");
  await page.locator('button:has-text("Save quotation")').first().click();
  await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 20000 });
  return page.url().split("/").pop();
}

/**
 * True when this session can open that quotation's detail page.
 *
 * Detects the real quotation by its own quote number rather than by scanning
 * the body for "not found" — that phrase also appears in unrelated page
 * chrome, which produced false negatives.
 */
async function canSee(page, id) {
  const res = await page.goto(`${BASE}/quotations/${id}`, { waitUntil: "networkidle" });
  if ((res?.status() ?? 0) !== 200) return false;
  // The quote-number heading only renders on a real, authorised detail page.
  return (await page.locator("h1", { hasText: /^RDW\// }).count()) > 0;
}

/** True when the API hands this session that quotation. */
async function apiCanSee(page, id) {
  return page.evaluate(async (qid) => {
    const r = await fetch(`/api/quotations/${qid}`);
    return r.status === 200;
  }, id);
}

const sup = await sessionFor(SUPER);
const adm = await sessionFor(ADMIN);
const wrk = await sessionFor(WORKER);

// --- Each tier creates a quotation only they should own ---
const superQuoteId = await createQuotation(sup.page, "ZZ Super Admin Private Customer");
const adminQuoteId = await createQuotation(adm.page, "ZZ Admin Private Customer");
const workerQuoteId = await createQuotation(wrk.page, "ZZ Worker Customer");
console.log(`\nseeded: super=${superQuoteId} admin=${adminQuoteId} worker=${workerQuoteId}\n`);

// --- The headline rule: nobody below super_admin sees the super_admin's work ---
check(
  "admin CANNOT open the super admin's quotation by URL",
  !(await canSee(adm.page, superQuoteId))
);
check(
  "admin CANNOT fetch the super admin's quotation via the API",
  !(await apiCanSee(adm.page, superQuoteId))
);
check(
  "worker CANNOT open the super admin's quotation by URL",
  !(await canSee(wrk.page, superQuoteId))
);
check(
  "worker CANNOT fetch the super admin's quotation via the API",
  !(await apiCanSee(wrk.page, superQuoteId))
);

// --- An admin's work is hidden from workers ---
check("worker CANNOT open the admin's quotation by URL", !(await canSee(wrk.page, adminQuoteId)));
check(
  "worker CANNOT fetch the admin's quotation via the API",
  !(await apiCanSee(wrk.page, adminQuoteId))
);

// --- Upward visibility: super_admin sees everyone ---
check("super admin CAN open the admin's quotation", await canSee(sup.page, adminQuoteId));
check("super admin CAN open the worker's quotation", await canSee(sup.page, workerQuoteId));

// --- An admin sees the workers they manage (requires worker.managedBy === admin._id) ---
check("admin CAN open their own worker's quotation", await canSee(adm.page, workerQuoteId));

// --- List scoping, not just direct URLs ---
await adm.page.goto(`${BASE}/quotations?q=ZZ`, { waitUntil: "networkidle" });
const adminList = (await adm.page.textContent("body")) ?? "";
check(
  "the super admin's customer does not appear in the admin's quotation list",
  !adminList.includes("ZZ Super Admin Private Customer")
);

await wrk.page.goto(`${BASE}/quotations?q=ZZ`, { waitUntil: "networkidle" });
const workerList = (await wrk.page.textContent("body")) ?? "";
check(
  "neither the super admin's nor the admin's customer appears in the worker's list",
  !workerList.includes("ZZ Super Admin Private Customer") &&
    !workerList.includes("ZZ Admin Private Customer")
);

// --- Customers are scoped the same way as quotations ---
await wrk.page.goto(`${BASE}/customers?q=ZZ`, { waitUntil: "networkidle" });
const workerCustomers = (await wrk.page.textContent("body")) ?? "";
check(
  "the super admin's customer does not appear in the worker's customer list",
  !workerCustomers.includes("ZZ Super Admin Private Customer")
);

// --- The Users screen is admin-tier only ---
await wrk.page.goto(`${BASE}/users`, { waitUntil: "networkidle" });
check("worker is redirected away from /users", !wrk.page.url().includes("/users"));

if (outDir) {
  await sup.page.screenshot({ path: `${outDir}/hierarchy-super.png`, fullPage: true });
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed.`);
if (passed !== results.length) process.exit(1);
