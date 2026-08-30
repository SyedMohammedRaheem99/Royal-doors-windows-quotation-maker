// Reads the real generated PDF's text, page by page, using pdf.js — the same
// engine browsers use. Replaces hand-rolled stream decoding, which silently
// merged six subset-font cmaps and produced garbage.
import { readFileSync } from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(readFileSync(process.argv[2]));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log("pages:", doc.numPages);
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const txt = (await page.getTextContent()).items.map((x) => x.str).join(" ").replace(/\s+/g, " ");
  const m = txt.match(/Page\s*\d+\s*of\s*\d+/);
  console.log(`  page ${i}: ${m ? "FOUND -> " + m[0] : "no page-number text"}  (chars ${txt.length})`);
  if (process.argv[3] === "-v") console.log("      tail:", txt.slice(-120));
}
