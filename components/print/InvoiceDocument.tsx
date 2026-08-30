import { hsnSummary } from "@/lib/invoices";
import { formatINR } from "@/lib/money";
import { amountInWords } from "@/lib/words";
import type { Invoice, Settings } from "@/models/schemas";
import { PrintButton } from "./PrintButton";

const GREEN = "#0f3d2e";
const GREEN_DARK = "#0a2e22";
const GOLD = "#c9a227";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
/** Shared with the quotation document — see lib/money.ts. */
const rupees = formatINR;

export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings: Settings }) {
  const summary = hsnSummary(invoice);
  const isIntra = invoice.supplyType === "intra_state";

  return (
    <>
      <PrintButton />
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { background: #d9d9d9; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .inv {
          width: 210mm; min-height: 297mm; margin: 12px auto; background: #fff;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #1f2937; box-shadow: 0 0 16px rgba(0,0,0,0.18);
          font-size: 10px; line-height: 1.45;
        }
        @media print { .inv { margin: 0; box-shadow: none; width: auto; min-height: auto; } .no-print { display: none !important; } }
        .inv-head { background: linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%); color: #fff; padding: 6mm 12mm; display: flex; justify-content: space-between; align-items: flex-start; }
        .inv-brand { display: flex; gap: 8px; align-items: flex-start; }
        .logo-mark { width: 13mm; height: 13mm; border: 1.5px solid ${GOLD}; border-radius: 3px; overflow: hidden; flex-shrink: 0; }
        .logo-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .inv-title { color: ${GOLD}; font-size: 18px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .brand-name { color: ${GOLD}; font-size: 17px; font-weight: 700; font-family: Georgia, serif; }
        .brand-name small { display: block; color: #f2e6c2; font-size: 8px; letter-spacing: 0.12em; font-weight: 500; }
        .seller-meta { font-size: 8.5px; color: #cfe0d5; margin-top: 3px; }
        .body { padding: 5mm 12mm; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
        .block h4 { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: ${GOLD}; margin: 0 0 2px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
        .block p { margin: 1px 0; }
        .block .strong { font-weight: 700; font-size: 11px; color: ${GREEN}; }
        table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
        th { background: ${GREEN}; color: #fff; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; padding: 2mm 1.5mm; text-align: left; font-weight: 600; }
        td { padding: 1.8mm 1.5mm; border-bottom: 1px solid #eef1ee; }
        .num { text-align: right; }
        .totals { margin-top: 3mm; margin-left: auto; width: 78mm; }
        .totals .row { display: flex; justify-content: space-between; padding: 1mm 0; }
        .totals .grand { display: flex; justify-content: space-between; border-top: 2px solid ${GOLD}; margin-top: 1.5mm; padding-top: 1.5mm; font-size: 13px; font-weight: 700; color: ${GREEN}; }
        .words { margin-top: 3mm; padding: 2mm 3mm; background: #faf8f2; border-left: 3px solid ${GOLD}; font-size: 9.5px; }
        .words span { color: #6b7280; }
        .sub { font-size: 9px; color: #6b7280; }
        .decl { margin-top: 5mm; font-size: 8.5px; color: #4b5563; }
        .sign { margin-top: 8mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; }
        .sign .box { text-align: center; }
        .sign .space { height: 12mm; }
        .foot { margin-top: 6mm; background: ${GOLD}; color: ${GREEN_DARK}; padding: 2.5mm 12mm; font-size: 8px; font-weight: 600; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .eoe { text-align: right; font-size: 8px; color: #9ca3af; margin-top: 2mm; }
      `}</style>

      <div className="inv">
        <div className="inv-head">
          <div className="inv-brand">
            <div className="logo-mark">
              {/* eslint-disable-next-line @next/next/no-img-element -- print document renders outside next/image's optimization pipeline */}
              <img src="/logo-mark.png" alt="" />
            </div>
            <div>
              <div className="brand-name">
                ROYAL<small>DOORS AND WINDOWS</small>
              </div>
              <div className="seller-meta">
                {settings.addressLines.join(", ")}
                <br />
                GSTIN/UIN: {settings.gstin} &nbsp;·&nbsp; State: {settings.stateName}, Code: {settings.stateCode}
                {settings.phone && <> &nbsp;·&nbsp; {settings.phone}</>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="inv-title">Tax Invoice</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginTop: 2 }}>{invoice.invoiceNo}</div>
            <div style={{ fontSize: 9, color: "#cfe0d5" }}>Dated {formatDate(invoice.date)}</div>
          </div>
        </div>

        <div className="body">
          <div className="grid2">
            <div className="block">
              <h4>Buyer (Bill to)</h4>
              <p className="strong">{invoice.buyer.name}</p>
              {invoice.buyer.addressLines.filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p>GSTIN/UIN: {invoice.buyer.gstin || "—"}</p>
              <p>
                State Name: {invoice.buyer.stateName || settings.stateName}, Code:{" "}
                {invoice.buyer.stateCode || settings.stateCode}
              </p>
            </div>
            <div className="block">
              <h4>Reference</h4>
              <p>Quotation: {invoice.quoteNo}</p>
              <p>
                Supply: {isIntra ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"}
              </p>
              {invoice.vehicleNo && <p>Vehicle No.: {invoice.vehicleNo}</p>}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: "7mm" }}>#</th>
                <th>Description of Goods / Services</th>
                <th style={{ width: "18mm" }}>HSN/SAC</th>
                <th style={{ width: "20mm" }} className="num">
                  Quantity
                </th>
                <th style={{ width: "20mm" }} className="num">
                  Rate
                </th>
                <th style={{ width: "26mm" }} className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={line.id}>
                  <td style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td>{line.description}</td>
                  <td>{line.hsnSac}</td>
                  <td className="num">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="num">{rupees(line.rate)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {rupees(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">
            <div className="row">
              <span>Taxable Value</span>
              <span>{rupees(invoice.totals.taxableValue)}</span>
            </div>
            {isIntra ? (
              <>
                <div className="row">
                  <span>CGST @ {invoice.gstRate / 2}%</span>
                  <span>{rupees(invoice.totals.cgst)}</span>
                </div>
                <div className="row">
                  <span>SGST @ {invoice.gstRate / 2}%</span>
                  <span>{rupees(invoice.totals.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="row">
                <span>IGST @ {invoice.gstRate}%</span>
                <span>{rupees(invoice.totals.igst)}</span>
              </div>
            )}
            {invoice.totals.transportation > 0 && (
              <div className="row">
                <span>Transportation</span>
                <span>{rupees(invoice.totals.transportation)}</span>
              </div>
            )}
            {Math.abs(invoice.totals.roundOff) >= 0.01 && (
              <div className="row">
                <span>Round Off</span>
                <span>{rupees(invoice.totals.roundOff)}</span>
              </div>
            )}
            <div className="grand">
              <span>Total</span>
              <span>₹{invoice.totals.grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="words">
            <span>Amount Chargeable (in words)</span>
            <br />
            <strong>{amountInWords(invoice.totals.grandTotal)}</strong>
          </div>

          {/* HSN summary — required on a GST tax invoice */}
          <table>
            <thead>
              <tr>
                <th>HSN/SAC</th>
                <th className="num">Taxable Value</th>
                {isIntra ? (
                  <>
                    <th className="num">Central Tax Rate</th>
                    <th className="num">Central Tax Amount</th>
                    <th className="num">State Tax Rate</th>
                    <th className="num">State Tax Amount</th>
                  </>
                ) : (
                  <>
                    <th className="num">IGST Rate</th>
                    <th className="num">IGST Amount</th>
                  </>
                )}
                <th className="num">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.hsnSac}>
                  <td>{row.hsnSac}</td>
                  <td className="num">{rupees(row.taxableValue)}</td>
                  {isIntra ? (
                    <>
                      <td className="num">{row.centralRate}%</td>
                      <td className="num">{rupees(row.centralAmount)}</td>
                      <td className="num">{row.stateRate}%</td>
                      <td className="num">{rupees(row.stateAmount)}</td>
                    </>
                  ) : (
                    <>
                      <td className="num">{row.igstRate}%</td>
                      <td className="num">{rupees(row.igstAmount)}</td>
                    </>
                  )}
                  <td className="num" style={{ fontWeight: 600 }}>
                    {rupees(row.totalTax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid2" style={{ marginTop: "5mm" }}>
            <div className="block">
              <h4>Bank Details</h4>
              <p>Name — {settings.bank.accountName}</p>
              <p>Bank: {settings.bank.bankName}</p>
              <p>A/c No: {settings.bank.accountNo}</p>
              <p>IFSC: {settings.bank.ifsc}</p>
              <p>Branch: {settings.bank.branch}</p>
            </div>
            <div>
              <div className="decl">
                <strong>Declaration</strong>
                <br />
                {invoice.declaration}
              </div>
            </div>
          </div>

          <div className="sign">
            <div className="box">
              <div className="space" />
              <p className="sub">Customer Signature</p>
            </div>
            <div className="box">
              <p className="sub">For {settings.companyName}</p>
              <div className="space" />
              <p style={{ fontWeight: 700, color: GREEN }}>Authorised Signatory</p>
            </div>
          </div>

          <p className="eoe">E. &amp; O.E</p>
        </div>

        <div className="foot">
          <span>{settings.phone}</span>
          {settings.website && <span>{settings.website}</span>}
          {settings.email && <span>{settings.email}</span>}
        </div>
      </div>
    </>
  );
}
