import { ObjectId } from "mongodb";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering";
import { duplicateQuotation } from "@/lib/quotations";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const session = await auth();
  const db = await getDb();
  const quotation = await db.collection("quotations").findOne({ _id: new ObjectId(id) });
  if (!quotation) notFound();
  if (session?.user.role !== "admin" && quotation.createdBy !== session?.user.id) notFound();

  async function duplicateAction() {
    "use server";
    const session2 = await auth();
    if (!session2?.user) return;
    const result = await duplicateQuotation(id, session2.user.id);
    redirect(`/quotations/${result.id}/edit`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</h1>
          <p className="text-sm text-neutral-500">
            {quotation.customer.name} — {quotation.customer.project || quotation.customer.siteAddress}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium capitalize text-neutral-600">
            {quotation.status}
          </span>
          <Link href={`/quotations/${id}/print`} target="_blank" className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            Print
          </Link>
          <Link href={`/quotations/${id}/edit`} className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            Edit
          </Link>
          <form action={duplicateAction}>
            <button type="submit" className="rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#0c3125]">
              Duplicate
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Size (ft)</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Sqft</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {quotation.items.map((item: any, i: number) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-4 py-2">{item.description}</td>
                <td className="px-4 py-2">
                  {item.billed.w} x {item.billed.h}
                </td>
                <td className="px-4 py-2">{item.qty}</td>
                <td className="px-4 py-2">{item.totalAreaSqft}</td>
                <td className="px-4 py-2">₹{item.rate}</td>
                <td className="px-4 py-2 text-right font-medium">₹{item.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal</span>
          <span>₹{quotation.totals.subtotal.toLocaleString("en-IN")}</span>
        </div>
        {quotation.gst.enabled && (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>CGST</span>
              <span>₹{quotation.totals.cgst.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>SGST</span>
              <span>₹{quotation.totals.sgst.toLocaleString("en-IN")}</span>
            </div>
          </>
        )}
        {quotation.totals.transportation > 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Transportation</span>
            <span>₹{quotation.totals.transportation.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 text-base font-semibold text-[#0f3d2e]">
          <span>Grand Total</span>
          <span>₹{quotation.totals.grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>
      <p className="mt-2 text-right text-xs italic text-neutral-500">{amountInWords(quotation.totals.grandTotal)}</p>
    </div>
  );
}
