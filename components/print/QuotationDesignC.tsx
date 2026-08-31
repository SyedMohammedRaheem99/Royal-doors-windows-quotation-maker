import React from "react";
import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel } from "@/lib/dimensions";
import { groupItemsByRoom, usesRooms } from "@/lib/grouping";
import { formatINR, formatINRCompact } from "@/lib/money";

import { computePaymentStages, effectiveRate, SURCHARGES } from "@/lib/pricing";

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

export function QuotationDesignC({
  quotation,
  settings,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  preparedByName?: string | null;
}) {
  const date = new Date(quotation.date);

  const boiler = settings.terms.boilerplate;

  const pick = (re: RegExp) => boiler.find((line) => re.test(line)) ?? null;
  const meshLine = pick(/mesh screen/i);
  const reinforcementLine = pick(/reinforcement/i);
  const hardwareLine = pick(/premium hardware/i);
  const noWarrantyLine = pick(/no warranty|not covered under warranty/i);
  const siliconeLine = pick(/silicone/i);



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



  const paymentStages = computePaymentStages(
    quotation.terms.paymentScheme?.steps ?? [],
    quotation.totals.grandTotal
  );

  const roomGroups = groupItemsByRoom(quotation.items);

  type RenderRow =
    | { type: 'room'; room: string; subtotal: number }
    | { type: 'item'; item: Quotation["items"][0]; displayIndex: number };

  const renderRows: RenderRow[] = [];
  if (usesRooms(quotation.items)) {
    roomGroups.forEach((group) => {
      renderRows.push({ type: 'room', room: group.room, subtotal: group.subtotal });
      group.items.forEach((itemInfo) =>
        renderRows.push({ type: 'item', item: itemInfo.item, displayIndex: itemInfo.displayIndex })
      );
    });
  } else {
    quotation.items.forEach((item, i) => renderRows.push({ type: 'item', item, displayIndex: i + 1 }));
  }

  // Product cards are taller, so fit 3 cards per page for high readability
  const MAX_FIRST_PAGE = 3;
  const MAX_N_PAGE = 4;

  const pages: RenderRow[][] = [];
  let currentPage: RenderRow[] = [];
  let currentHeight = 0;
  let isFirstPage = true;

  renderRows.forEach((row) => {
    const rowHeight = row.type === 'room' ? 0.6 : 1;
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
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return (
    <>
      <style>{`
        /* Design C — The Proposal: Product Cards, Catalogue Feel, Sales-Forward */
        .design-c-doc {
          --ink: #0f172a;
          --ink-muted: #475569;
          --ink-faint: #94a3b8;
          --brand: #14294A;
          --accent: #C9A227;
          --surface: #F8FAF9;
          --card: #ffffff;
          --line: #e2e8f0;
          font-family: "Inter", -apple-system, sans-serif;
          color: var(--ink);
          font-size: 9pt;
          line-height: 1.5;
        }

        .a4-sheet-c {
          width: 210mm;
          height: 297mm;
          background: var(--surface);
          margin: 0 auto 10mm auto;
          box-shadow: 0 12px 35px rgba(0,0,0,0.1);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 12mm 16mm;
        }

        @media print {
          .a4-sheet-c { margin: 0; box-shadow: none; height: 297mm; page-break-after: always; }
          @page { size: A4 portrait; margin: 0; }
        }

        /* Compact Header C */
        .dc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--card);
          padding: 4mm 6mm;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          margin-bottom: 5mm;
          border-left: 4pt solid var(--accent);
        }
        .dc-logo-wrap { display: flex; align-items: center; gap: 3mm; }
        .dc-logo-img { width: 14mm; height: 14mm; }
        .dc-logo-img img { width: 100%; height: 100%; object-fit: contain; }
        .dc-brand-title { font-family: Georgia, serif; font-size: 18pt; font-weight: 800; color: var(--brand); letter-spacing: 0.1em; }
        .dc-brand-sub { font-size: 7pt; color: var(--accent); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }

        .dc-quote-badge {
          background: var(--brand);
          color: white;
          padding: 2.5mm 5mm;
          border-radius: 6px;
          text-align: right;
        }
        .dc-qb-title { font-size: 11pt; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
        .dc-qb-no { font-size: 7.5pt; color: var(--accent); font-weight: 600; }

        /* Single-line Customer Bar C */
        .dc-client-bar {
          background: var(--card);
          padding: 3mm 6mm;
          border-radius: 6px;
          border: 1px solid var(--line);
          margin-bottom: 5mm;
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
        }
        .dc-cb-left { display: flex; gap: 4mm; align-items: center; }
        .dc-cb-name { font-weight: 800; color: var(--brand); font-size: 9.5pt; }

        /* Product Cards C */
        .dc-cards-container { flex: 1; display: flex; flex-direction: column; gap: 4mm; }

        .dc-room-title {
          font-size: 8.5pt;
          font-weight: 800;
          color: var(--brand);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 1.5mm 3mm;
          background: rgba(201, 162, 39, 0.15);
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
        }

        .dc-prod-card {
          background: var(--card);
          border-radius: 8px;
          border: 1px solid var(--line);
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          padding: 4mm 5mm;
          display: flex;
          gap: 5mm;
          align-items: center;
          position: relative;
        }
        .dc-card-num {
          position: absolute;
          top: 3mm;
          left: 4mm;
          background: var(--brand);
          color: white;
          width: 5.5mm;
          height: 5.5mm;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 7.5pt;
          font-weight: 800;
        }

        .dc-card-diag {
          width: 30mm;
          height: 30mm;
          background: #fafafa;
          border-radius: 6px;
          border: 1px solid var(--line);
          padding: 1mm;
          flex-shrink: 0;
          margin-left: 4mm;
        }
        .dc-card-diag > * { width: 100%; height: 100%; object-fit: contain; }

        .dc-card-main { flex: 1; }
        .dc-card-title { font-size: 10.5pt; font-weight: 800; color: var(--brand); text-transform: uppercase; margin-bottom: 2mm; }

        .dc-card-specs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 4mm;
          row-gap: 1.5mm;
          font-size: 7.5pt;
        }
        .dc-spec-item { display: flex; gap: 1.5mm; }
        .dc-spec-k { color: var(--ink-faint); font-weight: 700; text-transform: uppercase; font-size: 6.5pt; }
        .dc-spec-v { color: var(--ink); font-weight: 500; }

        .dc-card-price {
          text-align: right;
          background: var(--surface);
          padding: 3mm 4mm;
          border-radius: 6px;
          min-width: 32mm;
          flex-shrink: 0;
        }
        .dc-cp-size { font-size: 8pt; color: var(--ink-muted); font-weight: 600; margin-bottom: 1mm; }
        .dc-cp-rate { font-size: 7.5pt; color: var(--ink-faint); margin-bottom: 1.5mm; }
        .dc-cp-amt { font-size: 12pt; font-weight: 800; color: var(--brand); }

        /* Full Width Navy Grand Total Bar */
        .dc-gt-bar {
          background: var(--brand);
          color: white;
          padding: 4mm 6mm;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4mm;
        }
        .dc-gt-title { font-size: 11pt; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
        .dc-gt-val { font-size: 16pt; font-weight: 900; color: var(--accent); }

        /* Footer C */
        .dc-footer {
          margin-top: auto;
          padding-top: 3mm;
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          color: var(--ink-muted);
          font-weight: 500;
          border-top: 1px solid var(--line);
        }
      `}</style>

      <div className="design-c-doc">
        {pages.map((pageRows, pageIndex) => (
          <div key={pageIndex} className="a4-sheet-c">
            {/* Header C */}
            <div className="dc-header">
              <div className="dc-logo-wrap">
                <div className="dc-logo-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-mark.png" alt="" />
                </div>
                <div>
                  <div className="dc-brand-title">ROYAL</div>
                  <div className="dc-brand-sub">uPVC Doors &amp; Windows</div>
                </div>
              </div>
              <div className="dc-quote-badge">
                <div className="dc-qb-title">Quotation</div>
                <div className="dc-qb-no">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</div>
              </div>
            </div>

            {/* Client Bar C (Page 1) */}
            {pageIndex === 0 && (
              <div className="dc-client-bar">
                <div className="dc-cb-left">
                  <span>Prepared for</span>
                  <span className="dc-cb-name">{quotation.customer.name}</span>
                  {quotation.customer.siteAddress && (
                    <span style={{ color: "var(--ink-muted)" }}>&bull; {quotation.customer.siteAddress}</span>
                  )}
                </div>
                <div>
                  <span style={{ color: "var(--ink-muted)" }}>Date: </span>
                  <span style={{ fontWeight: 700 }}>{formatDate(date)}</span>
                </div>
              </div>
            )}

            {/* Product Cards Container */}
            <div className="dc-cards-container">
              {pageRows.map((row, rIdx) => {
                if (row.type === "room") {
                  return (
                    <div key={`room-${rIdx}`} className="dc-room-title">
                      <span>{row.room || "General"}</span>
                      <span>Subtotal: {formatINR(row.subtotal)}</span>
                    </div>
                  );
                } else {
                  const item = row.item;
                  return (
                    <div key={item.id} className="dc-prod-card">
                      <div className="dc-card-num">{row.displayIndex}</div>
                      <div className="dc-card-diag">
                        <WindowDiagram
                          type={item.diagram.type}
                          widthFt={item.billed.w}
                          heightFt={item.billed.h}
                          handing={item.diagram.handing}
                          fanPoint={item.diagram.fanPoint}
                          showDimensions={false}
                        />
                      </div>
                      <div className="dc-card-main">
                        <div className="dc-card-title">{item.description}</div>
                        <div className="dc-card-specs">
                          {item.specs.profile && (
                            <div className="dc-spec-item">
                              <span className="dc-spec-k">Profile:</span>
                              <span className="dc-spec-v">{item.specs.profile}</span>
                            </div>
                          )}
                          {item.specs.glass && (
                            <div className="dc-spec-item">
                              <span className="dc-spec-k">Glass:</span>
                              <span className="dc-spec-v">
                                {item.specs.glass} {item.specs.glassThickness}
                              </span>
                            </div>
                          )}
                          {item.specs.hardware && (
                            <div className="dc-spec-item">
                              <span className="dc-spec-k">Hardware:</span>
                              <span className="dc-spec-v">{item.specs.hardware}</span>
                            </div>
                          )}
                          {item.specs.mesh && (
                            <div className="dc-spec-item">
                              <span className="dc-spec-k">Mesh:</span>
                              <span className="dc-spec-v">{item.specs.mesh}</span>
                            </div>
                          )}
                          {item.specs.colour && (
                            <div className="dc-spec-item">
                              <span className="dc-spec-k">Color:</span>
                              <span className="dc-spec-v">{item.specs.colour}</span>
                            </div>
                          )}
                          {item.surcharges.map((key) => (
                            <div key={key} className="dc-spec-item">
                              <span className="dc-spec-k">Add-on:</span>
                              <span className="dc-spec-v">{SURCHARGE_LABELS[key] ?? key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="dc-card-price">
                        <div className="dc-cp-size">
                          {feetToArchLabel(item.billed.w)} × {feetToArchLabel(item.billed.h)} ({item.qty} nos)
                        </div>
                        <div className="dc-cp-rate">@ {formatINRCompact(effectiveRate(item))}/sqft</div>
                        <div className="dc-cp-amt">{formatINR(item.amount)}</div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>

            {/* Footer C */}
            <div className="dc-footer">
              <div>Royal Doors &amp; Windows &bull; Premium Proposal</div>
              <div style={{ color: "var(--brand)", fontWeight: 700 }}>
                Page {pageIndex + 1} of {pages.length + 1}
              </div>
            </div>
          </div>
        ))}

        {/* Dedicated Final Page C */}
        <div className="a4-sheet-c">
          <div className="dc-header">
            <div className="dc-logo-wrap">
              <div className="dc-logo-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="" />
              </div>
              <div>
                <div className="dc-brand-title">ROYAL</div>
                <div className="dc-brand-sub">uPVC Doors &amp; Windows</div>
              </div>
            </div>
            <div style={{ fontSize: "9pt", fontWeight: 700, color: "var(--brand)" }}>
              Ref: {withRevisionSuffix(quotation.quoteNo, quotation.revision)}
            </div>
          </div>

          {/* Grand Total Bar C */}
          <div className="dc-gt-bar">
            <div>
              <div className="dc-gt-title">Grand Total</div>
              <div style={{ fontSize: "7.5pt", color: "#cbd5e1" }}>
                Including Subtotal ({formatINR(quotation.totals.subtotal)})
                {quotation.gst.enabled ? ` + GST (${formatINR(quotation.totals.cgst + quotation.totals.sgst)})` : ""}
              </div>
            </div>
            <div className="dc-gt-val">{formatINR(quotation.totals.grandTotal)}</div>
          </div>

          {/* FAQ Style Terms */}
          <div style={{ marginTop: "6mm", flex: 1 }}>
            <div style={{ fontSize: "11pt", fontWeight: 800, color: "var(--brand)", marginBottom: "4mm" }}>
              Frequently Asked Questions &amp; Terms
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm", marginBottom: "6mm" }}>
              <div style={{ background: "white", padding: "4mm", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 800, color: "var(--brand)", fontSize: "8.5pt", marginBottom: "2mm" }}>
                  ✓ What is included in this quote?
                </div>
                <ul style={{ margin: 0, paddingLeft: "4mm", fontSize: "8pt", color: "var(--ink-muted)", lineHeight: 1.5 }}>
                  {specLines.map((line, i) => (
                    <li key={`s-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: "white", padding: "4mm", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 800, color: "var(--brand)", fontSize: "8.5pt", marginBottom: "2mm" }}>
                  ✓ What warranty do I get?
                </div>
                <ul style={{ margin: 0, paddingLeft: "4mm", fontSize: "8pt", color: "var(--ink-muted)", lineHeight: 1.5 }}>
                  {coverageLines.map((line, i) => (
                    <li key={`c-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm", marginBottom: "6mm" }}>
              <div style={{ background: "white", padding: "4mm", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 800, color: "var(--brand)", fontSize: "8.5pt", marginBottom: "2mm" }}>
                  Payment Schedule
                </div>
                {paymentStages.map((stage, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", padding: "1.5mm 0", borderBottom: "1px dashed var(--line)" }}>
                    <span>{stage.text}</span>
                    <span style={{ fontWeight: 700, color: "var(--brand)" }}>
                      {stage.amount !== null ? formatINR(stage.amount) : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ background: "white", padding: "4mm", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 800, color: "var(--brand)", fontSize: "8.5pt", marginBottom: "2mm" }}>
                  Bank Details
                </div>
                <div style={{ fontSize: "8pt", display: "grid", gridTemplateColumns: "22mm 1fr", rowGap: "1.5mm" }}>
                  <span style={{ color: "var(--ink-faint)" }}>Account</span>
                  <span style={{ fontWeight: 600 }}>{settings.bank?.accountName || settings.companyName}</span>
                  <span style={{ color: "var(--ink-faint)" }}>Bank</span>
                  <span style={{ fontWeight: 600 }}>{settings.bank?.bankName || "YES BANK"}</span>
                  <span style={{ color: "var(--ink-faint)" }}>A/C No</span>
                  <span style={{ fontWeight: 600 }}>{settings.bank?.accountNo}</span>
                  <span style={{ color: "var(--ink-faint)" }}>IFSC</span>
                  <span style={{ fontWeight: 600 }}>{settings.bank?.ifsc}</span>
                </div>
              </div>
            </div>

            {/* Signature Block C */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8mm" }}>
              <div style={{ textAlign: "center", width: "60mm" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "14pt", fontStyle: "italic", color: "var(--accent)", marginBottom: "10mm" }}>
                  Thank You!
                </div>
                <div style={{ borderTop: "1.5pt solid var(--brand)", paddingTop: "2mm", fontSize: "8pt", fontWeight: 800, color: "var(--brand)", textTransform: "uppercase" }}>
                  For {settings.companyName}
                </div>
              </div>
            </div>
          </div>

          <div className="dc-footer">
            <div>Royal Doors &amp; Windows &bull; Customer Proposal</div>
            <div style={{ color: "var(--brand)", fontWeight: 700 }}>
              Page {pages.length + 1} of {pages.length + 1}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
