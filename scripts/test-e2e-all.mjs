// Runs every browser-based suite in sequence against a running server.
// Unit tests (npm test) don't need a server; these do, so they're kept
// separate rather than wired into `npm run verify`.
//
// Usage:
//   npm run test:e2e -- admin@test.local AdminPass123 sales@test.local SalesPass123
//
// Optionally append super-admin credentials to also run the three-tier
// hierarchy suite, which needs all three roles:
//   npm run test:e2e -- <adminEmail> <adminPass> <workerEmail> <workerPass> <superEmail> <superPass>
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const [, , adminEmail, adminPass, salesEmail, salesPass, superEmail, superPass] = process.argv;

if (!adminEmail || !adminPass || !salesEmail || !salesPass) {
  console.error(
    "Usage: npm run test:e2e -- <adminEmail> <adminPass> <workerEmail> <workerPass> [superEmail] [superPass]\n" +
      "The super admin is created by: npm run seed -- --email ... --password ... --name ...\n" +
      "Admin and worker accounts are then created from the app's Users screen."
  );
  process.exit(1);
}

const SCRATCH =
  "C:/Users/muska/AppData/Local/Temp/claude/c--Users-muska-Downloads-Royal-doors-windows-quotation-maker/2c9d7e1c-30ca-43c9-a3cc-cf357dd5324d/scratchpad";

const suites = [
  { name: "authorization", script: "test-authz.mjs", args: [SCRATCH, adminEmail, adminPass, salesEmail, salesPass] },
  { name: "customer scoping", script: "test-customer-scoping.mjs", args: [adminEmail, adminPass, salesEmail, salesPass] },
  { name: "unique indexes", script: "test-indexes.mjs", args: [] },
  { name: "pagination", script: "test-pagination.mjs", args: [adminEmail, adminPass] },
  { name: "dashboard", script: "test-dashboard.mjs", args: [adminEmail, adminPass] },
  { name: "payments", script: "test-payments.mjs", args: [adminEmail, adminPass] },
  { name: "tax invoices", script: "test-invoices.mjs", args: [adminEmail, adminPass] },
  { name: "public sharing", script: "test-sharing.mjs", args: [adminEmail, adminPass] },
  { name: "full user journey", script: "e2e-test.mjs", args: [SCRATCH] },
];

// Needs all three tiers, so it only runs when super-admin credentials are
// supplied. Proves the client's headline rule: a super admin's quotations are
// invisible to admins and workers, and an admin's are invisible to workers.
if (superEmail && superPass) {
  suites.push({
    name: "role hierarchy",
    script: "test-hierarchy.mjs",
    args: [SCRATCH, superEmail, superPass, adminEmail, adminPass, salesEmail, salesPass],
  });
} else {
  console.log("(skipping the role-hierarchy suite — pass <superEmail> <superPass> to include it)\n");
}

function run(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, script), ...args], { stdio: "inherit" });
    child.on("close", (code) => resolve(code === 0));
  });
}

const failures = [];
for (const suite of suites) {
  console.log(`\n${"=".repeat(60)}\n  ${suite.name}\n${"=".repeat(60)}`);
  const ok = await run(suite.script, suite.args);
  if (!ok) failures.push(suite.name);
}

console.log(`\n${"=".repeat(60)}`);
if (failures.length === 0) {
  console.log(`All ${suites.length} browser suites passed.`);
} else {
  console.log(`FAILED (${failures.length}/${suites.length}): ${failures.join(", ")}`);
  process.exit(1);
}
