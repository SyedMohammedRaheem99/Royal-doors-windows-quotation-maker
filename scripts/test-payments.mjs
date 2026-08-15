// Verifies payment recording end-to-end, including the rule that money can
// only be recorded against an APPROVED quotation, and that the balance
// arithmetic shown to the user is right.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , email, password] = process.argv;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

// Create a quotation worth a known amount: 5ft x 4ft = 20 sqft x ₹300 = ₹6,000
await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
await page.locator("main input").nth(0).fill("Payment Test Customer");
await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const nums = page.locator('main input[type="number"]');
await nums.nth(2).fill("5");
await nums.nth(3).fill("4");
await page.locator('button:has-text("Save quotation")').click();
await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 15000 });
const quoteUrl = page.url();

// --- while it's a DRAFT, recording must not be offered ---
await page.waitForSelector("text=Payments", { timeout: 10000 });
const draftBody = await page.textContent("body");
check(
  "a draft quotation does NOT offer payment recording",
  draftBody.includes("Payments can be recorded once this quotation is approved")
);
check("no '+ Record payment' button on a draft", (await page.locator('button:has-text("Record payment")').count()) === 0);

// --- move it to approved: draft -> sent -> approved ---
await page.locator('button:has-text("Mark as sent")').click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
await page.locator('button:has-text("Mark approved")').click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });

const approvedBody = await page.textContent("body");
check("quotation reached 'approved'", approvedBody.includes("Approved") || approvedBody.includes("approved"));
check("approved quotation OFFERS payment recording", (await page.locator('button:has-text("Record payment")').count()) === 1);

// --- record a partial payment of ₹4,000 against ₹6,000 ---
await page.locator('button:has-text("Record payment")').click();
await page.locator('input[type="number"]').last().fill("4000");
await page.locator('button:has-text("Save payment")').click();
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle" });

const afterPartial = await page.textContent("body");
check("received total shows ₹4,000", afterPartial.includes("4,000"), "");
check("outstanding balance shows ₹2,000", afterPartial.includes("2,000"), "");
check("not marked fully paid on a partial payment", !afterPartial.includes("Fully paid"));

// The 60/30/10 scheme on ₹6,000 is 3600 / 1800 / 600. ₹4,000 covers the
// advance (3600) but not cumulative 5400, so exactly one stage is ticked.
check("payment scheme stages are shown", afterPartial.includes("60% advance."));

await page.screenshot({
  path: "C:/Users/muska/AppData/Local/Temp/claude/c--Users-muska-Downloads-Royal-doors-windows-quotation-maker/2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d/scratchpad/payments_partial.png",
  fullPage: true,
});

// --- settle the remaining ₹2,000 ---
await page.locator('button:has-text("Record payment")').click();
await page.locator('input[type="number"]').last().fill("2000");
await page.locator('button:has-text("Save payment")').click();
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle" });

const afterFull = await page.textContent("body");
check("marked 'Fully paid' once settled", afterFull.includes("Fully paid"));
check("both payments appear in the ledger", (await page.locator("text=Remove").count()) === 2);

await page.screenshot({
  path: "C:/Users/muska/AppData/Local/Temp/claude/c--Users-muska-Downloads-Royal-doors-windows-quotation-maker/2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d/scratchpad/payments_full.png",
  fullPage: true,
});

// --- a duplicate must NOT inherit the payments ---
await page.goto(quoteUrl, { waitUntil: "networkidle" });
await page.locator('button:has-text("Duplicate")').click();
await page.waitForURL(/\/quotations\/[a-f0-9]{24}\/edit$/, { timeout: 15000 });
const dupId = page.url().match(/quotations\/([a-f0-9]{24})/)[1];
await page.goto(`${BASE}/quotations/${dupId}`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Payments", { timeout: 10000 });
const dupBody = await page.textContent("body");
check(
  "a duplicated quotation starts with NO payments carried over",
  dupBody.includes("Payments can be recorded once this quotation is approved") ||
    dupBody.includes("No payments recorded yet")
);

await browser.close();
console.log("Console errors:", errors.length ? errors.join("\n") : "none");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
