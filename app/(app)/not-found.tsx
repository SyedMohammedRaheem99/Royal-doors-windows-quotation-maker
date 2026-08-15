import Link from "next/link";

/**
 * Renders whenever notFound() is called anywhere under (app) — including the
 * "not found" this app deliberately returns for a quotation/customer the
 * current user isn't allowed to see (see lib/authz.ts). Kept generic on
 * purpose: it must not reveal whether the id existed and was forbidden, or
 * never existed at all.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <p className="text-5xl font-semibold text-neutral-200">404</p>
      <h2 className="mt-3 text-base font-semibold text-neutral-900">Not found</h2>
      <p className="mt-1 text-sm text-neutral-500">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-block rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
