import { chromium } from "playwright";

const url = process.argv[2];
const [x, y, w, h] = process.argv.slice(3, 7).map(Number);
const outPath = process.argv[7];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: outPath, clip: { x, y, width: w, height: h } });
await browser.close();
console.log("Saved", outPath);
