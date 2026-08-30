import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { loadCustomerWithHistory } from "@/lib/customers";
import { withRevisionSuffix } from "@/lib/numbering";
import { StatusBadge } from "@/components/quotations/StatusBadge";

// No loading.tsx alongside this page, deliberately — see the comment on
// QuotationDetailPage in app/(app)/quotations/[id]/page.tsx for why a
// Suspense boundary here would undermine the ownership check's 404 status.
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = await resolveActor(await auth());
  if (!actor) redirect("/login");

  const loaded = await loadCustomerWithHistory(id, actor);
  if (!loaded) notFound();
  const { customer, quotations } = loaded;

  const approvedValue = quotations
    .filter((q) => q.status === "approved")
    .reduce((sum, q) => sum + q.totals.grandTotal, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">{customer.name}</h1>
          <p className="text-sm text-neutral-500">
            {[customer.phone, customer.siteAddress].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="shrink-0 self-start rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125] sm:self-auto"
        >
          + New quotation
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
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
          <p className="text-lg font-semibold text-[#0f3d2e]">₹{approvedValue.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Quotation history</h2>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
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
                <td className="px-4 py-2">
                  <StatusBadge status={quotation.status} />
                </td>
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

      <div className="space-y-2 md:hidden">
        {quotations.map((quotation) => (
          <Link
            key={quotation._id.toString()}
            href={`/quotations/${quotation._id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[#0f3d2e]">
                {withRevisionSuffix(quotation.quoteNo, quotation.revision)}
              </span>
              <span className="shrink-0 text-sm font-medium text-neutral-900">
                ₹{quotation.totals.grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-neutral-500">
                {quotation.customer.project || "—"} · {new Date(quotation.date).toLocaleDateString("en-IN")}
              </span>
              <StatusBadge status={quotation.status} />
            </div>
          </Link>
        ))}
        {quotations.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            No quotations yet for this customer.
          </p>
        )}
      </div>
    </div>
  );
}
