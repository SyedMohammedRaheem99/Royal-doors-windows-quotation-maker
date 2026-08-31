import React from "react";
import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel } from "@/lib/dimensions";
import { formatINR, formatINRCompact } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { computePaymentStages, effectiveRate, SURCHARGES } from "@/lib/pricing";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering-pure";
import type { Quotation, Settings } from "@/models/schemas";
import { PrintButton } from "./PrintButton";

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
          {/* Full lockup asset (icon + ROYAL + DOORS & WINDOWS + tagline) —
              replaces the separate circular badge + typeset text. Its own
              background is the same deep emerald as .db-header-bar, so it
              sits flush with no visible edge. eslint-disable-next-line
              @next/next/no-img-element -- print document renders outside
              next/image's optimization pipeline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/navlogo_final.png" alt="Royal Doors & Windows" className="db-navlogo" />
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

  // Summary stripe data
  const totalItems = quotation.items.length;
  const totalSqFt = quotation.items.reduce((sum, item) => sum + item.totalAreaSqft, 0);

  /**
   * Room/category grouping (Living Room / Bathroom / Entrance headers with
   * per-room subtotals) was removed from the printed schedule at the
   * client's request — plain product-wise numbering only, for now. The
   * underlying data (lib/grouping.ts, each item's .room field) is untouched;
   * this only affects how the print table is rendered. See
   * FUTURE-IDEAS.md's "Room / area grouping" entry for how to bring it back.
   */
  type RenderRow = { type: "item"; item: Quotation["items"][0]; displayIndex: number };
  const renderRows: RenderRow[] = quotation.items.map((item, i) => ({
    type: "item",
    item,
    displayIndex: i + 1,
  }));

  /**
   * Pagination is NOT computed here. An earlier version bucketed rows into
   * pages by a guessed row count (3 on page 1, 5 on later pages) and rendered
   * each bucket into its own fixed-height, overflow:hidden A4 sheet. That
   * broke the moment a row was taller than the guess — verified with a real
   * quotation: a long product description + spec list clipped mid-word at the
   * bottom of the sheet, with the row's amount and the page footer clipped
   * away entirely. A row-count budget has no relationship to the actual
   * rendered height of that row's content.
   *
   * Instead the whole document is one continuous flow (no per-page wrapper
   * divs, no fixed heights) and the BROWSER paginates it, exactly like the
   * previously-shipped single-design document that was verified across
   * 1/5/14/25/50-item quotations plus long-text stress cases with zero
   * clipping. `break-inside: avoid` on each row/section is what keeps content
   * from tearing across a page boundary; `@page` margin boxes carry the
   * repeating letterhead, contact line and page number (a `position: fixed`
   * header does NOT repeat across pages in Chrome's print output — proven
   * earlier by reading the generated PDF's own text).
   */

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

        /* ── Document sheet ──
           A single continuous flow, not one fixed-height div per page. On
           screen it is boxed and shadowed to look like an A4 sheet; in print
           it becomes the natural page content and the browser paginates it —
           no height is ever imposed on it, so nothing can be clipped by an
           overflow:hidden boundary the way the old per-page wrapper did. */
        .a4-sheet-b {
          width: 210mm;
          min-height: 297mm;
          background: var(--warm);
          margin: 0 auto 10mm auto;
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        @media print {
          .a4-sheet-b { margin: 0; box-shadow: none; width: auto; min-height: auto; }
          .no-print { display: none !important; }
          .db-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .db-table tr { break-inside: avoid; page-break-inside: avoid; }
          .db-table thead { display: table-header-group; }

          /* Repeating letterhead + footer on every printed page via @page
             margin boxes. A position:fixed element does NOT repeat across
             pages in Chrome's print/PDF output — verified earlier by decoding
             the actual generated PDF's text, where a fixed header painted on
             page 1 only. Margin boxes are the mechanism proven to repeat. */
          @page {
            size: A4 portrait;
            /* 13mm is enough for a single-line running letterhead; the
               original 30mm reservation left content only 251mm to work with
               on continuation pages and pushed a lightweight closing footer
               (~12mm of content) onto its own extra page for even a 1-item
               quotation. */
            margin: 13mm 15mm 10mm;
            @top-left {
              content: "ROYAL DOORS & WINDOWS";
              font-family: Georgia, "Times New Roman", serif;
              font-size: 9pt;
              font-weight: 700;
              color: #0B4D2E;
            }
            @top-right {
              content: "${quoteNo} · ${(quotation.customer.name ?? "").replace(/"/g, "'")}";
              font-family: -apple-system, "Segoe UI", sans-serif;
              font-size: 8pt;
              color: #5A5A4C;
            }
            @bottom-left {
              content: "Royal Doors & Windows · Official Business Proposal";
              font-family: -apple-system, "Segoe UI", sans-serif;
              font-size: 7pt;
              color: #5A5A4C;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: -apple-system, "Segoe UI", sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              color: #C9962A;
            }
          }
          /* Page 1 carries the full letterhead band in the flow, so it needs
             no reserved top margin and no running header there. */
          @page :first {
            margin: 0 15mm 10mm;
            @top-left { content: ""; }
            @top-right { content: ""; }
          }
        }

        /* ── Header Bar (page 1 only — the full letterhead band) ── */
        .db-header-bar {
          /* Flat colour, matched exactly (not approximately) to the logo
             lockup's own baked-in background — #023F28, sampled directly
             from navlogo_final.png. A gradient here was tried first, but a
             flat-background logo image can only ever match ONE point along a
             gradient's transition; confirmed visually at high resolution
             that even a close numeric colour match (~7 units off) still read
             as a visible seam once the gradient lightened away from it. Flat
             + exact match removes the seam entirely rather than minimising
             it. See the "decorative accent" rule just below this block,
             which restores some visual depth without reintroducing a
             gradient. */
          background: #023F28;
          padding: 7mm 15mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3pt solid var(--accent);
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
        }
        /* Subtle depth without a gradient (which is what caused the seam):
           a soft radial highlight derived from the header's OWN flat colour
           at low opacity, so it can never mismatch anything the way an
           external asset or an independent gradient could. Faint enough to
           read as ambient light, not a visible shape. */
        .db-header-bar::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 100% at 15% 0%, rgba(201,150,42,0.10) 0%, transparent 60%);
          pointer-events: none;
        }
        .db-logo-group { display: flex; align-items: center; }
        /* The client's finished lockup asset (icon + ROYAL + DOORS & WINDOWS
           + tagline) replaces the separate circular badge + typeset text
           combination this used to be.

           An earlier version of this asset (navlogo.png, #001C13 flat
           background) visibly clashed with .db-header-bar's gradient
           (#0B4D2E -> #072F1C) — confirmed with a pixel sample, it showed up
           as a dark rectangular seam rather than blending in. This file
           (navlogo_final.png, #023F28) was re-exported with a background
           colour picked from partway along that same gradient — sampled at
           ~7 units of colour distance from the closest point on the
           gradient, close enough that no visible edge remains. No white box
           or border needed around it; it sits directly on the header.

           Height-constrained with auto width so the 1942x809 (~2.4:1) source
           keeps its aspect ratio; ~19mm is what the header's own vertical
           padding (7mm top+bottom) leaves for content, matching the height
           the previous icon+text lockup occupied. */
        /* 19mm -> 22.8mm (+20%) -> 31.9mm (+40% more, requested after seeing
           it in place twice). Header uses align-items:center with its own
           vertical padding, so it grows to fit this rather than clipping
           it — verify the header height and page count regression after any
           further increase here, since this is now a meaningfully bigger
           element than the header's original design budget. */
        .db-navlogo { height: 31.9mm; width: auto; display: block; }
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
          /* Restored to 5mm. This was trimmed to 2mm during the pagination
             fix, which squeezed the gap under the contact bar down to 2mm —
             visibly cramped ("leaking space" reduced too far). The
             pagination bug that trim was chasing is now fixed structurally
             (per-card avoid-break instead of one large forced-break block),
             so this space is no longer needed for that and can go back to a
             proper breathing gap. */
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
          /* Restored to 4mm — trimmed to 2.5mm for the same now-obsolete
             reason as the other spacing changes above. */
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
          /* Restored to 4mm — trimmed to 2mm for the same now-obsolete
             reason as .db-body's padding above. */
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

        /* ── Closing band ──
           A single band at the very end of the document (not repeated per
           page — the real per-page footer is the @page @bottom-left/@bottom-
           right margin boxes in the print media query above, which DO repeat
           correctly). Carries the same tagline the old per-page footer did. */
        .db-footer {
          background: var(--brand);
          color: white;
          padding: 3.5mm 15mm;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 7pt;
          letter-spacing: 0.07em;
          border-top: 2.5pt solid var(--accent);
          margin-top: 6mm;
        }
        .db-footer-caps {
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2.5mm;
        }

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

        /* Thank You Closing — no box. The solid green banner was one more
           green block on a page that already has the header, stripe, section
           bars and the gold footer all in green/gold; removed the
           background/border/padding entirely so it reads as a quiet closing
           line on the page's own cream background instead of another
           banner. Text colour switched from gold (which needs a dark
           background to read) to the brand green, which is legible directly
           on --warm cream and matches the ink colour used everywhere else on
           the page. */
        .db-closing {
          text-align: center;
          padding: 3mm 10mm;
        }
        .db-closing-text {
          font-family: Georgia, "Times New Roman", serif;
          font-style: italic;
          font-size: 13pt;
          color: var(--brand);
          letter-spacing: 0.02em;
          line-height: 1.4;
        }
      `}</style>

      <PrintButton />

      <div className="design-b-doc">
        {/* One continuous sheet. The browser paginates this naturally in
            print — no per-page wrapper divs, no fixed heights. See the
            comment above the pagination-removal note for why. */}
        <div className="a4-sheet-b">
          <PageHeader
            quoteNo={quoteNo}
            phone={settings.phone}
            email={settings.email}
            website={settings.website}
            showContact
          />

          <div className="db-body">
            <div className="db-meta-grid db-avoid-break">
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
                      <span className="db-kv-val">{formatPhone(quotation.customer.phone)}</span>
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

            <div className="db-stripe db-avoid-break">
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

            <div className="db-section-title">Product &amp; Price Schedule</div>

            {/* ── Product Table — one table, browser-paginated ── */}
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
                {renderRows.map((row) => {
                  const item = row.item;
                  return (
                    <tr key={item.id}>
                        <td style={{ textAlign: "center", color: "var(--ink-muted)", fontWeight: 700 }}>
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
                                    <span className="db-spec-v">{SURCHARGE_LABELS[key] ?? key}</span>
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
                        <td style={{ textAlign: "right" }}>{formatINRCompact(effectiveRate(item))}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatINR(item.amount)}</td>
                      </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="db-totals-wrap db-avoid-break">
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
                    <span className="db-tot-val">{formatINR(quotation.totals.transportation)}</span>
                  </div>
                )}
                <div className="db-tot-grand">
                  <span>Grand Total</span>
                  <span className="db-tot-grand-amt">{formatINR(quotation.totals.grandTotal)}</span>
                </div>
              </div>
            </div>
            {/* amountInWords() already returns the full "Rupees ... Only"
                phrase — wrapping it again here previously produced
                "Rupees Rupees ... Only Only." */}
            <div className="db-words db-avoid-break">{amountInWords(quotation.totals.grandTotal)}</div>

            {/* ── Terms & Commercial Conditions ──
                Previously this forced a page break unconditionally right after
                the totals box (break-before:page), regardless of how much
                room was left on the current page. Combined with the totals
                box's own avoid-break, that produced pages that were nearly
                empty: a small totals box got bumped to a fresh page by its
                own avoid-break, then the forced terms break bumped terms to
                the page after THAT, leaving the totals box alone on a mostly
                blank page.

                The fix: no forced break. The whole terms block (this title
                through the closing "Thank you" message) is wrapped in ONE
                avoid-break container below instead. Measured at ~237mm, which
                fits within a single page's ~251mm usable height regardless of
                how many product rows preceded it — so break-inside:avoid
                still guarantees the block is never split internally, but it
                now lands wherever the natural flow has room for it (the
                bottom of the current page if there's space, otherwise the top
                of the next one) instead of always eating a fresh page and
                leaving the previous one part-empty.

                An earlier version of this fix wrapped the ENTIRE terms
                section (title through the closing message, ~234mm) in one
                avoid-break container. That traded the empty-page bug for a
                different one: on some content it forced the totals box's
                "Grand Total" line to split away from "Product Subtotal" a
                few lines above it — worse, since a bill's own total getting
                torn from its own subtotal reads as actually broken, not just
                spaced oddly.

                The correct granularity is per-card: each FAQ card, the
                payment+bank pair, and the signature+closing block each keep
                their OWN avoid-break, but nothing forces the page boundary to
                land in a specific place between them. So the boundary is
                free to fall wherever there's room — after 2 of the 4 FAQ
                cards if that's what fits, or before all of them — while
                nothing inside any single card, table, or the totals box can
                ever be torn internally. This is what stays correct for any
                item count: what varies is WHERE the boundary falls, never
                whether something gets split apart that shouldn't be. */}
            <div>
              <div className="db-section-title db-avoid-break">Terms &amp; Commercial Conditions</div>

              {/* ── FAQ Cards (2×2), kept together as one compact grid ── */}
              <div className="db-faq-grid db-avoid-break">
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
            <div className="db-pb-grid db-avoid-break">
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
            {/* Never allow "Customer Signature" to print at the bottom of one
                page with the actual line on the next — the whole block moves
                together or not at all. */}
            <div className="db-sig-row db-avoid-break">
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
              <div className="db-closing db-avoid-break">
                <div className="db-closing-text">
                  Thank you for choosing Royal Doors &amp; Windows.
                </div>
              </div>
            </div>
            {/* ^ closes the single avoid-break wrapper opened above at
                "Terms & Commercial Conditions" — the whole terms block
                (title, FAQ cards, payment/bank, signature, closing message)
                is one unit that either fits together on the current page or
                moves together to the next, never torn apart. */}
          </div>

          {/* No avoid-break here: this is a decorative tagline, not something
              that reads as broken if it happened to start a page on its own.
              Marking it avoid-break was what pushed a whole extra page into
              existence for short quotations — the signature+closing block just
              barely fit on the terms page, but the footer's own avoid-break
              then refused to let it squeeze into the few remaining
              millimetres, so the ENTIRE (tiny) footer moved to a fresh page
              instead of the few mm it needed being handled by ordinary flow. */}
          <div className="db-footer">
            <div className="db-footer-caps">
              <span>Premium Hardware</span>
              <span>·</span>
              <span>{quotation.terms.warrantyYears}-Year Warranty (Profile)</span>
              <span>·</span>
              <span>Sound Insulation</span>
              <span>·</span>
              <span>Weather Resistant</span>
              <span>·</span>
              <span>Energy Efficient</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
