import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { listCustomersFor } from "@/lib/customers";
import { Pagination } from "@/components/ui/Pagination";

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;

  const actor = await resolveActor(await auth());
  if (!actor) redirect("/login");

  const page = Math.max(1, Number(pageParam) || 1);
  const { items: customers, hasMore } = await listCustomersFor(actor, { search: q, page });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Customers</h1>

      <form className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search customer name..."
          className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
        />
      </form>

      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Project / Site</th>
              <th className="px-4 py-2">Referred by</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer._id.toString()} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link href={`/customers/${customer._id}`} className="font-medium text-[#0f3d2e] hover:underline">
                    {customer.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-500">{customer.phone || "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{customer.project || customer.siteAddress || "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{customer.referredBy || "—"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  No customers yet — they appear here automatically the first time you save a quotation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {customers.map((customer) => (
          <Link
            key={customer._id.toString()}
            href={`/customers/${customer._id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
          >
            <p className="font-medium text-[#0f3d2e]">{customer.name}</p>
            <p className="text-sm text-neutral-700">{customer.phone || "—"}</p>
            <p className="text-xs text-neutral-500">{customer.project || customer.siteAddress || "—"}</p>
            {customer.referredBy && <p className="mt-1 text-xs text-neutral-400">Ref: {customer.referredBy}</p>}
          </Link>
        ))}
        {customers.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            No customers yet — they appear here automatically the first time you save a quotation.
          </p>
        )}
      </div>

      <Pagination page={page} hasMore={hasMore} basePath="/customers" searchParams={{ q }} />
    </div>
  );
}
