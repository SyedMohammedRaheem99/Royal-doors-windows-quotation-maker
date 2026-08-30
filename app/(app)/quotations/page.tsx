import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { listQuotationsFor } from "@/lib/quotations";
import { withRevisionSuffix } from "@/lib/numbering";
import { StatusBadge } from "@/components/quotations/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { QuotationStatus } from "@/models/schemas";

export default async function QuotationsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageParam } = await searchParams;

  const actor = await resolveActor(await auth());
  if (!actor) redirect("/login");

  const parsedStatus = QuotationStatus.safeParse(status);
  const page = Math.max(1, Number(pageParam) || 1);
  const { items: quotations, hasMore } = await listQuotationsFor(actor, {
    search: q,
    status: parsedStatus.success ? parsedStatus.data : undefined,
    page,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Quotations</h1>
        <Link href="/quotations/new" className="shrink-0 rounded bg-[#0f3d2e] px-3 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125] sm:px-4">
          + New quotation
        </Link>
      </div>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search customer, project, or quote no..."
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="lost">Lost</option>
        </select>
        <button type="submit" className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
          Filter
        </button>
      </form>

      {/* Table at md:+, stacked cards on mobile — the columns here don't
          collapse cleanly, so this renders two paths off the same data
          rather than one CSS-only responsive-table trick. */}
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Quote No</th>
              <th className="px-4 py-2">Customer</th>
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
                <td className="px-4 py-2">{quotation.customer.name}</td>
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
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  No quotations found.
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[#0f3d2e]">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</p>
                <p className="text-sm text-neutral-700">{quotation.customer.name}</p>
                <p className="text-xs text-neutral-500">{quotation.customer.project || "—"}</p>
              </div>
              <StatusBadge status={quotation.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{new Date(quotation.date).toLocaleDateString("en-IN")}</span>
              <span className="text-sm font-medium text-neutral-900">
                ₹{quotation.totals.grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </Link>
        ))}
        {quotations.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            No quotations found.
          </p>
        )}
      </div>

      <Pagination page={page} hasMore={hasMore} basePath="/quotations" searchParams={{ q, status }} />
    </div>
  );
}
