# Demo runbook

Everything runs offline on this laptop. No internet needed.

## Start it (2 terminals)

**Terminal 1 — database** (leave it running):

```bash
cd royal-quote
node scripts/local-mongo.mjs
```

Wait for `Local MongoDB running at: ...`.

**Terminal 2 — the app**:

```bash
cd royal-quote
npm run start
```

Then open **http://localhost:3000**

> Use `npm run start` (the fast production build), not `npm run dev`.
> If you changed any code since the last demo, run `npm run build` once first.

## Login

Create the login yourself with the seed command — this repo is public, so no
working credential is committed to it:

```bash
npm run seed -- --email you@example.com --password "<pick-one>" --name "Your Name"
```

Re-run it any time with different values to add another user.

## Suggested 5-minute walkthrough

1. **Quotations → + New quotation**
2. Type a customer name and project (e.g. a real site they'd recognise)
3. Pick a product — **2.5 Track sliding window with fly mesh**
4. Enter the site measurement in **mm** and watch it convert to billed feet
   automatically, and the window **diagram redraw live** beside the row
5. Set Qty — the area and amount recalculate instantly
6. Tick a **surcharge** (e.g. one-way glass) — rate updates live
7. Tick **Apply GST** — CGST/SGST split appears, with amount in words
8. **+ Add item**, pick **Ventilator with fan point** — note it prices
   **per piece**, not per sqft, and the diagram changes shape
9. **Save quotation** — gets a real number like `RDW/26-27/0001`
10. **Print** → the branded green/gold A4 quotation with a diagram beside
    every line. Hit `Ctrl+P` → *Save as PDF* to show the deliverable.
11. Back → **Duplicate** — same measurements, new quote number, ready to
    re-price as a second option for the customer
12. **Customers** → click the customer → full quotation history
13. **Rate Master** (admin) → show that every price is controlled centrally

## Points worth making

- **Every price comes from one rate master**, so quotes can't drift between staff.
- **Tax is recalculated every time** — the old spreadsheets had copy-pasted GST
  values that didn't match their own totals on at least four real quotations.
- **Every quotation is numbered, searchable, and revisable** — the old files had
  no quote numbers at all.
- The **diagrams** are generated automatically from the sizes entered. Nothing is
  drawn by hand.

## Reset to a clean slate before the client arrives

```bash
node scripts/clear-test-data.mjs
```

Wipes quotations and customers only — keeps the rate card, settings and login.

## If something goes wrong

- **Port 3000 busy:** close the other terminal, or
  `npx kill-port 3000`
- **"MONGODB_URI is not set":** Terminal 1 isn't running — start the database first.
- **Login fails:** re-seed the user:
  ```bash
  npm run seed -- --email you@example.com --password "<pick-one>" --name "Your Name"
  ```
