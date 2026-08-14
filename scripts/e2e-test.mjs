import { chromium } from "playwright";

const outDir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
page.on("pageerror", (err) => errors.push(`[pageerror] ${err}`));
page.on("response", (res) => { if (res.status() >= 500) errors.push(`[${res.status()}] ${res.url()}`); });

const shot = async (name) => page.screenshot({ path: `${outDir}\\e2e_${name}.png`, fullPage: true });

// 1. Login
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill("#email", "test@royaldoorsandwindows.com");
await page.fill("#password", "Test@1234");
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 10000 });
await shot("01_dashboard");

// 2. New quotation
await page.goto("http://localhost:3000/quotations/new", { waitUntil: "networkidle" });
await shot("02_new_quotation_empty");

await page.locator("main input").nth(0).fill("Nayaz Ahmed"); // customer name
await page.locator("main input").nth(1).fill("+91 98765 43210"); // phone
await page.locator("main input").nth(2).fill("Whitefield Villa"); // project

await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const numberInputs = page.locator('main input[type="number"]');
await numberInputs.nth(2).fill("4.5"); // billed width
await numberInputs.nth(3).fill("5"); // billed height
await numberInputs.nth(4).fill("8"); // qty
await shot("03_item_filled");

await page.locator('main input[type="checkbox"]').nth(3).check(); // enable GST
await shot("04_gst_enabled");

await page.locator('button:has-text("Save quotation")').click();
await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 10000 });
await shot("05_detail_page");

const detailUrl = page.url();
const quotationId = detailUrl.split("/").pop();
console.log("Created quotation id:", quotationId);

// 3. Print view
await page.goto(`http://localhost:3000/quotations/${quotationId}/print`, { waitUntil: "networkidle" });
await shot("06_print_view");

// 4. Quotations list
await page.goto("http://localhost:3000/quotations", { waitUntil: "networkidle" });
await shot("07_quotations_list");

// 5. Customers list
await page.goto("http://localhost:3000/customers", { waitUntil: "networkidle" });
await shot("08_customers_list");

// 6. Customer detail (click through)
await page.click("text=Nayaz Ahmed");
await page.waitForLoadState("networkidle");
await shot("09_customer_detail");

// 7. Edit the quotation
await page.goto(`http://localhost:3000/quotations/${quotationId}/edit`, { waitUntil: "networkidle" });
await shot("10_edit_page_prefilled");

// 8. Duplicate
await page.goto(`http://localhost:3000/quotations/${quotationId}`, { waitUntil: "networkidle" });
await page.click('button:has-text("Duplicate")');
await page.waitForURL(/\/quotations\/[a-f0-9]{24}\/edit$/, { timeout: 10000 });
await shot("11_duplicated_into_edit");

// 9. Rates page
await page.goto("http://localhost:3000/rates", { waitUntil: "networkidle" });
await shot("12_rates_page");

// 10. Settings page
await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
await shot("13_settings_page");

console.log("Errors:", errors.length ? "\n" + errors.join("\n") : "none");
await browser.close();
