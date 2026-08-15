import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { listCustomersFor } from "@/lib/customers";

export default async function CustomersListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const actor = actorFromSession(await auth());
  if (!actor) redirect("/login");

  const customers = await listCustomersFor(actor, { search: q });

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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
    </div>
  );
}
