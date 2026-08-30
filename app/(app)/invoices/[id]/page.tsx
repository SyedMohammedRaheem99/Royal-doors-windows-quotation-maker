import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { loadInvoiceFor } from "@/lib/invoices";
import { amountInWords } from "@/lib/words";

// No loading.tsx — see app/(app)/quotations/[id]/page.tsx for why a
// Suspense boundary would undermine the ownership check's 404 status.
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = await resolveActor(await auth());
  if (!actor) notFound();

  const loaded = await loadInvoiceFor(id, actor);
  if (!loaded.ok) notFound();
  const invoice = loaded.data;
  const isIntra = invoice.supplyType === "intra_state";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{invoice.invoiceNo}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {invoice.buyer.name} · from{" "}
            <Link href={`/quotations/${invoice.quotationId}`} className="text-[#0f3d2e] hover:underline">
              {invoice.quoteNo}
            </Link>
          </p>
        </div>
        <Link
          href={`/invoices/${id}/print`}
          target="_blank"
          className="rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#0c3125]"
        >
          Print / Save as PDF
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">HSN/SAC</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={line.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-4 py-2">{line.description}</td>
                <td className="px-4 py-2 text-neutral-500">{line.hsnSac}</td>
                <td className="px-4 py-2 text-right">
                  {line.quantity} {line.unit}
                </td>
                <td className="px-4 py-2 text-right">₹{line.rate.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2 text-right font-medium">₹{line.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Taxable value</span>
          <span>₹{invoice.totals.taxableValue.toLocaleString("en-IN")}</span>
        </div>
        {isIntra ? (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>CGST @ {invoice.gstRate / 2}%</span>
              <span>₹{invoice.totals.cgst.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>SGST @ {invoice.gstRate / 2}%</span>
              <span>₹{invoice.totals.sgst.toLocaleString("en-IN")}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-neutral-600">
            <span>IGST @ {invoice.gstRate}%</span>
            <span>₹{invoice.totals.igst.toLocaleString("en-IN")}</span>
          </div>
        )}
        {invoice.totals.transportation > 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Transportation</span>
            <span>₹{invoice.totals.transportation.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 text-base font-semibold text-[#0f3d2e]">
          <span>Total</span>
          <span>₹{invoice.totals.grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>
      <p className="mt-2 text-right text-xs italic text-neutral-500">{amountInWords(invoice.totals.grandTotal)}</p>
    </div>
  );
}
