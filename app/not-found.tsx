import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <p className="text-5xl font-semibold text-neutral-200">404</p>
        <h2 className="mt-3 text-base font-semibold text-neutral-900">Page not found</h2>
        <Link href="/login" className="mt-5 inline-block rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]">
          Go to login
        </Link>
      </div>
    </div>
  );
}
