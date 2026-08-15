import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { listInvoicesFor } from "@/lib/invoices";
import { Pagination } from "@/components/ui/Pagination";

export default async function InvoicesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;

  const actor = actorFromSession(await auth());
  if (!actor) redirect("/login");

  const page = Math.max(1, Number(pageParam) || 1);
  const { items: invoices, hasMore } = await listInvoicesFor(actor, { search: q, page });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Tax Invoices</h1>
      </div>

      <form className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search invoice no., quote no., or buyer..."
          className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Invoice No</th>
              <th className="px-4 py-2">Buyer</th>
              <th className="px-4 py-2">From quote</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Supply</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link href={`/invoices/${inv._id}`} className="font-medium text-[#0f3d2e] hover:underline">
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td className="px-4 py-2">{inv.buyer.name}</td>
                <td className="px-4 py-2 text-neutral-500">{inv.quoteNo}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {inv.supplyType === "intra_state" ? "CGST + SGST" : "IGST"}
                </td>
                <td className="px-4 py-2 text-right font-medium">₹{inv.totals.grandTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  No invoices yet — raise one from an approved quotation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} basePath="/invoices" searchParams={{ q }} />
    </div>
  );
}
