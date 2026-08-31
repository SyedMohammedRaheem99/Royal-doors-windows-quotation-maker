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

export function QuotationDesignA({
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

  const MAX_FIRST_PAGE = 4;
  const MAX_N_PAGE = 6;

  const pages: RenderRow[][] = [];
  let currentPage: RenderRow[] = [];
  let currentHeight = 0;
  let isFirstPage = true;

  renderRows.forEach((row) => {
    const rowHeight = row.type === 'room' ? 0.7 : 1;
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
        /* Design A — The Architect: Minimal, Typography-Driven, Black & White + Gold */
        .design-a-doc {
          --ink: #111827;
          --ink-muted: #6b7280;
          --ink-faint: #9ca3af;
          --accent: #C5A55A;
          --line: #e5e7eb;
          --paper: #ffffff;
          font-family: "Inter", -apple-system, sans-serif;
          color: var(--ink);
          font-size: 9pt;
          line-height: 1.5;
        }

        .a4-sheet-a {
          width: 210mm;
          height: 297mm;
          background: var(--paper);
          margin: 0 auto 10mm auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 15mm 18mm 12mm 18mm;
        }

        @media print {
          .a4-sheet-a { margin: 0; box-shadow: none; height: 297mm; page-break-after: always; }
          @page { size: A4 portrait; margin: 0; }
        }

        /* Header A */
        .da-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 5mm;
          border-bottom: 0.5pt solid var(--accent);
          margin-bottom: 8mm;
        }
        .da-brand-box { display: flex; align-items: center; gap: 4mm; }
        .da-logo { width: 16mm; height: 16mm; }
        .da-logo img { width: 100%; height: 100%; object-fit: contain; }
        .da-divider { width: 1px; height: 12mm; background: var(--accent); opacity: 0.6; }
        .da-brand-name { font-family: Georgia, serif; font-size: 20pt; font-weight: 700; letter-spacing: 0.15em; color: var(--ink); }
        .da-tagline { font-size: 7pt; letter-spacing: 0.2em; color: var(--accent); font-weight: 600; text-transform: uppercase; margin-top: 1mm; }

        .da-contact { text-align: right; font-size: 7.5pt; color: var(--ink-muted); line-height: 1.6; }

        /* Meta A */
        .da-meta-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12mm;
          margin-bottom: 8mm;
        }
        .da-meta-title { font-size: 16pt; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink); margin-bottom: 3mm; }
        .da-meta-row { display: flex; justify-content: space-between; padding: 1.5mm 0; border-bottom: 0.5pt solid var(--line); font-size: 8pt; }
        .da-meta-label { color: var(--ink-muted); font-weight: 500; }
        .da-meta-val { font-weight: 600; color: var(--ink); }

        .da-party-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 2mm; }
        .da-party-name { font-size: 11pt; font-weight: 700; color: var(--ink); margin-bottom: 1mm; }
        .da-party-text { font-size: 8.5pt; color: var(--ink-muted); line-height: 1.4; }

        /* Table A */
        .da-table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
        .da-table th { text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-muted); padding: 3mm 2mm; border-bottom: 1.5pt solid var(--ink); }
        .da-table td { padding: 4mm 2mm; vertical-align: top; border-bottom: 0.5pt solid var(--line); font-size: 8.5pt; }

        .da-room-row td { background: #fafafa; font-size: 8pt; font-weight: 700; color: var(--ink); letter-spacing: 0.05em; text-transform: uppercase; padding: 2.5mm 2mm; border-bottom: 1pt solid var(--ink); }

        .da-item-desc { display: flex; gap: 4mm; align-items: flex-start; }
        .da-diag { width: 22mm; height: 22mm; border: 0.5pt solid var(--line); padding: 1mm; border-radius: 2px; flex-shrink: 0; background: white; }
        .da-diag > * { width: 100%; height: 100%; object-fit: contain; }
        .da-item-title { font-size: 9.5pt; font-weight: 700; color: var(--ink); margin-bottom: 1.5mm; }
        .da-spec-list { font-size: 7.5pt; color: var(--ink-muted); display: grid; grid-template-columns: auto 1fr; column-gap: 2mm; row-gap: 1mm; }

        /* Totals A */
        .da-totals-wrap { display: flex; justify-content: flex-end; margin-top: 4mm; margin-bottom: 6mm; }
        .da-totals-box { width: 45%; }
        .da-tot-line { display: flex; justify-content: space-between; padding: 2mm 0; font-size: 8.5pt; color: var(--ink-muted); border-bottom: 0.5pt solid var(--line); }
        .da-grand-line { display: flex; justify-content: space-between; padding: 3mm 0; font-size: 13pt; font-weight: 800; color: var(--ink); border-top: 1.5pt solid var(--ink); border-bottom: 1.5pt solid var(--ink); margin-top: 2mm; }
        .da-grand-val { color: var(--accent); }
        .da-words { font-size: 7.5pt; color: var(--ink-faint); font-style: italic; text-align: right; margin-top: 2mm; }

        /* Terms Page A */
        .da-section-heading { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink); border-bottom: 1pt solid var(--accent); padding-bottom: 1.5mm; margin-bottom: 4mm; margin-top: 4mm; }
        .da-list { margin: 0; padding-left: 4mm; font-size: 8.5pt; color: var(--ink-muted); line-height: 1.7; }
        .da-list li { margin-bottom: 1mm; }

        .da-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-bottom: 6mm; }
        .da-card-light { padding: 4mm; background: #fafafa; border: 0.5pt solid var(--line); border-radius: 2px; }
        .da-card-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink); margin-bottom: 3mm; }

        .da-pay-step { display: flex; justify-content: space-between; font-size: 8.5pt; padding: 2mm 0; border-bottom: 0.5pt solid var(--line); }
        .da-bank-row { display: grid; grid-template-columns: 26mm 1fr; font-size: 8pt; padding: 1.5mm 0; }

        .da-sig-wrap { display: flex; justify-content: flex-end; margin-top: 15mm; }
        .da-sig-box { text-align: center; width: 60mm; }
        .da-sig-title { font-family: Georgia, serif; font-size: 14pt; font-style: italic; color: var(--accent); margin-bottom: 12mm; }
        .da-sig-line { border-top: 0.5pt solid var(--ink); padding-top: 2mm; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }

        /* Footer A */
        .da-footer {
          margin-top: auto;
          padding-top: 4mm;
          border-top: 0.5pt solid var(--accent);
          display: flex;
          justify-content: space-between;
          font-size: 7pt;
          color: var(--ink-faint);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="design-a-doc">
        {pages.map((pageRows, pageIndex) => (
          <div key={pageIndex} className="a4-sheet-a">
            {/* Header */}
            <div className="da-header">
              <div className="da-brand-box">
                <div className="da-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-mark.png" alt="" />
                </div>
                <div className="da-divider"></div>
                <div>
                  <div className="da-brand-name">ROYAL</div>
                  <div className="da-tagline">uPVC Doors &amp; Windows</div>
                </div>
              </div>
              <div className="da-contact">
                {settings.phone && <div>{formatPhone(settings.phone)}</div>}
                {settings.email && <div>{settings.email}</div>}
                {settings.website && <div>{settings.website}</div>}
              </div>
            </div>

            {/* Meta & Customer on Page 1 only */}
            {pageIndex === 0 && (
              <div className="da-meta-section">
                <div>
                  <div className="da-meta-title">Quotation</div>
                  <div className="da-meta-row">
                    <span className="da-meta-label">Quotation No.</span>
                    <span className="da-meta-val">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</span>
                  </div>
                  <div className="da-meta-row">
                    <span className="da-meta-label">Date</span>
                    <span className="da-meta-val">{formatDate(date)}</span>
                  </div>
                  <div className="da-meta-row">
                    <span className="da-meta-label">Valid Until</span>
                    <span className="da-meta-val">{formatDate(validUntil)}</span>
                  </div>
                </div>

                <div>
                  <div className="da-party-title">Client &amp; Project</div>
                  <div className="da-party-name">{quotation.customer.name}</div>
                  <div className="da-party-text">
                    {quotation.customer.project && <div><strong>Project:</strong> {quotation.customer.project}</div>}
                    {quotation.customer.siteAddress && <div>{quotation.customer.siteAddress}</div>}
                    {preparedByName && <div style={{ marginTop: '2mm' }}>Prepared by {preparedByName}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <table className="da-table">
              <thead>
                <tr>
                  <th style={{ width: '6%', textAlign: 'center' }}>S.No</th>
                  <th style={{ width: '52%' }}>Description &amp; Specifications</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Size (ft)</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rIdx) => {
                  if (row.type === 'room') {
                    return (
                      <tr key={`room-${rIdx}`} className="da-room-row">
                        <td colSpan={6}>
                          {row.room || "General"}
                          <span style={{ float: 'right', fontWeight: 500, color: 'var(--ink-muted)' }}>
                            Subtotal: {formatINR(row.subtotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  } else {
                    const item = row.item;
                    return (
                      <tr key={item.id}>
                        <td style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>{row.displayIndex}</td>
                        <td>
                          <div className="da-item-desc">
                            <div className="da-diag">
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
                              <div className="da-item-title">{item.description}</div>
                              <div className="da-spec-list">
                                {item.specs.profile && <><span style={{ color: 'var(--ink-faint)' }}>Profile:</span><span>{item.specs.profile}</span></>}
                                {item.specs.glass && <><span style={{ color: 'var(--ink-faint)' }}>Glass:</span><span>{item.specs.glass} {item.specs.glassThickness}</span></>}
                                {item.specs.hardware && <><span style={{ color: 'var(--ink-faint)' }}>Hardware:</span><span>{item.specs.hardware}</span></>}
                                {item.specs.mesh && <><span style={{ color: 'var(--ink-faint)' }}>Mesh:</span><span>{item.specs.mesh}</span></>}
                                {item.specs.colour && <><span style={{ color: 'var(--ink-faint)' }}>Color:</span><span>{item.specs.colour}</span></>}
                                {item.surcharges.map((key) => (
                                  <React.Fragment key={key}>
                                    <span style={{ color: 'var(--ink-faint)' }}>Add-on:</span>
                                    <span>{SURCHARGE_LABELS[key] ?? key}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{feetToArchLabel(item.billed.w)} × {feetToArchLabel(item.billed.h)}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatINRCompact(effectiveRate(item))}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(item.amount)}</td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>

            {/* Footer A */}
            <div className="da-footer">
              <div>Royal Doors &amp; Windows &bull; Architectural Fenestration</div>
              <div>Page {pageIndex + 1} of {pages.length + 1}</div>
            </div>
          </div>
        ))}

        {/* Dedicated Final Terms Page */}
        <div className="a4-sheet-a">
          <div className="da-header">
            <div className="da-brand-box">
              <div className="da-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="" />
              </div>
              <div className="da-divider"></div>
              <div>
                <div className="da-brand-name">ROYAL</div>
                <div className="da-tagline">uPVC Doors &amp; Windows</div>
              </div>
            </div>
            <div className="da-contact">
              <div>Ref: {withRevisionSuffix(quotation.quoteNo, quotation.revision)}</div>
            </div>
          </div>

          {/* Totals */}
          <div className="da-totals-wrap">
            <div className="da-totals-box">
              <div className="da-tot-line">
                <span>Product Subtotal</span>
                <span>{formatINR(quotation.totals.subtotal)}</span>
              </div>
              {quotation.gst.enabled && (
                <div className="da-tot-line">
                  <span>GST @{quotation.gst.rate}%</span>
                  <span>{formatINR(quotation.totals.cgst + quotation.totals.sgst)}</span>
                </div>
              )}
              {quotation.totals.transportation > 0 && (
                <div className="da-tot-line">
                  <span>Transportation &amp; Handling</span>
                  <span>{formatINR(quotation.totals.transportation)}</span>
                </div>
              )}
              <div className="da-grand-line">
                <span>Grand Total</span>
                <span className="da-grand-val">{formatINR(quotation.totals.grandTotal)}</span>
              </div>
              <div className="da-words">Rupees {amountInWords(quotation.totals.grandTotal)} Only.</div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="da-section-heading">Terms &amp; Conditions</div>
          <ul className="da-list" style={{ marginBottom: '6mm' }}>
            <li>This quotation is valid for {quotation.terms.validityDays} days from the date of issue.</li>
            <li>All measurements are to be confirmed at site prior to fabrication.</li>
            <li>Any changes in dimensions, design, or specifications will affect the final billing.</li>
            {specLines.map((line, i) => <li key={`s-${i}`}>{line}</li>)}
            {coverageLines.map((line, i) => <li key={`c-${i}`}>{line}</li>)}
            {conditionLines.map((line, i) => <li key={`cd-${i}`}>{line}</li>)}
          </ul>

          <div className="da-grid-2">
            <div className="da-card-light">
              <div className="da-card-title">Payment Milestones</div>
              {paymentStages.map((stage, i) => (
                <div key={i} className="da-pay-step">
                  <span>{String(i + 1).padStart(2, '0')}. {stage.text}</span>
                  <span style={{ fontWeight: 600 }}>{stage.amount !== null ? formatINR(stage.amount) : ""}</span>
                </div>
              ))}
            </div>

            <div className="da-card-light">
              <div className="da-card-title">Bank Details</div>
              <div className="da-bank-row"><span style={{ color: 'var(--ink-muted)' }}>Account</span><span>{settings.bank?.accountName || settings.companyName}</span></div>
              <div className="da-bank-row"><span style={{ color: 'var(--ink-muted)' }}>Bank</span><span>{settings.bank?.bankName || "YES BANK"}</span></div>
              <div className="da-bank-row"><span style={{ color: 'var(--ink-muted)' }}>A/C No.</span><span>{settings.bank?.accountNo}</span></div>
              <div className="da-bank-row"><span style={{ color: 'var(--ink-muted)' }}>IFSC</span><span>{settings.bank?.ifsc}</span></div>
              <div className="da-bank-row"><span style={{ color: 'var(--ink-muted)' }}>Branch</span><span>{settings.bank?.branch}</span></div>
            </div>
          </div>

          <div className="da-sig-wrap">
            <div className="da-sig-box">
              <div className="da-sig-title">Thank You</div>
              <div className="da-sig-line">For {settings.companyName}</div>
            </div>
          </div>

          <div className="da-footer">
            <div>Royal Doors &amp; Windows &bull; Commercial Proposal</div>
            <div>Page {pages.length + 1} of {pages.length + 1}</div>
          </div>
        </div>
      </div>
    </>
  );
}
