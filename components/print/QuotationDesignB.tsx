import React from "react";
import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel } from "@/lib/dimensions";
import { groupItemsByRoom, usesRooms } from "@/lib/grouping";
import { formatINR, formatINRCompact } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { computePaymentStages, effectiveRate, SURCHARGES } from "@/lib/pricing";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering-pure";
import type { Quotation, Settings } from "@/models/schemas";

const SURCHARGE_LABELS: Record<string, string> = {
  nonWhiteOrOneWayGlass: `Non-white / one-way glass (+₹${SURCHARGES.nonWhiteOrOneWayGlass}/sq.ft)`,
  ssMesh: `SS mesh (+₹${SURCHARGES.ssMesh}/sq.ft)`,
  aluminiumTrack: `Aluminium track (+₹${SURCHARGES.aluminiumTrack}/sq.ft)`,
  frenchWindowDesign: `French window design (+₹${SURCHARGES.frenchWindowDesign}/sq.ft)`,
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/** Module-level header component so it is never recreated during render. */
function PageHeader({
  quoteNo,
  phone,
  email,
  website,
  showContact,
}: {
  quoteNo: string;
  phone: string;
  email: string;
  website: string;
  showContact: boolean;
}) {
  return (
    <>
      <div className="db-header-bar">
        <div className="db-logo-group">
          <div className="db-logo-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" />
          </div>
          <div>
            <div className="db-brand-name">ROYAL</div>
            <div className="db-brand-sub">Doors &amp; Windows</div>
          </div>
        </div>
        <div className="db-header-right">
          <div className="db-doc-type">QUOTATION</div>
          <div className="db-quote-no">{quoteNo}</div>
        </div>
      </div>
      {showContact && (
        <div className="db-contact-bar">
          {phone && <span>{formatPhone(phone)}</span>}
          {email && <span>{email}</span>}
          {website && <span>{website}</span>}
        </div>
      )}
    </>
  );
}

export function QuotationDesignB({
  quotation,
  settings,
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  preparedByName?: string | null;
}) {
  const date = new Date(quotation.date);
  const validUntil = new Date(date.getTime() + quotation.terms.validityDays * 86400000);
  const boiler = settings.terms.boilerplate;

  const pick = (re: RegExp) => boiler.find((line) => re.test(line)) ?? null;
  const meshLine = pick(/mesh screen/i);
  const reinforcementLine = pick(/reinforcement/i);
  const hardwareLine = pick(/premium hardware/i);
  const noWarrantyLine = pick(/no warranty|not covered under warranty/i);
  const siliconeLine = pick(/silicone/i);
  const measurementLine = pick(/final site measurement|approximate/i);

  const specLines = [
    quotation.terms.profile,
    meshLine,
    quotation.terms.glass,
    reinforcementLine,
    hardwareLine,
    siliconeLine,
  ].filter((line): line is string => Boolean(line));

  const coverageLines = [
    `${quotation.terms.warrantyYears}-year warranty on the uPVC profile (outer frame and shutters).`,
    noWarrantyLine,
  ].filter((line): line is string => Boolean(line));

  const conditionLines = [
    quotation.terms.workDuration
      ? `Work is completed within ${quotation.terms.workDuration.fromDays}–${quotation.terms.workDuration.toDays} days from the date of advance.`
      : null,
    measurementLine,
    ...quotation.terms.extraNotes,
  ].filter((line): line is string => Boolean(line));

  const paymentStages = computePaymentStages(
    quotation.terms.paymentScheme?.steps ?? [],
    quotation.totals.grandTotal
  );

  const roomGroups = groupItemsByRoom(quotation.items);

  // Summary stripe data
  const totalItems = quotation.items.length;
  const totalSqFt = quotation.items.reduce((sum, item) => sum + item.totalAreaSqft, 0);

  type RenderRow =
    | { type: "room"; room: string; subtotal: number }
    | { type: "item"; item: Quotation["items"][0]; displayIndex: number };

  const renderRows: RenderRow[] = [];
  if (usesRooms(quotation.items)) {
    roomGroups.forEach((group) => {
      renderRows.push({ type: "room", room: group.room, subtotal: group.subtotal });
      group.items.forEach((itemInfo) =>
        renderRows.push({ type: "item", item: itemInfo.item, displayIndex: itemInfo.displayIndex })
      );
    });
  } else {
    quotation.items.forEach((item, i) =>
      renderRows.push({ type: "item", item, displayIndex: i + 1 })
    );
  }

  // Page 1 is shorter — stripe + meta cards consume ~30mm extra space
  const MAX_FIRST_PAGE = 3;
  // Last item page needs space for totals block (~28mm); other middle pages use full capacity
  // We conservatively reduce ALL pages to 5 so the last one always has room for totals
  const MAX_N_PAGE = 5;

  const pages: RenderRow[][] = [];
  let currentPage: RenderRow[] = [];
  let currentHeight = 0;
  let isFirstPage = true;

  renderRows.forEach((row) => {
    const rowHeight = row.type === "room" ? 0.7 : 1;
    const max = isFirstPage ? MAX_FIRST_PAGE : MAX_N_PAGE;

    if (currentHeight + rowHeight > max && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
      isFirstPage = false;
    }

    currentPage.push(row);
    currentHeight += rowHeight;
  });
  if (currentPage.length > 0) pages.push(currentPage);

  const totalPages = pages.length + 1; // +1 for terms page

  const quoteNo = withRevisionSuffix(quotation.quoteNo, quotation.revision);

  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════
           DESIGN B — ROYAL CORPORATE   Rev 2
           Palette: Emerald #0B4D2E  ·  Gold #C9962A  ·  #E8B84B
           Zero blue. Brand-true. Industry-standard.
        ═══════════════════════════════════════════════════════ */

        .design-b-doc {
          --brand:        #0B4D2E;
          --brand-mid:    #1A6B3E;
          --accent:       #C9962A;
          --accent-lt:    #E8B84B;
          --warm:         #F5F2EC;
          --paper:        #FDFBF7;
          --ink:          #1A1A16;
          --ink-muted:    #5A5A4C;
          --ink-faint:    #9A9A88;
          --line:         #DDD8CC;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--ink);
          font-size: 9pt;
          line-height: 1.5;
        }

        /* ── A4 Sheet ── */
        .a4-sheet-b {
          width: 210mm;
          height: 297mm;
          background: var(--warm);
          margin: 0 auto 10mm auto;
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        @media print {
          .a4-sheet-b {
            margin: 0;
            box-shadow: none;
            height: 297mm;
            page-break-after: always;
          }
          @page { size: A4 portrait; margin: 0; }
        }

        /* ── Header Bar ── */
        .db-header-bar {
          /* Deep emerald rather than a flat mid-green — a subtle diagonal
             gradient toward --brand-mid gives the band some depth instead of
             reading as a single flat colour swatch. */
          background: linear-gradient(135deg, var(--brand) 0%, #072F1C 100%);
          padding: 7mm 15mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3pt solid var(--accent);
          flex-shrink: 0;
        }
        .db-logo-group { display: flex; align-items: center; gap: 4mm; }
        .db-logo-box {
          width: 17mm; height: 17mm;
          background: white;
          border-radius: 4px;
          padding: 1.5mm;
          display: flex; align-items: center; justify-content: center;
        }
        .db-logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .db-brand-name {
          font-size: 21pt;
          font-weight: 800;
          color: var(--accent-lt);
          letter-spacing: 0.14em;
          line-height: 1;
          font-family: Georgia, "Times New Roman", serif;
        }
        .db-brand-sub {
          font-size: 7pt;
          color: white;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-top: 1.5mm;
        }
        .db-header-right { text-align: right; }
        .db-doc-type {
          font-size: 17pt;
          font-weight: 800;
          color: white;
          letter-spacing: 0.08em;
          line-height: 1;
        }
        .db-quote-no {
          font-size: 8.5pt;
          color: var(--accent-lt);
          font-weight: 600;
          margin-top: 1.5mm;
          letter-spacing: 0.04em;
        }

        /* ── Contact Sub-bar ── */
        .db-contact-bar {
          background: white;
          padding: 2.5mm 15mm;
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          color: var(--ink-muted);
          border-bottom: 1px solid var(--line);
          flex-shrink: 0;
        }

        /* ── Body ── */
        .db-body {
          padding: 5mm 15mm 0 15mm;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* ── Section Title ── */
        .db-section-title {
          font-size: 9pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--brand);
          border-left: 3.5pt solid var(--accent);
          padding-left: 3mm;
          margin-bottom: 4mm;
          margin-top: 3mm;
        }

        /* ── Meta / Customer Cards ── */
        .db-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
          margin-bottom: 4mm;
        }
        .db-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-top: 2.5pt solid var(--accent);
          border-radius: 4px;
          padding: 3.5mm 4.5mm;
        }
        .db-card-title {
          font-size: 6.5pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--accent);
          margin-bottom: 3mm;
        }
        .db-customer-name {
          font-size: 11pt;
          font-weight: 800;
          color: var(--brand);
          margin-bottom: 2mm;
          line-height: 1.2;
        }
        .db-kv {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 3mm;
          row-gap: 1.5mm;
          font-size: 8pt;
        }
        .db-kv-lab { color: var(--ink-muted); font-weight: 600; white-space: nowrap; }
        .db-kv-val { color: var(--ink); font-weight: 600; }

        /* ── Summary Stripe ── */
        .db-stripe {
          background: var(--brand);
          border-radius: 5px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          margin-bottom: 4mm;
          overflow: hidden;
          border: 1px solid rgba(201,150,42,0.35);
        }
        .db-stripe-cell {
          padding: 3.5mm 4mm;
          text-align: center;
          border-right: 1px solid rgba(201,150,42,0.22);
        }
        .db-stripe-cell:last-child { border-right: none; }
        .db-stripe-label {
          font-size: 6pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--accent-lt);
          opacity: 0.8;
          margin-bottom: 1mm;
        }
        .db-stripe-value {
          font-size: 14pt;
          font-weight: 800;
          color: white;
          line-height: 1.1;
        }
        .db-stripe-unit {
          font-size: 6.5pt;
          color: rgba(232,184,75,0.65);
          margin-top: 0.5mm;
        }

        /* ── Product Table ── */
        .db-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid var(--line);
          border-radius: 4px;
          overflow: hidden;
        }
        .db-table th {
          background: var(--brand);
          color: white;
          font-size: 7pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          padding: 3mm 3mm;
          text-align: left;
          border-bottom: 2.5pt solid var(--accent);
        }
        .db-table td {
          padding: 3.5mm 3mm;
          vertical-align: top;
          border-bottom: 1px solid var(--line);
          border-right: 1px solid var(--line);
          font-size: 8.5pt;
        }
        .db-table td:last-child { border-right: none; }
        .db-table tbody tr:nth-child(even) td { background: #F5F2EC; }

        .db-room-row td {
          background: rgba(11,77,46,0.06) !important;
          color: var(--brand);
          font-weight: 800;
          font-size: 7.5pt;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2.5mm 3mm;
          border-left: 3pt solid var(--accent);
        }

        .db-desc-flex { display: flex; gap: 3.5mm; }
        .db-diag-box {
          width: 23mm; height: 23mm;
          background: white;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 1mm;
          flex-shrink: 0;
        }
        .db-diag-box > * { width: 100%; height: 100%; }
        .db-prod-name {
          font-size: 9pt;
          font-weight: 800;
          color: var(--brand);
          text-transform: uppercase;
          margin-bottom: 1.5mm;
        }
        .db-spec-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 2mm;
          row-gap: 1mm;
          font-size: 7.5pt;
        }
        .db-spec-k {
          color: var(--ink-faint);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 6.5pt;
        }
        .db-spec-v { color: var(--ink-muted); }

        /* ── Totals Block (Last Item Page) ── */
        .db-totals-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 4mm;
        }
        .db-totals-box {
          width: 46%;
          background: white;
          border: 1px solid var(--line);
          border-radius: 4px;
          overflow: hidden;
        }
        .db-tot-row {
          display: flex;
          justify-content: space-between;
          padding: 2.5mm 4mm;
          font-size: 8.5pt;
          border-bottom: 1px solid var(--line);
          color: var(--ink-muted);
        }
        .db-tot-val { font-weight: 700; color: var(--ink); }
        .db-tot-grand {
          background: var(--brand);
          color: white;
          padding: 3.5mm 4mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5pt;
          font-weight: 800;
        }
        .db-tot-grand-amt {
          color: var(--accent-lt);
          font-size: 14pt;
          font-weight: 900;
        }
        .db-words {
          font-size: 7.5pt;
          color: var(--ink-faint);
          font-style: italic;
          text-align: right;
          margin-top: 1.5mm;
          margin-bottom: 2mm;
          padding-right: 1mm;
        }

        /* ── Footer ── */
        .db-footer {
          background: var(--brand);
          color: white;
          padding: 3.5mm 15mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7pt;
          letter-spacing: 0.07em;
          border-top: 2.5pt solid var(--accent);
          flex-shrink: 0;
          margin-top: auto;
        }
        .db-footer-caps {
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
          display: flex;
          gap: 4mm;
        }
        .db-footer-page { color: var(--accent-lt); font-weight: 700; font-size: 7.5pt; }

        /* ════════════════════════════════════
           TERMS PAGE
        ════════════════════════════════════ */

        /* FAQ Cards */
        .db-faq-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
          margin-bottom: 4mm;
        }
        .db-faq-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-top: 2.5pt solid var(--accent);
          border-radius: 4px;
          padding: 3.5mm 4mm;
        }
        .db-faq-q {
          font-size: 7.5pt;
          font-weight: 800;
          color: var(--brand);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 2.5mm;
          display: flex;
          align-items: flex-start;
          gap: 2mm;
        }
        .db-faq-dot {
          width: 3.5mm; height: 3.5mm;
          background: var(--accent);
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 0.5mm;
        }
        .db-faq-body {
          margin: 0;
          padding-left: 5.5mm;
          font-size: 7.5pt;
          color: var(--ink-muted);
          line-height: 1.65;
          list-style: none;
        }
        .db-faq-body li { margin-bottom: 0.5mm; }
        .db-faq-body li::before { content: "—  "; color: var(--accent); font-weight: 700; }

        /* Payment + Bank 2-col */
        .db-pb-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
          margin-bottom: 5mm;
        }

        /* Payment steps */
        .db-pay-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8pt;
          padding: 2mm 0;
          border-bottom: 1px dashed var(--line);
        }
        .db-pay-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 4.5mm; height: 4.5mm;
          background: var(--brand);
          color: white;
          border-radius: 50%;
          font-size: 6.5pt;
          font-weight: 800;
          margin-right: 1.5mm;
          flex-shrink: 0;
        }
        .db-pay-amt { font-weight: 700; color: var(--brand); }

        /* Bank card */
        .db-bank-hdr {
          background: var(--brand);
          color: white;
          font-size: 7pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          padding: 2.5mm 4.5mm;
          margin: -3.5mm -4.5mm 3mm -4.5mm;
          border-radius: 2px 2px 0 0;
        }
        .db-bank-row {
          display: grid;
          grid-template-columns: 19mm 1fr;
          font-size: 8pt;
          padding: 1.5mm 0;
          border-bottom: 1px solid var(--line);
          align-items: baseline;
        }
        .db-bank-row:last-child { border-bottom: none; }
        .db-bank-lbl { color: var(--ink-faint); font-weight: 600; }
        .db-bank-val { font-weight: 700; color: var(--ink); }
        .db-bank-acno { font-size: 9.5pt; font-weight: 800; color: var(--brand); letter-spacing: 0.04em; }
        .db-bank-upi  { font-size: 8pt; font-weight: 700; color: var(--brand-mid); }
        .db-bank-gold-bar {
          border-top: 2pt solid var(--accent);
          margin: 2mm -4.5mm -3.5mm -4.5mm;
        }

        /* Dual Signatory */
        .db-sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 7mm;
          margin-bottom: 6mm;
        }
        .db-sig-box { width: 66mm; }
        .db-sig-space { height: 13mm; }
        .db-sig-line {
          border-top: 1.5pt solid var(--brand);
          padding-top: 2mm;
          font-size: 7.5pt;
          font-weight: 800;
          color: var(--brand);
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }
        .db-sig-sub {
          font-size: 7pt;
          color: var(--ink-muted);
          margin-top: 0.5mm;
        }

        /* Thank You Closing */
        .db-closing {
          background: linear-gradient(120deg, var(--brand) 0%, var(--brand-mid) 100%);
          border-radius: 6px;
          text-align: center;
          padding: 5mm 10mm;
          border: 1px solid rgba(201,150,42,0.45);
        }
        .db-closing-text {
          font-family: Georgia, "Times New Roman", serif;
          font-style: italic;
          font-size: 13pt;
          color: var(--accent-lt);
          letter-spacing: 0.02em;
          line-height: 1.4;
        }
      `}</style>

      <div className="design-b-doc">
        {/* ════════════════ ITEM PAGES ════════════════ */}
        {pages.map((pageRows, pageIndex) => (
          <div key={pageIndex} className="a4-sheet-b">
            <PageHeader
              quoteNo={quoteNo}
              phone={settings.phone}
              email={settings.email}
              website={settings.website}
              showContact={pageIndex === 0}
            />

            <div className="db-body">
              {/* ── Page 1: Quotation & Customer Cards ── */}
              {pageIndex === 0 && (
                <div className="db-meta-grid">
                  {/* Quotation Details */}
                  <div className="db-card">
                    <div className="db-card-title">Quotation Details</div>
                    <div className="db-kv">
                      <span className="db-kv-lab">Quotation No:</span>
                      <span className="db-kv-val">
                        {withRevisionSuffix(quotation.quoteNo, quotation.revision)}
                      </span>
                      <span className="db-kv-lab">Date:</span>
                      <span className="db-kv-val">{formatDate(date)}</span>
                      <span className="db-kv-lab">Valid Until:</span>
                      <span className="db-kv-val">{formatDate(validUntil)}</span>
                      {settings.gstin && (
                        <>
                          <span className="db-kv-lab">GSTIN:</span>
                          <span className="db-kv-val">{settings.gstin}</span>
                        </>
                      )}
                      {settings.addressLines.length > 0 && (
                        <>
                          <span className="db-kv-lab">Address:</span>
                          <span className="db-kv-val">{settings.addressLines.join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Customer / Project */}
                  <div className="db-card">
                    <div className="db-card-title">Prepared For</div>
                    <div className="db-customer-name">{quotation.customer.name}</div>
                    <div className="db-kv">
                      {quotation.customer.phone && (
                        <>
                          <span className="db-kv-lab">Phone:</span>
                          <span className="db-kv-val">
                            {formatPhone(quotation.customer.phone)}
                          </span>
                        </>
                      )}
                      {quotation.customer.project && (
                        <>
                          <span className="db-kv-lab">Project:</span>
                          <span className="db-kv-val">{quotation.customer.project}</span>
                        </>
                      )}
                      {quotation.customer.siteAddress && (
                        <>
                          <span className="db-kv-lab">Site:</span>
                          <span className="db-kv-val">{quotation.customer.siteAddress}</span>
                        </>
                      )}
                      {quotation.customer.referredBy && (
                        <>
                          <span className="db-kv-lab">Referred By:</span>
                          <span className="db-kv-val">{quotation.customer.referredBy}</span>
                        </>
                      )}
                      {preparedByName && (
                        <>
                          <span className="db-kv-lab">Prepared By:</span>
                          <span className="db-kv-val">{preparedByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Summary Stripe (Page 1 only) ── */}
              {pageIndex === 0 && (
                <div className="db-stripe">
                  <div className="db-stripe-cell">
                    <div className="db-stripe-label">Total Items</div>
                    <div className="db-stripe-value">{totalItems}</div>
                    <div className="db-stripe-unit">line items</div>
                  </div>
                  <div className="db-stripe-cell">
                    <div className="db-stripe-label">Total Area</div>
                    <div className="db-stripe-value">{totalSqFt.toFixed(1)}</div>
                    <div className="db-stripe-unit">sq. ft.</div>
                  </div>
                  <div className="db-stripe-cell">
                    <div className="db-stripe-label">Grand Total</div>
                    <div className="db-stripe-value">{formatINR(quotation.totals.grandTotal)}</div>
                    <div className="db-stripe-unit">incl. all charges</div>
                  </div>
                </div>
              )}

              <div className="db-section-title">Product &amp; Price Schedule</div>

              {/* ── Product Table ── */}
              <table className="db-table">
                <thead>
                  <tr>
                    <th style={{ width: "5%", textAlign: "center" }}>S.No</th>
                    <th style={{ width: "50%" }}>Product Description</th>
                    <th style={{ width: "12%", textAlign: "center" }}>Size (ft)</th>
                    <th style={{ width: "7%", textAlign: "center" }}>Qty</th>
                    <th style={{ width: "12%", textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, rIdx) => {
                    if (row.type === "room") {
                      return (
                        <tr key={`room-${rIdx}`} className="db-room-row">
                          <td colSpan={6}>
                            {row.room || "General"}
                            <span
                              style={{
                                float: "right",
                                fontWeight: 600,
                                color: "var(--ink-muted)",
                              }}
                            >
                              Room Subtotal: {formatINR(row.subtotal)}
                            </span>
                          </td>
                        </tr>
                      );
                    } else {
                      const item = row.item;
                      return (
                        <tr key={item.id}>
                          <td
                            style={{
                              textAlign: "center",
                              color: "var(--ink-muted)",
                              fontWeight: 700,
                            }}
                          >
                            {row.displayIndex}
                          </td>
                          <td>
                            <div className="db-desc-flex">
                              <div className="db-diag-box">
                                <WindowDiagram
                                  type={item.diagram.type}
                                  widthFt={item.billed.w}
                                  heightFt={item.billed.h}
                                  handing={item.diagram.handing}
                                  fanPoint={item.diagram.fanPoint}
                                  showDimensions={false}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div className="db-prod-name">{item.description}</div>
                                <div className="db-spec-grid">
                                  {item.specs.profile && (
                                    <>
                                      <span className="db-spec-k">Profile</span>
                                      <span className="db-spec-v">{item.specs.profile}</span>
                                    </>
                                  )}
                                  {item.specs.glass && (
                                    <>
                                      <span className="db-spec-k">Glass</span>
                                      <span className="db-spec-v">
                                        {item.specs.glass} {item.specs.glassThickness}
                                      </span>
                                    </>
                                  )}
                                  {item.specs.hardware && (
                                    <>
                                      <span className="db-spec-k">Hardware</span>
                                      <span className="db-spec-v">{item.specs.hardware}</span>
                                    </>
                                  )}
                                  {item.specs.mesh && (
                                    <>
                                      <span className="db-spec-k">Mesh</span>
                                      <span className="db-spec-v">{item.specs.mesh}</span>
                                    </>
                                  )}
                                  {item.specs.colour && (
                                    <>
                                      <span className="db-spec-k">Color</span>
                                      <span className="db-spec-v">{item.specs.colour}</span>
                                    </>
                                  )}
                                  {item.surcharges.map((key) => (
                                    <React.Fragment key={key}>
                                      <span className="db-spec-k">Add-on</span>
                                      <span className="db-spec-v">
                                        {SURCHARGE_LABELS[key] ?? key}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {feetToArchLabel(item.billed.w)} × {feetToArchLabel(item.billed.h)}
                          </td>
                          <td style={{ textAlign: "center" }}>{item.qty}</td>
                          <td style={{ textAlign: "right" }}>
                            {formatINRCompact(effectiveRate(item))}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {formatINR(item.amount)}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>

              {/* ── Totals Block — Only on Last Item Page ── */}
              {pageIndex === pages.length - 1 && (
                <>
                  <div className="db-totals-wrap">
                    <div className="db-totals-box">
                      <div className="db-tot-row">
                        <span>Product Subtotal</span>
                        <span className="db-tot-val">{formatINR(quotation.totals.subtotal)}</span>
                      </div>
                      {quotation.gst.enabled && (
                        <div className="db-tot-row">
                          <span>GST @{quotation.gst.rate}%</span>
                          <span className="db-tot-val">
                            {formatINR(quotation.totals.cgst + quotation.totals.sgst)}
                          </span>
                        </div>
                      )}
                      {quotation.totals.transportation > 0 && (
                        <div className="db-tot-row">
                          <span>Transportation &amp; Handling</span>
                          <span className="db-tot-val">
                            {formatINR(quotation.totals.transportation)}
                          </span>
                        </div>
                      )}
                      <div className="db-tot-grand">
                        <span>Grand Total</span>
                        <span className="db-tot-grand-amt">
                          {formatINR(quotation.totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="db-words">
                    Rupees {amountInWords(quotation.totals.grandTotal)} Only.
                  </div>
                </>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="db-footer">
              <div className="db-footer-caps">
                <span>Sound Insulation</span>
                <span>·</span>
                <span>Weather Resistant</span>
                <span>·</span>
                <span>Energy Efficient</span>
              </div>
              <span className="db-footer-page">
                Page {pageIndex + 1} of {totalPages}
              </span>
            </div>
          </div>
        ))}

        {/* ════════════════ TERMS & CONDITIONS PAGE ════════════════ */}
        <div className="a4-sheet-b">
          <PageHeader
            quoteNo={quoteNo}
            phone={settings.phone}
            email={settings.email}
            website={settings.website}
            showContact={false}
          />

          <div className="db-body">
            <div className="db-section-title">Terms &amp; Commercial Conditions</div>

            {/* ── FAQ Cards (2×2) ── */}
            <div className="db-faq-grid">
              {/* Card 1: What's Included */}
              <div className="db-faq-card">
                <div className="db-faq-q">
                  <div className="db-faq-dot" />
                  What Is Included in This Quote?
                </div>
                <ul className="db-faq-body">
                  {specLines.length > 0 ? (
                    specLines.map((line, i) => <li key={i}>{line}</li>)
                  ) : (
                    <li>As specified in the product descriptions above.</li>
                  )}
                </ul>
              </div>

              {/* Card 2: Warranty */}
              <div className="db-faq-card">
                <div className="db-faq-q">
                  <div className="db-faq-dot" />
                  Warranty &amp; After-Sales Coverage
                </div>
                <ul className="db-faq-body">
                  {coverageLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              {/* Card 3: Commercial Conditions */}
              <div className="db-faq-card">
                <div className="db-faq-q">
                  <div className="db-faq-dot" />
                  Commercial Conditions
                </div>
                <ul className="db-faq-body">
                  <li>
                    This quotation is valid for {quotation.terms.validityDays} days from
                    date of issue.
                  </li>
                  <li>
                    All measurements are to be confirmed at site prior to fabrication.
                  </li>
                  <li>
                    Any changes in dimensions, design, or specifications will affect the
                    final price.
                  </li>
                  {conditionLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              {/* Card 4: Pricing & Validity */}
              <div className="db-faq-card">
                <div className="db-faq-q">
                  <div className="db-faq-dot" />
                  Pricing &amp; Validity
                </div>
                <ul className="db-faq-body">
                  <li>
                    Valid for {quotation.terms.validityDays} days from {formatDate(date)}.
                  </li>
                  {quotation.gst.enabled ? (
                    <li>
                      GST @{quotation.gst.rate}% is included in the Grand Total of{" "}
                      {formatINR(quotation.totals.grandTotal)}.
                    </li>
                  ) : (
                    <li>This quotation is exclusive of GST unless stated otherwise.</li>
                  )}
                  <li>Prices are subject to revision after the validity period.</li>
                </ul>
              </div>
            </div>

            {/* ── Payment Milestones + Bank Details ── */}
            <div className="db-pb-grid">
              {/* Payment Schedule */}
              <div className="db-card">
                <div className="db-card-title">Payment Milestone Schedule</div>
                {paymentStages.map((stage, i) => (
                  <div key={i} className="db-pay-row">
                    <span>
                      <span className="db-pay-num">{i + 1}</span>
                      {stage.text}
                    </span>
                    <span className="db-pay-amt">
                      {stage.amount !== null ? formatINR(stage.amount) : ""}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bank Details */}
              <div className="db-card" style={{ paddingTop: 0 }}>
                <div className="db-bank-hdr">Bank Transfer Details</div>
                <div className="db-bank-row">
                  <span className="db-bank-lbl">Account</span>
                  <span className="db-bank-val">
                    {settings.bank?.accountName || settings.companyName}
                  </span>
                </div>
                <div className="db-bank-row">
                  <span className="db-bank-lbl">Bank</span>
                  <span className="db-bank-val">
                    {settings.bank?.bankName || "YES BANK"}
                  </span>
                </div>
                <div className="db-bank-row">
                  <span className="db-bank-lbl">A/C No.</span>
                  <span className="db-bank-acno">{settings.bank?.accountNo}</span>
                </div>
                <div className="db-bank-row">
                  <span className="db-bank-lbl">IFSC</span>
                  <span className="db-bank-val">{settings.bank?.ifsc}</span>
                </div>
                <div className="db-bank-row">
                  <span className="db-bank-lbl">Branch</span>
                  <span className="db-bank-val">{settings.bank?.branch}</span>
                </div>
                {settings.bank?.upiPhone && (
                  <div className="db-bank-row">
                    <span className="db-bank-lbl">UPI</span>
                    <span className="db-bank-upi">{settings.bank.upiPhone}</span>
                  </div>
                )}
                <div className="db-bank-gold-bar" />
              </div>
            </div>

            {/* ── Dual Signatory ── */}
            <div className="db-sig-row">
              <div className="db-sig-box">
                <div className="db-sig-space" />
                <div className="db-sig-line">Customer Signature</div>
                <div className="db-sig-sub">Name &amp; Date</div>
              </div>
              <div className="db-sig-box" style={{ textAlign: "right" }}>
                <div className="db-sig-space" />
                <div className="db-sig-line">For {settings.companyName}</div>
                <div className="db-sig-sub">Authorised Signatory</div>
              </div>
            </div>

            {/* ── Thank You Closing ── */}
            <div className="db-closing">
              <div className="db-closing-text">
                Thank you for choosing Royal Doors &amp; Windows.
              </div>
            </div>
          </div>

          <div className="db-footer">
            <div className="db-footer-caps">
              Royal Doors &amp; Windows · Official Business Proposal
            </div>
            <span className="db-footer-page">
              Page {totalPages} of {totalPages}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
