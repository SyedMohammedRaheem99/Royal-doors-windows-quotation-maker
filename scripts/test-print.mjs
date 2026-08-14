import { chromium } from "playwright";
import { readFileSync } from "fs";

const url = process.argv[2];
const outDir = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: "networkidle" });

// Screen-media screenshot for comparison
await page.screenshot({ path: `${outDir}\\print_screen.png`, fullPage: true });

// Emulate print media and screenshot again — this applies the @media print rules
await page.emulateMedia({ media: "print" });
await page.screenshot({ path: `${outDir}\\print_media.png`, fullPage: true });

// Generate an actual PDF respecting @page CSS (size: A4, margin: 0)
const pdfPath = `${outDir}\\quotation.pdf`;
await page.pdf({ path: pdfPath, printBackground: true });

const pdfBytes = readFileSync(pdfPath);
const pdfText = pdfBytes.toString("latin1");
const pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log("PDF generated:", pdfPath, `(${(pdfBytes.length / 1024).toFixed(0)} KB, ~${pageCount} page(s))`);

console.log("Console errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
