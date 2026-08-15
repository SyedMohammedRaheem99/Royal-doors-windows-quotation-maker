import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const outDir = process.argv[2];
const [, , , email, password] = process.argv;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
await page.locator("main input").nth(0).fill("Toast Test Customer");
await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const nums = page.locator('main input[type="number"]');
await nums.nth(2).fill("4");
await nums.nth(3).fill("4");
await page.locator('button:has-text("Save quotation")').click();

// Toast should appear right as the page navigates to the detail view.
await page.waitForSelector('[role="status"]', { timeout: 5000 }).catch(() => null);
const toastVisible = await page.locator('[role="status"]').count();
console.log("Toast element present at navigation time:", toastVisible > 0);

await page.screenshot({ path: `${outDir}\\toast_check.png` });
console.log("Errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
