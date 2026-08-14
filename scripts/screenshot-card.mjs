import { chromium } from "playwright";

const url = process.argv[2];
const type = process.argv[3];
const aspectLabel = process.argv[4];
const outPath = process.argv[5];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto(url, { waitUntil: "networkidle" });

const card = page.locator("div.rounded", { has: page.locator(`p:text-is("${type}")`) }).filter({
  has: page.locator(`p:text-is("${aspectLabel}")`),
});
await card.screenshot({ path: outPath });
await browser.close();
console.log("Saved", outPath);
