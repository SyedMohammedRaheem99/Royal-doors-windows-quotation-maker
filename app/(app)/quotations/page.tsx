import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { withRevisionSuffix } from "@/lib/numbering";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  sent: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

export default async function QuotationsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const session = await auth();
  const db = await getDb();

  const filter: Record<string, unknown> = session?.user.role === "admin" ? {} : { createdBy: session?.user.id };
  if (status) filter.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ quoteNo: re }, { "customer.name": re }, { "customer.project": re }];
  }

  const quotations = await db.collection("quotations").find(filter).sort({ createdAt: -1 }).limit(200).toArray();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Quotations</h1>
        <Link href="/quotations/new" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]">
          + New quotation
        </Link>
      </div>

      <form className="mb-4 flex gap-3">
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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
    </div>
  );
}
