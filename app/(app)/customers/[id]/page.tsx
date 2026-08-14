import { ObjectId } from "mongodb";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { withRevisionSuffix } from "@/lib/numbering";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const db = await getDb();
  const customer = await db.collection("customers").findOne({ _id: new ObjectId(id) });
  if (!customer) notFound();

  const quotations = await db
    .collection("quotations")
    .find({ customerId: id })
    .sort({ createdAt: -1 })
    .toArray();

  const lifetimeValue = quotations
    .filter((q) => q.status === "approved")
    .reduce((sum, q) => sum + q.totals.grandTotal, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{customer.name}</h1>
          <p className="text-sm text-neutral-500">
            {[customer.phone, customer.siteAddress].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        <Link href="/quotations/new" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]">
          + New quotation
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-400">Quotations</p>
          <p className="text-lg font-semibold text-neutral-900">{quotations.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-400">Referred by</p>
          <p className="text-lg font-semibold text-neutral-900">{customer.referredBy || "—"}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-400">Approved value</p>
          <p className="text-lg font-semibold text-[#0f3d2e]">₹{lifetimeValue.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Quotation history</h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Quote No</th>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((quotation) => (
              <tr key={quotation._id.toString()} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link href={`/quotations/${quotation._id}`} className="font-medium text-[#0f3d2e] hover:underline">
                    {withRevisionSuffix(quotation.quoteNo, quotation.revision)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-500">{quotation.customer.project || "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(quotation.date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-2 capitalize text-neutral-600">{quotation.status}</td>
                <td className="px-4 py-2 text-right font-medium">₹{quotation.totals.grandTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {quotations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  No quotations yet for this customer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
