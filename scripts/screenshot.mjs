import { chromium } from "playwright";

const url = process.argv[2];
const outPath = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log("Saved screenshot to", outPath);
if (errors.length) {
  console.log("--- console errors ---");
  for (const e of errors) console.log(e);
} else {
  console.log("No console errors.");
}
