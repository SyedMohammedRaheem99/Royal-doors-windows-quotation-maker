// Verifies the public share link — the one route that serves data to an
// unauthenticated visitor, so the checks here are mostly about what it must
// NOT do.
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const [, , email, password] = process.argv;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "royal_quote");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/dashboard", { timeout: 15000 });

// Create a quotation to share
await page.goto(`${BASE}/quotations/new`, { waitUntil: "networkidle" });
await page.locator("main input").nth(0).fill("Share Test Customer");
await page.locator("main input").nth(1).fill("9845012345");
await page.locator("main select").nth(0).selectOption({ label: "2 Track sliding window" });
const nums = page.locator('main input[type="number"]');
await nums.nth(2).fill("5");
await nums.nth(3).fill("4");
await page.locator('button:has-text("Save quotation")').click();
await page.waitForURL(/\/quotations\/[a-f0-9]{24}$/, { timeout: 15000 });
const quoteUrl = page.url();


// --- no link until explicitly created ---
await page.waitForSelector("text=Share with customer", { timeout: 10000 });
const before = await page.textContent("body");
check("no share link exists until one is created", before.includes("Create a private link"));

// --- create it ---
await page.locator('button:has-text("Create share link")').click();
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle" });

const doc = await db.collection("quotations").findOne({ share: { $exists: true } });
const token = doc?.share?.token;
check("a token was generated", Boolean(token));
check("token is long enough to resist guessing", (token?.length ?? 0) >= 40, `${token?.length} chars`);
check("token is URL-safe (base64url, no +/= padding)", /^[A-Za-z0-9_-]+$/.test(token ?? ""));
check("share link has an expiry", Boolean(doc?.share?.expiresAt));
check("view count starts at zero", doc?.share?.viewCount === 0);

const shared = await page.textContent("body");
check("UI shows a WhatsApp send button", shared.includes("Send on WhatsApp"));
check("UI reports the link has not been opened", shared.includes("Not opened yet"));

await page.screenshot({
  path: "C:/Users/muska/AppData/Local/Temp/claude/c--Users-muska-Downloads-Royal-doors-windows-quotation-maker/2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d/scratchpad/share_panel.png",
  fullPage: true,
});

// --- an ANONYMOUS visitor can open it ---
const anon = await browser.newContext();
const anonPage = await anon.newPage();
const anonResp = await anonPage.goto(`${BASE}/share/${token}`, { waitUntil: "networkidle" });
check("anonymous visitor can open the shared quotation", anonResp.status() === 200, `status ${anonResp.status()}`);

const anonBody = await anonPage.textContent("body");
check("shared page shows the quotation itself", anonBody.includes("Share Test Customer"));
check("shared page shows the branded document", anonBody.includes("ROYAL"));

// --- but must NOT be a way into the rest of the app ---
check("shared page exposes no app navigation", !anonBody.includes("Dashboard") && !anonBody.includes("Rate Master"));
check("shared page exposes no sign-out / session UI", !anonBody.includes("Sign out"));

const listResp = await anonPage.goto(`${BASE}/quotations`, { waitUntil: "networkidle" });
check(
  "anonymous visitor still cannot reach the quotations list",
  listResp.url().includes("/login"),
  listResp.url()
);

// --- noindex, so shared links never reach a search engine ---
const robots = await anonPage.goto(`${BASE}/share/${token}`, { waitUntil: "networkidle" });
const html = await robots.text();
check("shared page is marked noindex", /noindex/i.test(html));

// --- a bad token is refused, indistinguishably from a revoked one ---
const badResp = await anonPage.goto(`${BASE}/share/${"x".repeat(43)}`, { waitUntil: "networkidle" });
const badBody = await anonPage.textContent("body");
check("an unknown token is refused", badResp.status() === 404 || badBody.includes("no longer available"), `status ${badResp.status()}`);
check("the refusal does not reveal why", !badBody.includes("expired") || !badBody.includes("revoked"));

// --- views are counted ---
const afterViews = await db.collection("quotations").findOne({ "share.token": token });
check("views are recorded", (afterViews?.share?.viewCount ?? 0) >= 1, `count ${afterViews?.share?.viewCount}`);

// --- expiry is enforced ---
await db.collection("quotations").updateOne(
  { "share.token": token },
  { $set: { "share.expiresAt": new Date(Date.now() - 86400000) } }
);
const expiredResp = await anonPage.goto(`${BASE}/share/${token}`, { waitUntil: "networkidle" });
const expiredBody = await anonPage.textContent("body");
check(
  "an expired link stops working",
  expiredResp.status() === 404 || expiredBody.includes("no longer available"),
  `status ${expiredResp.status()}`
);

// --- revoking kills it immediately ---
await db.collection("quotations").updateOne(
  { "share.token": token },
  { $set: { "share.expiresAt": new Date(Date.now() + 86400000) } }
);
await page.goto(quoteUrl, { waitUntil: "networkidle" });
page.once("dialog", (d) => d.accept());
await page.locator('button:has-text("Revoke link")').click();
await page.waitForTimeout(1500);

const revokedResp = await anonPage.goto(`${BASE}/share/${token}`, { waitUntil: "networkidle" });
const revokedBody = await anonPage.textContent("body");
check(
  "a revoked link stops working immediately",
  revokedResp.status() === 404 || revokedBody.includes("no longer available"),
  `status ${revokedResp.status()}`
);

await browser.close();
await client.close();

console.log("Console errors:", errors.length ? errors.join("\n") : "none");
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
