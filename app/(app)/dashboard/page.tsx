import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { getDashboardStats } from "@/lib/dashboard";
import { withRevisionSuffix } from "@/lib/numbering";
import { StatusBadge } from "@/components/quotations/StatusBadge";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 md:p-4">
      {/* Label text is asserted verbatim by scripts/test-dashboard.mjs — do not
          reword it. Mobile cramping is solved with layout and type size only. */}
      <p className="text-[11px] leading-tight text-neutral-400 md:text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900 md:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-neutral-400 md:text-xs">{sub}</p>}
    </div>
  );
}

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const actor = await resolveActor(session);
  if (!actor) redirect("/login");

  const stats = await getDashboardStats(actor);
  const conversionLabel = stats.conversion.rate === null ? "—" : `${Math.round(stats.conversion.rate * 100)}%`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Welcome, {session?.user?.name}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">Here&apos;s how things stand right now.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatTile label="This month" value={String(stats.thisMonth.count)} sub={rupees(stats.thisMonth.value)} />
        <StatTile label="Pipeline (sent, awaiting decision)" value={String(stats.pipeline.count)} sub={rupees(stats.pipeline.value)} />
        <StatTile
          label="Conversion rate"
          value={conversionLabel}
          sub={stats.conversion.rate === null ? "no decided quotes yet" : `${stats.conversion.approved} won / ${stats.conversion.lost} lost`}
        />
        <StatTile
          label="Needs follow-up"
          value={String(stats.staleQuotations.length)}
          sub={stats.staleQuotations.length > 0 ? "sent 7+ days ago" : "all caught up"}
        />
      </div>

      {stats.staleQuotations.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Sent quotations with no decision yet</h2>
          <ul className="space-y-1">
            {stats.staleQuotations.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-sm">
                <Link href={`/quotations/${q.id}`} className="text-amber-900 hover:underline">
                  {q.quoteNo} — {q.customerName}
                </Link>
                <span className="text-xs text-amber-700">{q.daysSinceUpdate} days ago</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white lg:col-span-2">
          <h2 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">Recent activity</h2>
          {/* Desktop: four aligned columns. Mobile: a stacked row per quotation,
              so the customer name has the full width instead of being crushed
              into a shared table cell. */}
          <table className="hidden w-full text-sm md:table">
            <tbody>
              {stats.recentActivity.map((q) => (
                <tr key={q.id} className="border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/quotations/${q.id}`} className="font-medium text-[#0f3d2e] hover:underline">
                      {withRevisionSuffix(q.quoteNo, q.revision)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">{q.customerName}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">{rupees(q.grandTotal)}</td>
                </tr>
              ))}
              {stats.recentActivity.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                    No quotations yet.{" "}
                    <Link href="/quotations/new" className="text-[#0f3d2e] hover:underline">
                      Create your first one
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="divide-y divide-neutral-100 md:hidden">
            {stats.recentActivity.map((q) => (
              <Link key={q.id} href={`/quotations/${q.id}`} className="block px-4 py-2.5 hover:bg-neutral-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#0f3d2e]">{withRevisionSuffix(q.quoteNo, q.revision)}</span>
                  <span className="shrink-0 text-sm font-medium text-neutral-900">{rupees(q.grandTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-neutral-500">{q.customerName}</span>
                  <StatusBadge status={q.status} />
                </div>
              </Link>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">
                No quotations yet.{" "}
                <Link href="/quotations/new" className="text-[#0f3d2e] hover:underline">
                  Create your first one
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">Top products by value</h2>
          <ul>
            {stats.topProducts.map((p) => (
              <li key={p.description} className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5 text-sm first:border-t-0">
                <span className="text-neutral-700">{p.description}</span>
                <span className="text-right font-medium text-neutral-900">{rupees(p.totalValue)}</span>
              </li>
            ))}
            {stats.topProducts.length === 0 && <li className="px-4 py-8 text-center text-sm text-neutral-400">No data yet.</li>}
          </ul>
        </div>
      </div>

      {stats.repBreakdown && (
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">By team member</h2>
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Quotations</th>
                <th className="px-4 py-2 text-right">Total value</th>
              </tr>
            </thead>
            <tbody>
              {stats.repBreakdown.map((r) => (
                <tr key={r.userId} className="border-t border-neutral-100">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.count}</td>
                  <td className="px-4 py-2 text-right font-medium">{rupees(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divide-y divide-neutral-100 md:hidden">
            {stats.repBreakdown.map((r) => (
              <div key={r.userId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-800">{r.name}</p>
                  <p className="text-xs text-neutral-400">
                    {r.count} quotation{r.count === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-neutral-900">{rupees(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
