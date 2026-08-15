export default function PrintNotFound() {
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <p className="text-5xl font-semibold text-neutral-200">404</p>
      <h2 className="mt-3 text-base font-semibold text-neutral-900">Not found</h2>
      <p className="mt-1 text-sm text-neutral-500">
        This quotation doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
    </div>
  );
}
