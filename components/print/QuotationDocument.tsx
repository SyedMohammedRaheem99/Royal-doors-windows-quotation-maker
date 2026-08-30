import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel } from "@/lib/dimensions";
import { formatINR, formatINRCompact } from "@/lib/money";
import { computePaymentStages, effectiveRate, SURCHARGES, toughenedGlassSurcharge } from "@/lib/pricing";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering";
import type { Quotation, Settings } from "@/models/schemas";
import { PrintButton } from "./PrintButton";

const GREEN = "#0f3d2e";
const GREEN_DARK = "#0a2e22";
const GOLD = "#c9a227";
const CREAM = "#faf8f2";

/**
 * Customer-facing wording for each surcharge, with the rate spelled out —
 * these are extras the customer is paying for, so naming them (rather than
 * printing "+ 2 surcharge(s) applied") is what makes the amount defensible.
 * Keys match lib/pricing.ts's SURCHARGES.
 */
const SURCHARGE_LABELS: Record<string, string> = {
  nonWhiteOrOneWayGlass: `Non-white / one-way glass (+₹${SURCHARGES.nonWhiteOrOneWayGlass}/sqft)`,
  ssMesh: `SS mesh (+₹${SURCHARGES.ssMesh}/sqft)`,
  aluminiumTrack: `Aluminium track (+₹${SURCHARGES.aluminiumTrack}/sqft)`,
  frenchWindowDesign: `French window design (+₹${SURCHARGES.frenchWindowDesign}/sqft)`,
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}


export function QuotationDocument({
  quotation,
  settings,
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  /** Resolved from quotation.createdBy by the caller (see lib/users.ts's
   *  getPreparedByName) — optional because a deleted/legacy account or a dev
   *  fixture may have nothing to resolve. */
  preparedByName?: string | null;
}) {
  const date = new Date(quotation.date);
  const validUntil = new Date(date.getTime() + quotation.terms.validityDays * 86400000);
  const boiler = settings.terms.boilerplate;

  /**
   * The reference quotations ran all of this as one flat 9-point list, which
   * flattens three genuinely different kinds of statement into equal weight:
   * what the customer is getting, what is covered, and what is explicitly NOT
   * covered. That matters commercially — "We use premium hardware" (a selling
   * point) was reading with exactly the same emphasis as "No warranty for
   * glass & hardware" (a material exclusion the customer must actually
   * notice). Grouping them lets each be read for what it is.
   *
   * Every source line is still printed, in the same wording; only the
   * grouping changed.
   */
  /**
   * Which boilerplate line belongs in which group is decided by matching the
   * line's content, not its array index. Index-based picking (boiler[0],
   * boiler[4], ...) silently mis-files every line the moment the terms list is
   * reordered or edited in Settings — and the terms ARE editable, so that is a
   * question of when, not if. Matching on a distinctive keyword means an edited
   * or reordered list still files correctly, and anything unrecognised falls
   * through to "Charges that may apply" rather than vanishing.
   */
  const pick = (re: RegExp) => boiler.find((line) => re.test(line)) ?? null;
  const meshLine = pick(/mesh screen/i);
  const reinforcementLine = pick(/reinforcement/i);
  const hardwareLine = pick(/premium hardware/i);
  const noWarrantyLine = pick(/no warranty/i);
  const siliconeLine = pick(/silicone/i);
  const measurementLine = pick(/final site measurement|approximate/i);

  const groupedLines = [meshLine, reinforcementLine, hardwareLine, noWarrantyLine, siliconeLine, measurementLine];

  const specLines = [
    quotation.terms.profile,
    meshLine,
    quotation.terms.glass,
    reinforcementLine,
    hardwareLine,
    // Silicone is a specification of how the unit is sealed, not a timeline or
    // a commercial condition — it belongs with what the customer is getting.
    siliconeLine,
  ].filter((line): line is string => Boolean(line));

  const coverageLines = [
    `${quotation.terms.warrantyYears} years warranty on the uPVC profile (outer frame and shutters).`,
    noWarrantyLine,
  ].filter((line): line is string => Boolean(line));

  const conditionLines = [
    quotation.terms.workDuration
      ? `Work duration ${quotation.terms.workDuration.fromDays} to ${quotation.terms.workDuration.toDays} days from the date of advance.`
      : null,
    measurementLine,
    ...quotation.terms.extraNotes,
  ].filter((line): line is string => Boolean(line));

  // Whatever wasn't filed into a group above — the per-sqft extras. Derived by
  // exclusion so a newly added Settings line always appears somewhere on the
  // document instead of being silently dropped.
  const additionalNotes = boiler.filter((line) => !groupedLines.includes(line));

  // Only per_sqft items contribute a meaningful area; a per-piece door has a
  // notional area that would inflate the headline figure if summed in.
  const totalAreaSqft = Math.round(
    quotation.items.filter((i) => i.pricingMode === "per_sqft").reduce((s, i) => s + i.totalAreaSqft, 0)
  );

  // Computed by lib/pricing.ts, not here: a payment schedule that fails to
  // reconcile to the grand total is a money bug, and logic living inside a
  // render function cannot be unit-tested. See computePaymentStages().
  const paymentStages = computePaymentStages(
    quotation.terms.paymentScheme?.steps ?? [],
    quotation.totals.grandTotal
  );

  return (
    <>
      <PrintButton />
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { background: #d9d9d9; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .quote-doc {
          width: 210mm;
          min-height: 297mm;
          margin: 12px auto;
          background: ${CREAM};
          /* Column layout so the footer band sits flush at the bottom of a
             short quotation instead of leaving a strip of cream beneath it. */
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #26302b;
          box-shadow: 0 0 16px rgba(0,0,0,0.18);
          font-size: 10.5px;
          line-height: 1.4;
        }
        /* The running letterhead/footer only exist on paper. On screen the
           full band-header is already visible at the top, so showing these
           too would duplicate it. */
        .run-head { display: none; }
        /* Only meaningful on a continued printed page; hidden on screen and
           on page 1 where the full letterhead is directly above. */
        .continued-id { display: none; }

        @media print {
          .quote-doc { margin: 0; box-shadow: none; width: auto; min-height: auto; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }

          /* Reserve the strips the fixed running header and footer occupy so
             flowing content never slides underneath either one. Page 1 is
             handled by :first — it carries the full letterhead band in the
             flow, so it needs no top reservation and no running header. */
          /* Pages 2+ reserve exactly the running header's height (12mm) plus a
             hairline of clearance; page 1 reserves nothing at the top because
             its full letterhead band prints in the flow. The bottom strip is
             the running footer's 10mm plus clearance. Every extra millimetre
             here is millimetres taken off every page, so these are kept tight
             rather than round. */
          /* Page identity and numbering live in the @page margin boxes, NOT in
             a position:fixed element. Verified by decoding the generated PDF's
             own text: counter(page)/counter(pages) inside a fixed element
             renders literally "0 of 0" on every page in Chrome's PDF output,
             while the same counters in a margin box resolve correctly and
             differ per page. This is why the earlier running-footer attempt
             could never show a page number. */
          @page {
            margin: 13mm 14mm 11mm;
            @bottom-left {
              content: "${settings.companyName} · ${withRevisionSuffix(quotation.quoteNo, quotation.revision)}";
              font-size: 7.5pt;
              color: #6b7280;
            }
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 7.5pt;
              color: #6b7280;
            }
          }
          @page :first { margin: 0 14mm 11mm; }

          /* A real repeating letterhead on every continued page: logo, company
             name and the quote number, so page 2+ is identifiable on its own
             rather than starting mid-table as an anonymous sheet.

             A fixed element paints on EVERY page including page 1, where it
             would sit on top of the full letterhead band already in the flow
             (verified — it obscured the date row). Page 1 declares no top
             margin (@page :first) while pages 2+ reserve 16mm, so anchoring
             the header to the top of the *margin box* puts it inside that
             reserved strip on continued pages and above the printable area —
             clipped away — on page 1. That is what suppresses it on page 1
             without hiding it everywhere. */
          .run-head {
            display: flex; position: fixed; top: -13mm; left: 0; right: 0;
            align-items: center; gap: 3mm; height: 12mm; padding: 0 14mm;
            background: ${GREEN}; color: #fff;
          }
          .run-head img { width: 9mm; height: 9mm; object-fit: cover; border: 1px solid ${GOLD}; border-radius: 2px; }
          .run-head .rh-name { font-family: Georgia, "Times New Roman", serif; font-size: 12px; font-weight: 700; color: ${GOLD}; letter-spacing: 0.03em; }
          .run-head .rh-sub { font-size: 7.5px; color: #cfe0d5; letter-spacing: 0.06em; }
          .run-head .rh-right { margin-left: auto; text-align: right; }
          .run-head .rh-qno { font-size: 10px; font-weight: 700; color: ${GOLD}; }
          .run-head .rh-cust { font-size: 7.5px; color: #cfe0d5; }


          /* Repeat the schedule's column headings on every page the table
             spans, so a continued table is still readable. Chrome reliably
             repeats thead on each page a table crosses. */
          .item-table thead { display: table-header-group; }
          .item-table tr { break-inside: avoid; page-break-inside: avoid; }

          /* Terms and commercials always begin a fresh page and stay whole.
             break-before guarantees the page; break-inside stops the group
             being torn even though its individual panels already avoid
             breaking on their own — without the wrapper, nothing prevented the
             GROUP from splitting between panels, which is how the acceptance
             block ended up marooned after the payment schedule. */
          .terms-page {
            break-before: page; page-break-before: always;
            break-inside: avoid; page-break-inside: avoid;
          }
          /* The first panel inside sits flush at the top of its new page —
             its own top margin would otherwise push it down by 3mm. */
          .terms-page > .panel:first-child { margin-top: 0; }
        }
        .content { padding: 3mm 14mm; flex: 1; }
        .band-header {
          background: linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%);
          color: white;
          /* Was 8mm/6mm — the band was 29mm tall, ~10% of the page and the
             single largest element on it. Tightened without shrinking the
             logo or the quote number. */
          padding: 4mm 14mm 3.5mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .brand { display: flex; gap: 8px; align-items: center; }
        .logo-mark {
          width: 12mm; height: 12mm; border: 1.25px solid ${GOLD}; border-radius: 3px;
          overflow: hidden; flex-shrink: 0;
        }
        .logo-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .brand-name { color: ${GOLD}; font-size: 17px; font-weight: 700; letter-spacing: 0.03em; font-family: Georgia, "Times New Roman", serif; }
        /* "DOORS AND WINDOWS" sits on the same line as ROYAL rather than
           stacked beneath it — the stack cost ~4mm of band height to say what
           the gold footer band already repeats. */
        .brand-name small {
          color: #f2e6c2; font-size: 8.5px; font-weight: 500;
          letter-spacing: 0.12em; margin-left: 5px;
        }
        .quote-meta { text-align: right; font-size: 8.5px; color: #e8efe9; }
        /* The quote number is the field people actually quote back on a phone
           call, so it reads as the document's identifier rather than competing
           with the brand name. */
        .quote-meta .qno {
          color: ${GOLD}; font-size: 14px; font-weight: 700; margin-bottom: 2px;
          letter-spacing: 0.02em; font-variant-numeric: tabular-nums;
        }
        /* Dates as a small label/value grid so the two rows align on one
           column edge instead of each being its own right-flushed flex row. */
        .quote-meta .row {
          display: grid; grid-template-columns: auto auto; column-gap: 6px;
          justify-content: end; align-items: baseline;
        }
        .quote-meta .row span:first-child {
          color: #a9c2b1; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.06em;
        }
        .quote-meta .row strong { font-weight: 600; font-variant-numeric: tabular-nums; }

        /* Bound as one block rather than two floating text columns, matching
           the ruled item table below it. The 10mm gutter was oversized — the
           cards are 86mm wide but hold 26-38mm of text. */
        .info-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6mm;
          margin-top: 2.5mm; padding: 2mm 3mm;
          background: #fcfbf7; border: 1px solid #ece5d5; border-radius: 3px;
        }
        .info-card h3 {
          font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: ${GOLD};
          border-bottom: 1px solid #e6ddc4; padding-bottom: 1.5px; margin-bottom: 2.5px; font-weight: 700;
        }
        .info-card p.name { font-weight: 700; font-size: 11px; color: ${GREEN}; margin: 0 0 1.5px; }

        /* Two-column definition grid. column-gap is the ONLY space between a
           label and its value, so the gutter is identical on every row no
           matter how wide the label text is. */
        .info-card dl {
          margin: 0; display: grid; grid-template-columns: auto 1fr;
          column-gap: 3mm; row-gap: 0.9mm; align-items: baseline;
        }
        /* Labels are a quiet tag, not a peer of the value: smaller, uppercase,
           tracked and light. Previously label and value were 8.5px vs 9.5px in
           two greys, which is no hierarchy at all — the block read as one flat
           run of letters. Right-aligned so the gutter edge is straight. */
        .info-card dt {
          font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.06em;
          color: #a3a9a5; font-weight: 600; text-align: right; white-space: nowrap;
        }
        .info-card dd { margin: 0; font-size: 10px; color: #26302b; }
        .info-card dd.muted { color: #b6bcb8; }
        /* Phone numbers: even digit widths so they don't look kerned apart. */
        .info-card dd.tabular { font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
        /* An identifier people transcribe off the page (GSTIN). Monospaced and
           tracked so 29BBAPM2758M1Z6 reads as characters, not one blob. */
        .info-card dd.ident {
          font-family: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
          font-size: 9px; letter-spacing: 0.04em;
        }

        /* The "Quotation for Supply & Installation" heading was removed: the
           letterhead and quote number already identify the document, and a
           full-width heading above the only table on the page added 5.8mm
           without adding information. The ruled table header opens the
           section on its own. */

        /* Dense product schedule table — one straightforward table rather
           than bordered cards, matching the agreed reference: thumbnail,
           description with specs inline, then size/qty/unit/rate/amount. */
        /* Four headline figures in a row: how many, how big, product value and
           the number that matters. Deliberately quiet — flat cells with a rule
           between them, not four coloured cards, so it reads as a summary line
           rather than a dashboard. */
        .proj-summary {
          display: grid; grid-template-columns: repeat(4, 1fr);
          margin-top: 3mm; border: 1px solid #e6ddc4; border-radius: 3px;
          background: #fff; overflow: hidden;
        }
        .ps-cell {
          display: flex; flex-direction: column; gap: 0.4mm;
          padding: 1.8mm 3mm; border-left: 1px solid #efe9db;
        }
        .ps-cell:first-child { border-left: none; }
        .ps-val { font-size: 12px; font-weight: 700; color: ${GREEN}; font-variant-numeric: tabular-nums; }
        .ps-lab { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.07em; color: #a3a9a5; font-weight: 600; }
        /* The grand total is the one figure the eye should land on. */
        .ps-total { background: ${GREEN}; }
        .ps-total .ps-val { color: ${GOLD}; font-size: 13px; }
        .ps-total .ps-lab { color: #cfe0d5; }

        /* A fully ruled grid — every cell carries its own border, so the
           columns are visibly separated instead of numbers floating in
           whitespace with only a horizontal rule under each row. The outer
           border closes the table off as one block. */
        .item-table {
          width: 100%; border-collapse: collapse; margin-top: 3mm;
          border: 1px solid ${GREEN};
        }
        .item-table th {
          background: ${GREEN}; color: white; font-size: 8px; text-transform: uppercase;
          letter-spacing: 0.05em; font-weight: 700; padding: 2mm 2mm; text-align: left;
          border-right: 1px solid rgba(255,255,255,0.22);
        }
        .item-table th:last-child { border-right: none; }
        .item-table th.num { text-align: right; }
        .item-table td {
          padding: 1.5mm 2mm; vertical-align: top; font-size: 9.5px;
          border-right: 1px solid #e0d7bd; border-bottom: 1px solid #e0d7bd;
        }
        .item-table td:last-child { border-right: none; }
        .item-table tr:last-child td { border-bottom: none; }
        .item-table .col-no { width: 8mm; text-align: center; color: #6b7280; vertical-align: middle; }
        .item-table .col-diagram { width: 20mm; vertical-align: middle; }
        .item-table .col-diagram > * { width: 18mm; height: 18mm; display: block; margin: 0 auto; }
        .item-table .col-desc { min-width: 45mm; }
        /* Figures read against the row as a whole, not against the first line
           of a description that may run several lines deeper. */
        .item-table .num { text-align: right; white-space: nowrap; vertical-align: middle; }
        .item-table td.unit-cell { vertical-align: middle; }
        .item-table .col-amount { font-weight: 700; color: ${GREEN}; }

        .item-desc { font-weight: 700; font-size: 10.5px; color: #1f2937; }
        .item-specs { margin-top: 0.7mm; font-size: 8.5px; color: #6b7280; line-height: 1.35; }
        .item-specs span { display: block; }
        .item-specs .surcharge { color: #8a6d1f; font-weight: 600; }
        .rate-breakdown { color: #9ca3af; font-size: 8px; }

        .totals-wrap { display: flex; justify-content: flex-end; align-items: flex-start; margin-top: 3.5mm; }
        .totals-summary { padding-top: 1mm; min-width: 60mm; }
        .totals-summary .sum-row {
          display: flex; justify-content: space-between; gap: 8mm;
          font-size: 9.5px; color: #6b7280; padding: 0.9mm 0; border-bottom: 1px dotted #e0d8c0;
        }
        .totals-summary .sum-row strong { color: ${GREEN}; font-weight: 700; }
        /* The grand total is the single number the customer looks for, so it
           gets a solid brand band rather than sharing the same weight as the
           subtotal lines above it. */
        .totals-box { width: 68mm; border: 1px solid #e6ddc4; border-radius: 3px; background: white; overflow: hidden; }
        .totals-box .rows { padding: 1.6mm 4mm; }
        .totals-box .row { display: flex; justify-content: space-between; font-size: 10px; padding: 0.8px 0; color: #4b5563; }
        .totals-box .grand {
          display: flex; justify-content: space-between; align-items: baseline;
          background: ${GREEN}; color: #fff; padding: 2mm 4mm;
        }
        .totals-box .grand span:first-child { font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: #cfe0d5; }
        .totals-box .grand span:last-child { font-size: 15px; font-weight: 700; color: ${GOLD}; }
        .words { text-align: right; font-size: 9px; font-style: italic; color: #6b7280; margin-top: 1.2mm; }

        /* Deliberately small — a quick-glance strip, not a page of its own.
           Detail for each of these already lives below (Payment Schedule
           table, Specification & Terms list), so this exists purely as a
           scannable summary a customer can read in two seconds. */
        .quick-terms {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm;
          margin-top: 3mm; padding: 2mm 0; border-top: 1px solid #e6ddc4; border-bottom: 1px solid #e6ddc4;
        }
        .quick-term { display: flex; align-items: center; gap: 2.5mm; }
        .quick-term svg { width: 15px; height: 15px; color: ${GOLD}; flex-shrink: 0; }
        .quick-term div { display: flex; flex-direction: column; line-height: 1.25; }
        .quick-term strong { font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; font-weight: 600; }
        .quick-term span { font-size: 10px; color: ${GREEN}; font-weight: 700; }

        /* Shared panel shell. Specification, Payment Schedule and Bank
           Details are all boxed the same way so the lower half of the page
           reads as one system rather than three loose text blocks — and so
           they visually match the item table and totals box above. */
        .panel {
          border: 1px solid #e6ddc4; border-radius: 3px; background: white;
          margin-top: 3mm; overflow: hidden;
        }
        .panel > h3 {
          margin: 0; padding: 1.2mm 3mm;
          background: #f2ece0; border-bottom: 1px solid #e6ddc4;
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em;
          color: ${GREEN}; font-weight: 700;
        }
        .panel-body { padding: 2mm; }

        /* Three sub-boxes rather than one flat 9-item run. Each answers a
           different question — what am I getting / what's covered / what are
           the conditions — so they read as three short scannable lists
           instead of one wall the eye slides off. */
        .spec-groups {
          display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 2.5mm;
          /* Optional upgrades sits beside the two short columns rather than
             below all three: "What's included" runs ~6 lines while Warranty and
             Timeline run 1-2, leaving a tall void under them that the upgrades
             block now fills. Saves ~16mm on every quotation. */
          grid-template-areas: "incl warr time" "incl upgr upgr";
          align-content: start;
          /* Stretch each box to its row so the three columns end on a common
             baseline instead of leaving ragged voids beneath the shorter
             ones — with the terms on a page of their own there is room to
             let them breathe rather than sizing every box to its content. */
          align-items: stretch;
          /* Size each column to its own content. With the default stretch
             behaviour the one-line "Timeline and conditions" box was forced to
             the height of the six-line "What's included" box, wasting ~30mm of
             a page that has none to spare. */
          align-items: start;
        }
        .spec-group {
          border: 1px solid #efe9db; border-radius: 2px;
          background: #fcfbf7; padding: 2mm;
        }
        .area-incl { grid-area: incl; }
        .area-warr { grid-area: warr; }
        .area-time { grid-area: time; }
        .area-upgr { grid-area: upgr; }
        .spec-group h4 {
          margin: 0 0 1.5mm; padding-bottom: 1.2mm;
          border-bottom: 1px solid #eae3d2;
          font-size: 8px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em; color: ${GOLD};
        }
        .spec-group ul { margin: 0; padding: 0; list-style: none; }
        .spec-group li {
          position: relative; padding-left: 3.2mm; margin-bottom: 0.7mm;
          font-size: 8.5px; line-height: 1.3; color: #4b5563;
        }
        .spec-group li:last-child { margin-bottom: 0; }
        /* A rule-marker rather than a bullet: these are statements of fact,
           and a dot per line at this density reads as visual noise. */
        .spec-group li::before {
          content: ""; position: absolute; left: 0; top: 1.5mm;
          width: 1.8mm; height: 1px; background: #c9c2ab;
        }

        /* Kept visually distinct from the neutral spec boxes — these are
           charges the customer may actually incur, so the cream/gold
           treatment marks them as money rather than specification. */
        .extra-charges {
          background: #fdf8e8;
          border: 1px solid #eadfbc; border-left: 2.5px solid ${GOLD};
          border-radius: 2px; padding: 2mm 3mm;
        }
        .extra-charges h4 {
          margin: 0 0 1.5mm; font-size: 8px; text-transform: uppercase; letter-spacing: 0.07em;
          color: #8a6d1f; font-weight: 700;
        }
        .extra-charges ul {
          margin: 0; padding: 0; list-style: none;
        }
        .extra-charges li {
          position: relative; padding-left: 3.2mm; margin-bottom: 1mm;
          font-size: 8.5px; line-height: 1.45; color: #6b5a2e;
          break-inside: avoid;
        }
        .extra-charges li::before {
          content: ""; position: absolute; left: 0; top: 1.5mm;
          width: 1.8mm; height: 1px; background: ${GOLD};
        }

        /* Full-bleed inside its panel — the panel already provides the border
           and padding, so the table runs edge to edge and the total row can
           sit as a solid band. */
        /* Milestone list, not a table: number, what it is, and what it costs.
           The stage number anchors the sequence; the percentage sits under the
           label as supporting detail rather than competing with the amount. */
        .pay-list { list-style: none; margin: 0; padding: 0; font-size: 9.5px; }
        .pay-list li {
          display: flex; align-items: baseline; gap: 2.5mm;
          padding: 1.2mm 3mm; border-bottom: 1px solid #f0ebdf;
        }
        .pay-idx {
          flex: 0 0 auto; font-size: 8px; font-weight: 700; color: ${GOLD};
          font-variant-numeric: tabular-nums; letter-spacing: 0.04em;
        }
        .pay-body { display: flex; flex-direction: column; gap: 0.3mm; flex: 1 1 auto; }
        .pay-label { color: #26302b; font-weight: 600; }
        .pay-pct { font-size: 7.5px; color: #a3a9a5; letter-spacing: 0.04em; }
        .pay-amount {
          flex: 0 0 auto; text-align: right; font-weight: 600; color: #26302b;
          white-space: nowrap; font-variant-numeric: tabular-nums;
        }
        .pay-list .pay-total {
          border-bottom: none; background: ${GREEN};
          padding-top: 2mm; padding-bottom: 2mm;
        }
        .pay-list .pay-total .pay-label { color: #fff; font-weight: 700; }
        .pay-list .pay-total .pay-amount { color: ${GOLD}; font-size: 10.5px; font-weight: 700; }

        .pay-bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; align-items: start; }
        /* When there is no payment scheme on the quotation the grid has a
           single child, which would otherwise sit in a half-width column with
           a large empty gap beside it. One child = one full-width column. */
        .pay-bank-grid:has(> .panel:only-child) { grid-template-columns: 1fr; }
        /* The two panels sit in a grid row, so their own top margins would
           push them out of alignment with each other. */
        .pay-bank-grid > .panel { margin-top: 4mm; }

        /* Single column at half-page width: an account name like "ROYAL DOORS
           AND WINDOWS" wraps badly in two columns here, and a wrapped account
           number is worse than a slightly taller box. */
        .bank p {
          display: flex; gap: 2mm; margin: 0 0 0.6mm; font-size: 9px;
        }
        .bank .bank-label {
          flex: 0 0 15mm; color: #9ca3af; font-size: 8px;
          text-transform: uppercase; letter-spacing: 0.04em; padding-top: 0.3mm;
        }
        .bank .upi {
          margin-top: 1mm; padding-top: 1.5mm;
          border-top: 1px dotted #e0d8c0;
        }

        .closing { margin-top: 3mm; }
        /* Acceptance block: a short confirmation line, then three ruled fields
           on one row (name/signature, date, authorised signatory). Ruled lines
           rather than a tall empty box — the previous 12mm blank gap read as a
           layout mistake rather than somewhere to sign. */
        .acceptance {
          border: 1px solid #e6ddc4; border-radius: 3px; background: #fff;
          padding: 2.5mm 3mm;
        }
        .acceptance h3 {
          margin: 0 0 1.2mm; font-size: 8px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em; color: ${GOLD};
        }
        .acc-text { margin: 0 0 2mm; font-size: 8.5px; color: #4b5563; line-height: 1.4; }
        .signature { display: grid; grid-template-columns: 1.3fr 0.7fr 1.3fr; gap: 6mm; }
        .sig-block { display: flex; flex-direction: column; gap: 1mm; }
        .sig-rule { display: block; height: 0; border-bottom: 1px solid #c9c2ab; margin-top: 3.5mm; }
        .sig-cap { font-size: 7.5px; color: #a3a9a5; letter-spacing: 0.04em; }
        .thank-you { text-align: center; font-size: 9px; color: ${GOLD}; font-weight: 600; margin-top: 2.5mm; letter-spacing: 0.02em; }

        .band-footer {
          margin-top: 3mm; background: ${GOLD}; color: ${GREEN_DARK};
          padding: 1.8mm 14mm; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
          font-size: 8.5px; font-weight: 600;
        }
      `}</style>

      {/* No avoid-break on the document wrapper — it would tell the browser
          never to split the whole quotation, fighting the per-item break rules
          below and producing unpredictable pagination on a 2+ page quote.
          Breaks are controlled at the item/totals/terms level instead. */}
      <div className="quote-doc">
        {/* Print-only running letterhead and footer, fixed to every printed
            page. Page 1 reserves no top margin (@page :first) so its full
            letterhead band prints in the flow instead; the fixed header still
            paints there, so it is positioned to sit exactly within that band's
            own green area rather than clashing with it. */}
        <div className="run-head" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- print document renders outside next/image's optimization pipeline */}
          <img src="/logo-mark.png" alt="" />
          <div>
            <div className="rh-name">ROYAL DOORS AND WINDOWS</div>
            <div className="rh-sub">uPVC · Aluminium · WPC</div>
          </div>
          <div className="rh-right">
            <div className="rh-qno">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</div>
            {quotation.customer.name && <div className="rh-cust">{quotation.customer.name}</div>}
          </div>
        </div>


        <div className="band-header">
          <div className="brand">
            <div className="logo-mark">
              {/* eslint-disable-next-line @next/next/no-img-element -- print document renders outside next/image's optimization pipeline */}
              <img src="/logo-mark.png" alt="" />
            </div>
            <div>
              <div className="brand-name">
                ROYAL
                <small>DOORS AND WINDOWS</small>
              </div>
              {/* The "Premium uPVC · Aluminium · WPC" tagline was removed: it
                  is marketing copy on a priced commercial document, and the
                  gold contact band at the foot already carries the same
                  positioning. */}
            </div>
          </div>
          <div className="quote-meta">
            <div className="qno">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</div>
            <div className="row">
              <span>Date</span>
              <strong>{formatDate(date)}</strong>
            </div>
            <div className="row">
              <span>Valid till</span>
              <strong>{formatDate(validUntil)}</strong>
            </div>
          </div>
        </div>

        {/* The STRONG/INSULATED/SOUNDPROOF/SECURE strip was removed: it cost
            8.4mm of prime space directly under the letterhead to repeat the
            brand tagline printed immediately above it, and that space is
            better spent keeping the terms block off a second page. The
            quick-terms strip lower down carries real per-quotation facts and
            stays. */}
        <div className="content">
          {/* A definition list, not stacked paragraphs. <dt>/<dd> in a two
              column grid means every value starts on the same x regardless of
              how long its label is — the old inline-block label reserved a
              fixed 15mm box, so a 3.7mm "Site" left an 11mm void while a 12mm
              "Prepared by" left 3mm, and the gutter read as ragged. */}
          <div className="info-grid avoid-break">
            <div className="info-card">
              <h3>Customer</h3>
              <p className="name">{quotation.customer.name}</p>
              <dl>
                {quotation.customer.phone && (
                  <>
                    <dt>Phone</dt>
                    <dd className="tabular">{quotation.customer.phone}</dd>
                  </>
                )}
                {quotation.customer.siteAddress && (
                  <>
                    <dt>Site address</dt>
                    <dd>{quotation.customer.siteAddress}</dd>
                  </>
                )}
                {quotation.customer.gstin && (
                  <>
                    <dt>GSTIN</dt>
                    <dd className="ident">{quotation.customer.gstin}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className="info-card">
              <h3>Project</h3>
              <dl>
                {quotation.customer.project ? (
                  <>
                    <dt>Project</dt>
                    <dd>{quotation.customer.project}</dd>
                  </>
                ) : (
                  // Without this the card renders as a bare heading over empty
                  // space whenever no project was entered.
                  <>
                    <dt>Project</dt>
                    <dd className="muted">—</dd>
                  </>
                )}
                {quotation.customer.referredBy && (
                  <>
                    <dt>Referred by</dt>
                    <dd>{quotation.customer.referredBy}</dd>
                  </>
                )}
                {/* "Our GSTIN" -> "GSTIN": this prints under our own
                    letterhead, so whose it is was never in question. */}
                {quotation.gst.enabled && settings.gstin && (
                  <>
                    <dt>GSTIN</dt>
                    <dd className="ident">{settings.gstin}</dd>
                  </>
                )}
                {/* Quote date is deliberately NOT repeated here — it already
                    prints in the letterhead band at the top of the page. */}
                {preparedByName && (
                  <>
                    <dt>Prepared by</dt>
                    <dd>{preparedByName}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Project summary: the four figures a reader wants before working
              through 14 line items. Every value is derived from the quotation's
              own computed data — nothing is passed in or restated by hand. */}
          <div className="proj-summary avoid-break">
            <div className="ps-cell">
              <span className="ps-val">{quotation.items.length}</span>
              <span className="ps-lab">{quotation.items.length === 1 ? "Item" : "Items"}</span>
            </div>
            <div className="ps-cell">
              <span className="ps-val">{totalAreaSqft.toLocaleString("en-IN")}</span>
              <span className="ps-lab">Sq.ft</span>
            </div>
            <div className="ps-cell">
              <span className="ps-val">{formatINRCompact(quotation.totals.subtotal)}</span>
              <span className="ps-lab">Product value</span>
            </div>
            <div className="ps-cell ps-total">
              <span className="ps-val">{formatINRCompact(quotation.totals.grandTotal)}</span>
              <span className="ps-lab">Grand total</span>
            </div>
          </div>

          <table className="item-table">
            <thead>
              {/* Repeats on every printed page the table spans (see
                  display:table-header-group in the print CSS), so a continued
                  page still carries the quote number and customer name and is
                  never an unidentifiable orphan. */}
              <tr>
                <th className="col-no">S.No</th>
                <th className="col-diagram" />
                <th>Description</th>
                <th className="num">Size (ft)</th>
                <th className="num">Qty</th>
                <th>Unit</th>
                <th className="num">Rate (₹)</th>
                <th className="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Plain product-wise numbering, no room grouping — the
                  customer reads this as a straightforward schedule, not a
                  room-by-room breakdown. Room/area is still captured on each
                  item (lib/grouping.ts's data isn't discarded, just not used
                  to structure this table) so a room-grouped view stays
                  available later without a data model change — see
                  FUTURE-IDEAS.md. */}
              {quotation.items.map((item, i) => (
                <tr key={item.id} className="item-row avoid-break">
                  <td className="col-no">{i + 1}</td>
                  <td className="col-diagram">
                    <WindowDiagram
                      type={item.diagram.type}
                      widthFt={item.billed.w}
                      heightFt={item.billed.h}
                      handing={item.diagram.handing}
                      fanPoint={item.diagram.fanPoint}
                      className="w-full"
                    />
                  </td>
                  <td className="col-desc">
                    <div className="item-desc">{item.description}</div>
                    <div className="item-specs">
                      {/* Profile was previously omitted here even when set,
                          so an item could print with no specs at all. */}
                      {item.specs.profile && <span>Profile: {item.specs.profile}</span>}
                      {item.specs.colour && <span>Colour: {item.specs.colour}</span>}
                      {item.specs.glass && <span>Glass: {item.specs.glass}</span>}
                      {item.specs.glassThickness && <span>{item.specs.glassThickness}</span>}
                      {item.specs.mesh && <span>Mesh: {item.specs.mesh}</span>}
                      {item.specs.track && <span>Track: {item.specs.track}</span>}
                      {item.specs.hardware && <span>{item.specs.hardware}</span>}
                      {item.specs.reinforcement && <span>Reinforcement: {item.specs.reinforcement}</span>}
                      {/* Name the surcharges — a bare count told the customer
                          nothing about what they were being charged for. */}
                      {item.surcharges.map((key) => (
                        <span key={key} className="surcharge">
                          + {SURCHARGE_LABELS[key] ?? key}
                        </span>
                      ))}
                      {item.toughenedGlassMm && (
                        <span className="surcharge">
                          + Toughened glass, {item.toughenedGlassMm}mm (+₹
                          {toughenedGlassSurcharge(item.toughenedGlassMm)}/sqft)
                        </span>
                      )}
                      {item.remarks && <span>{item.remarks}</span>}
                    </div>
                  </td>
                  <td className="num">
                    {feetToArchLabel(item.billed.w)} × {feetToArchLabel(item.billed.h)}
                  </td>
                  <td className="num">{item.qty}</td>
                  <td className="unit-cell">{item.pricingMode === "per_sqft" ? `sqft (${item.totalAreaSqft})` : "pc"}</td>
                  <td className="num">
                    {/* Printing item.rate here (the base rate) while the
                        amount was computed from rate + surcharges was the
                        bug — the page multiplied to a different figure than
                        it billed. effectiveRate() is the same function
                        lib/quotations.ts prices with, so this can't drift
                        from the stored amount again. */}
                    {effectiveRate(item)}
                    {(item.surcharges.length > 0 || item.toughenedGlassMm) && item.pricingMode === "per_sqft" && (
                      <span className="rate-breakdown">
                        {" "}
                        ({item.rate}+{effectiveRate(item) - item.rate})
                      </span>
                    )}
                  </td>
                  <td className="num col-amount">{formatINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals-wrap avoid-break">
            {/* Summary occupies what was dead space to the left of the totals
                box — gives the reader the headline figures in words and the
                item/area counts without hunting back up the page. */}
            {/* Nothing sits to the left of the totals box any more. Item and
                area counts moved up into the Project Summary strip; the
                validity date already prints twice (letterhead "Valid till" and
                the quick-terms strip), and a lone line here left a ~30mm void
                beside the totals. The box now right-aligns on its own. */}
            <div>
              <div className="totals-box">
                <div className="rows">
                  <div className="row">
                    <span>Subtotal</span>
                    <span>{formatINR(quotation.totals.subtotal)}</span>
                  </div>
                  {quotation.gst.enabled ? (
                    <>
                      <div className="row">
                        <span>CGST ({quotation.gst.rate / 2}%)</span>
                        <span>{formatINR(quotation.totals.cgst)}</span>
                      </div>
                      <div className="row">
                        <span>SGST ({quotation.gst.rate / 2}%)</span>
                        <span>{formatINR(quotation.totals.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    // Say so explicitly. A totals block that simply omits tax
                    // leaves the customer wondering whether GST is extra.
                    <div className="row">
                      <span>GST</span>
                      <span>Not applicable</span>
                    </div>
                  )}
                  {quotation.totals.transportation > 0 && (
                    <div className="row">
                      <span>Transportation</span>
                      <span>{formatINR(quotation.totals.transportation)}</span>
                    </div>
                  )}
                </div>
                <div className="grand">
                  <span>Grand Total</span>
                  <span>{formatINR(quotation.totals.grandTotal)}</span>
                </div>
              </div>
              <p className="words">{amountInWords(quotation.totals.grandTotal)}</p>
            </div>
          </div>

          {/* The quick-terms icon strip (Payment / Warranty / Validity) was
              removed: every one of its three facts is already stated somewhere
              more useful — the payment split in the Payment Schedule
              milestones, the warranty in the Specification panel, the validity
              date in the letterhead. See spec 51: an element that answers none
              of the seven questions on its own doesn't earn its space. */}

          {/* ---- Terms & commercials: always a page of their own ----
              The schedule and the money end above. Everything from here —
              specification, optional upgrades, payment schedule, bank details
              and the acceptance block — starts a fresh page and travels as one
              unit, so it can never be torn across a break or overlap the end
              of the schedule.

              Measured at ~152mm including the contact band, against 273mm of
              printable height on a continuation page: it fits with ~120mm to
              spare, and its height is driven by the terms list rather than the
              item count, so the fit holds for a 1-item and a 50-item
              quotation alike. */}
          <div className="terms-page">
          <div className="avoid-break panel">
            <h3>Specification &amp; Terms</h3>
            <div className="panel-body">
              <div className="spec-groups">
                <div className="spec-group area-incl">
                  <h4>What&apos;s included</h4>
                  <ul>
                    {specLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="spec-group area-warr">
                  <h4>Warranty</h4>
                  <ul>
                    {coverageLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>

                {conditionLines.length > 0 && (
                  <div className="spec-group area-time">
                    <h4>Timeline &amp; conditions</h4>
                    <ul>
                      {conditionLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inside the grid, occupying the space left under the two
                    short columns — see grid-template-areas above. */}
                {additionalNotes.length > 0 && (
                  <div className="extra-charges area-upgr">
                    <h4>Optional upgrades</h4>
                    <ul>
                      {additionalNotes.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment schedule and bank details are one unit too: a customer
              reading "60% advance" needs the account to pay it into on the
              same page, not overleaf. */}
          {/* Side by side: neither block needs the full A4 width, and pairing
              them keeps "what you owe when" next to "where to send it". */}
          <div className="avoid-break pay-bank-grid">
            {paymentStages.length > 0 && (
              <div className="panel">
                <h3>Payment Schedule</h3>
                {/* Numbered milestones rather than a plain two-column table:
                    the customer is reading a sequence of events ("what do I pay
                    and when"), so the stage number and the percentage carry the
                    structure and the rupee figure is the answer. */}
                <ol className="pay-list">
                  {paymentStages.map((stage, i) => {
                    // Split "50% advance." into its percentage and its label so
                    // each can be styled for what it is. Falls back to the raw
                    // text when a configured step carries no percentage.
                    // "60% advance." -> "Advance". Stripping the leading
                    // percentage leaves a lowercase fragment, so the first
                    // letter is restored — these read as milestone names.
                    const stripped = stage.text.replace(/^\s*\d+(?:\.\d+)?\s*%\s*/, "").replace(/\.$/, "").trim();
                    const label = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : "";
                    return (
                      <li key={i}>
                        <span className="pay-idx">{String(i + 1).padStart(2, "0")}</span>
                        <span className="pay-body">
                          <span className="pay-label">{label || stage.text.replace(/\.$/, "")}</span>
                          {stage.percent !== null && <span className="pay-pct">{stage.percent}% of total</span>}
                        </span>
                        <span className="pay-amount">{stage.amount === null ? "—" : formatINR(stage.amount)}</span>
                      </li>
                    );
                  })}
                  <li className="pay-total">
                    <span className="pay-body">
                      <span className="pay-label">Total</span>
                    </span>
                    <span className="pay-amount">{formatINR(quotation.totals.grandTotal)}</span>
                  </li>
                </ol>
              </div>
            )}

            <div className="panel bank">
              <h3>Bank Details</h3>
              <div className="panel-body">
                {/* Each field is guarded — a partially-filled settings document
                    would otherwise print bare labels with nothing after them. */}
                {settings.bank.accountName && (
                  <p>
                    <span className="bank-label">Name</span>
                    {settings.bank.accountName}
                  </p>
                )}
                {settings.bank.bankName && (
                  <p>
                    <span className="bank-label">Bank</span>
                    {settings.bank.bankName}
                  </p>
                )}
                {settings.bank.accountNo && (
                  <p>
                    <span className="bank-label">A/c No</span>
                    {settings.bank.accountNo}
                  </p>
                )}
                {settings.bank.ifsc && (
                  <p>
                    <span className="bank-label">IFSC</span>
                    {settings.bank.ifsc}
                  </p>
                )}
                {settings.bank.branch && (
                  <p>
                    <span className="bank-label">Branch</span>
                    {settings.bank.branch}
                  </p>
                )}
                {/* UPI was configured in settings but never printed. */}
                {(settings.bank.upiName || settings.bank.upiPhone) && (
                  <p className="upi">
                    <span className="bank-label">UPI</span>
                    {[settings.bank.upiName, settings.bank.upiPhone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Signature and sign-off travel together: a signature block that
              breaks away from the closing line (or lands on a page of its own
              after the footer band) reads as an unfinished document. */}
          <div className="closing avoid-break">
            {/* Acceptance wording is deliberately a plain confirmation of what
                is on this page — specifications, quantities and pricing. It
                makes no warranty, cancellation or liability claim, because no
                such wording has been approved by the business. Anything
                stronger has to come from them, not from here. */}
            <div className="acceptance">
              <h3>Customer acceptance</h3>
              <p className="acc-text">
                I/We have reviewed the specifications, quantities and pricing set out in this quotation and accept
                them as stated.
              </p>
              <div className="signature">
                <div className="sig-block">
                  <span className="sig-rule" />
                  <span className="sig-cap">Customer name &amp; signature</span>
                </div>
                <div className="sig-block sig-date">
                  <span className="sig-rule" />
                  <span className="sig-cap">Date</span>
                </div>
                <div className="sig-block">
                  <span className="sig-rule" />
                  <span className="sig-cap">For {settings.companyName} · Authorised signatory</span>
                </div>
              </div>
            </div>

            <p className="thank-you">Thank you for choosing {settings.companyName}.</p>
          </div>
          </div>
        </div>

        <div className="band-footer">
          {settings.phone && <span>{settings.phone}</span>}
          {/* WhatsApp was configured but never printed — it's how most
              customers in this trade actually reply. */}
          {settings.whatsapp && <span>WhatsApp {settings.whatsapp}</span>}
          {settings.website && <span>{settings.website}</span>}
          {settings.email && <span>{settings.email}</span>}
          {settings.addressLines.length > 0 && <span>{settings.addressLines.join(", ")}</span>}
        </div>
      </div>
    </>
  );
}
