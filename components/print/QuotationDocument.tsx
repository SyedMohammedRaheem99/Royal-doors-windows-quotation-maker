import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel } from "@/lib/dimensions";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering";
import type { Quotation, Settings } from "@/models/schemas";
import { PrintButton } from "./PrintButton";

const GREEN = "#0f3d2e";
const GREEN_DARK = "#0a2e22";
const GOLD = "#c9a227";
const CREAM = "#faf8f2";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const FEATURES = ["Strong", "Insulated", "Soundproof", "Secure"];

export function QuotationDocument({ quotation, settings }: { quotation: Quotation; settings: Settings }) {
  const date = new Date(quotation.date);
  const validUntil = new Date(date.getTime() + quotation.terms.validityDays * 86400000);
  const boiler = settings.terms.boilerplate;

  // Canonical 10-point Note structure mined from the reference quotations —
  // job-specific lines (profile/glass/warranty/duration) interleaved with the
  // fixed boilerplate, in the same order the original documents used.
  const noteLines = [
    quotation.terms.profile,
    boiler[0], // aluminium mesh screen
    quotation.terms.glass,
    boiler[1], // reinforcement GI all 4 sides
    `Warranty ${quotation.terms.warrantyYears} years for outer frame and fly shutters & no warranty for Aluminum mesh.`,
    quotation.terms.workDuration
      ? `Work duration ${quotation.terms.workDuration.fromDays} to ${quotation.terms.workDuration.toDays} days from the day of advance.`
      : null,
    boiler[2], // no warranty glass & hardware
    boiler[3], // silicon one side
    boiler[4], // premium hardware
    ...quotation.terms.extraNotes,
  ].filter((line): line is string => Boolean(line));

  const additionalNotes = boiler.slice(5);

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
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #26302b;
          box-shadow: 0 0 16px rgba(0,0,0,0.18);
          font-size: 10.5px;
          line-height: 1.4;
        }
        @media print {
          .quote-doc { margin: 0; box-shadow: none; width: auto; min-height: auto; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
        .content { padding: 4mm 14mm; }
        .band-header {
          background: linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%);
          color: white;
          padding: 8mm 14mm 6mm;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand { display: flex; gap: 10px; align-items: center; }
        .logo-mark {
          width: 15mm; height: 15mm; border: 1.5px solid ${GOLD}; border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 22px; color: ${GOLD};
        }
        .brand-name { color: ${GOLD}; font-size: 19px; font-weight: 700; letter-spacing: 0.03em; font-family: Georgia, "Times New Roman", serif; }
        .brand-name small { display: block; color: #f2e6c2; font-size: 9px; font-weight: 500; letter-spacing: 0.12em; margin-top: 1px; }
        .brand-tag { color: #cfe0d5; font-size: 8.5px; margin-top: 3px; }
        .quote-meta { text-align: right; font-size: 9.5px; color: #e8efe9; }
        .quote-meta .qno { color: ${GOLD}; font-size: 13px; font-weight: 700; margin-bottom: 3px; }
        .quote-meta .row { display: flex; justify-content: flex-end; gap: 8px; }
        .quote-meta .row span:first-child { color: #a9c2b1; }

        .feature-strip {
          background: ${CREAM}; border-bottom: 1px solid #e6ddc4;
          padding: 2.5mm 14mm; display: flex; justify-content: center;
          font-size: 8.5px; text-transform: uppercase; color: ${GREEN}; font-weight: 600;
        }
        .feature-strip .feature { padding: 0 14px; letter-spacing: 0.1em; border-right: 1px solid #d8cfa8; }
        .feature-strip .feature:last-child { border-right: none; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 5mm; }
        .info-card h3 {
          font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em; color: ${GOLD};
          border-bottom: 1px solid #e6ddc4; padding-bottom: 2px; margin-bottom: 3px; font-weight: 700;
        }
        .info-card p { margin: 1px 0; font-size: 10px; }
        .info-card p.name { font-weight: 700; font-size: 11.5px; color: ${GREEN}; }

        .section-title {
          margin-top: 6mm; margin-bottom: 3mm; font-size: 12px; font-weight: 700; color: ${GREEN};
          border-bottom: 2px solid ${GOLD}; padding-bottom: 3px;
        }

        .item-card {
          display: grid; grid-template-columns: 34mm 1fr 26mm; gap: 4mm;
          border: 1px solid #e6ddc4; border-radius: 3px; padding: 3mm; margin-bottom: 3mm; background: white;
        }
        .item-diagram { display: flex; align-items: center; justify-content: center; }
        .item-head { display: flex; gap: 6px; align-items: baseline; }
        .item-no {
          background: ${GREEN}; color: ${GOLD}; font-size: 9px; font-weight: 700;
          width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .item-desc { font-weight: 700; font-size: 11px; color: #1f2937; }
        .item-specs { margin-top: 2px; font-size: 8.5px; color: #6b7280; display: flex; flex-wrap: wrap; gap: 4px 10px; }
        .item-dims { margin-top: 3px; font-size: 9px; color: ${GREEN}; font-weight: 600; }
        .item-price { text-align: right; display: flex; flex-direction: column; justify-content: center; }
        .item-price .rate { font-size: 8px; color: #9ca3af; }
        .item-price .amount { font-size: 12px; font-weight: 700; color: ${GREEN}; }

        .totals-wrap { display: flex; justify-content: flex-end; margin-top: 4mm; }
        .totals-box { width: 65mm; border: 1.5px solid ${GOLD}; border-radius: 3px; padding: 3mm 4mm; background: white; }
        .totals-box .row { display: flex; justify-content: space-between; font-size: 10px; padding: 1.5px 0; color: #4b5563; }
        .totals-box .grand {
          display: flex; justify-content: space-between; margin-top: 2mm; padding-top: 2mm;
          border-top: 1px solid #e6ddc4; font-size: 13px; font-weight: 700; color: ${GREEN};
        }
        .words { text-align: right; font-size: 9px; font-style: italic; color: #6b7280; margin-top: 2mm; }

        .terms h3, .bank h3 {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: ${GREEN};
          font-weight: 700; margin-top: 5mm; margin-bottom: 2mm; border-bottom: 1px solid #e6ddc4; padding-bottom: 2px;
        }
        .terms ol { margin: 0; padding-left: 14px; font-size: 9.5px; }
        .terms ol li { margin-bottom: 1.5px; }
        .terms .additional { font-size: 8px; color: #9ca3af; margin-top: 2mm; padding-left: 14px; }
        .terms .additional li { margin-bottom: 1px; }

        .bank p { margin: 1px 0; font-size: 9.5px; }

        .signature { margin-top: 8mm; display: flex; justify-content: space-between; align-items: flex-end; }
        .signature .sig-block { text-align: center; font-size: 9.5px; }
        .signature .sig-space { height: 12mm; }
        .signature .name { font-weight: 700; color: ${GREEN}; }

        .band-footer {
          margin-top: 8mm; background: ${GOLD}; color: ${GREEN_DARK};
          padding: 3mm 14mm; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
          font-size: 8.5px; font-weight: 600;
        }
      `}</style>

      <div className="quote-doc avoid-break">
        <div className="band-header">
          <div className="brand">
            <div className="logo-mark">R</div>
            <div>
              <div className="brand-name">
                ROYAL
                <small>DOORS AND WINDOWS</small>
              </div>
              <div className="brand-tag">Premium uPVC · Aluminium · WPC Doors &amp; Windows</div>
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

        <div className="feature-strip">
          {FEATURES.map((f) => (
            <span key={f} className="feature">
              {f}
            </span>
          ))}
        </div>

        <div className="content">
          <div className="info-grid avoid-break">
            <div className="info-card">
              <h3>Customer</h3>
              <p className="name">{quotation.customer.name}</p>
              {quotation.customer.phone && <p>{quotation.customer.phone}</p>}
              {quotation.customer.siteAddress && <p>{quotation.customer.siteAddress}</p>}
              {quotation.customer.gstin && <p>GSTIN: {quotation.customer.gstin}</p>}
            </div>
            <div className="info-card">
              <h3>Project</h3>
              {quotation.customer.project && <p>{quotation.customer.project}</p>}
              {quotation.customer.referredBy && <p>Referred by: {quotation.customer.referredBy}</p>}
              {quotation.gst.enabled && settings.gstin && <p>Our GSTIN: {settings.gstin}</p>}
            </div>
          </div>

          <div className="section-title">Quotation for Supply &amp; Installation</div>

          <div>
            {quotation.items.map((item, i) => (
              <div key={item.id} className="item-card avoid-break">
                <div className="item-diagram">
                  <WindowDiagram
                    type={item.diagram.type}
                    widthFt={item.billed.w}
                    heightFt={item.billed.h}
                    handing={item.diagram.handing}
                    fanPoint={item.diagram.fanPoint}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="item-head">
                    <span className="item-no">{i + 1}</span>
                    <span className="item-desc">{item.description}</span>
                  </div>
                  <div className="item-specs">
                    {item.specs.colour && <span>Colour: {item.specs.colour}</span>}
                    {item.specs.glass && <span>Glass: {item.specs.glass}</span>}
                    {item.specs.mesh && <span>Mesh: {item.specs.mesh}</span>}
                    {item.surcharges.length > 0 && <span>+ {item.surcharges.length} surcharge(s) applied</span>}
                    {item.remarks && <span>{item.remarks}</span>}
                  </div>
                  <div className="item-dims">
                    {feetToArchLabel(item.billed.w)} × {feetToArchLabel(item.billed.h)} &nbsp;·&nbsp; Qty {item.qty}
                    &nbsp;·&nbsp; {item.totalAreaSqft} sqft
                  </div>
                </div>
                <div className="item-price">
                  <div className="rate">
                    ₹{item.rate}/{item.pricingMode === "per_sqft" ? "sqft" : "pc"}
                  </div>
                  <div className="amount">₹{item.amount.toLocaleString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="totals-wrap avoid-break">
            <div>
              <div className="totals-box">
                <div className="row">
                  <span>Subtotal</span>
                  <span>₹{quotation.totals.subtotal.toLocaleString("en-IN")}</span>
                </div>
                {quotation.gst.enabled && (
                  <>
                    <div className="row">
                      <span>CGST ({quotation.gst.rate / 2}%)</span>
                      <span>₹{quotation.totals.cgst.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="row">
                      <span>SGST ({quotation.gst.rate / 2}%)</span>
                      <span>₹{quotation.totals.sgst.toLocaleString("en-IN")}</span>
                    </div>
                  </>
                )}
                {quotation.totals.transportation > 0 && (
                  <div className="row">
                    <span>Transportation</span>
                    <span>₹{quotation.totals.transportation.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="grand">
                  <span>Grand Total</span>
                  <span>₹{quotation.totals.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <p className="words">{amountInWords(quotation.totals.grandTotal)}</p>
            </div>
          </div>

          <div className="terms avoid-break">
            <h3>Note</h3>
            <ol>
              {noteLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            {additionalNotes.length > 0 && (
              <ul className="additional">
                {additionalNotes.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="terms avoid-break">
            <h3>Payment Stage</h3>
            <ol>
              {quotation.terms.paymentScheme?.steps.map((step, i) => <li key={i}>{step}</li>)}
              <li>This Invoice is valid for {quotation.terms.validityDays} days from the date.</li>
            </ol>
          </div>

          <div className="bank avoid-break">
            <h3>Bank Details</h3>
            <p>Name - {settings.bank.accountName}</p>
            <p>BANK: {settings.bank.bankName}</p>
            <p>Ac No: {settings.bank.accountNo}</p>
            <p>IFSC CODE: {settings.bank.ifsc}</p>
            <p>BRANCH: {settings.bank.branch}</p>
          </div>

          <div className="signature avoid-break">
            <div className="sig-block">
              <div className="sig-space" />
              <p>Customer Signature</p>
            </div>
            <div className="sig-block">
              <p>For {settings.companyName}</p>
              <div className="sig-space" />
              <p className="name">Authorised Signatory</p>
            </div>
          </div>
        </div>

        <div className="band-footer">
          <span>{settings.phone}</span>
          <span>{settings.website}</span>
          <span>{settings.email}</span>
          <span>{settings.addressLines.join(", ")}</span>
        </div>
      </div>
    </>
  );
}
