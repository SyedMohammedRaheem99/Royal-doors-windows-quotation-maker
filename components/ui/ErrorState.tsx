"use client";

/**
 * Shared presentation for a failed page render. `error.tsx` boundaries are
 * client components by contract, so this is too.
 *
 * Deliberately does NOT render `error.message`: a thrown DB error can carry a
 * connection string or query fragment, and this component is used on pages
 * customers' data is behind. The digest is enough to find the real error in
 * server logs.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  digest,
  onRetry,
}: {
  title?: string;
  description?: string;
  digest?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {description ?? "This page couldn't be loaded. Your data has not been changed."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]"
        >
          Try again
        </button>
      )}
      {digest && <p className="mt-4 font-mono text-[10px] text-neutral-300">ref: {digest}</p>}
    </div>
  );
}
