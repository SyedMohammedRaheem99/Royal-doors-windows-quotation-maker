import { chromium } from "playwright";

const outDir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/dev/builder", { waitUntil: "networkidle" });

// 1. Customer name (first input on the page)
await page.locator("input").nth(0).fill("Test Customer — Rammurthy Nagar");

// 2. Item 1 product (first select on the page)
await page.locator("select").nth(0).selectOption({ label: "2.5 Track sliding window with fly mesh" });
await page.screenshot({ path: `${outDir}\\builder_after_product.png`, fullPage: true });

// 3. Set billed dimensions + qty to reproduce the Rammurthy Nagar row 10 worked example (5.5 x 6.5, qty 14)
const numberInputs = page.locator('input[type="number"]');
await numberInputs.nth(2).fill("5.5"); // billed width
await numberInputs.nth(3).fill("6.5"); // billed height
await numberInputs.nth(4).fill("14"); // qty

await page.screenshot({ path: `${outDir}\\builder_sized.png`, fullPage: true });

// 4. Toggle a surcharge, confirm the amount changes
await page.locator('input[type="checkbox"]').nth(0).check();
await page.screenshot({ path: `${outDir}\\builder_surcharge.png`, fullPage: true });

// 5. Enable GST
const gstCheckbox = page.locator('input[type="checkbox"]').nth(3);
await gstCheckbox.check();
await page.screenshot({ path: `${outDir}\\builder_gst.png`, fullPage: true });

// 6. Save
await page.locator('button:has-text("Save quotation")').click();
await page.waitForSelector("text=Saved as", { timeout: 10000 });
await page.screenshot({ path: `${outDir}\\builder_saved.png`, fullPage: true });

console.log("Console errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
