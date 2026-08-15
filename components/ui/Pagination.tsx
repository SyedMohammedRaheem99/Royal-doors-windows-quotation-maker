/**
 * Prev/Next pager driven by a `page` search param — no total count needed,
 * see Page<T>.hasMore.
 *
 * Uses plain <a> tags, not next/link. Confirmed by direct testing (see
 * scripts/debug-pagination*.mjs, not committed — the finding is recorded
 * here): on this Next.js 16.3.1 build, clicking a next/link <Link> to a URL
 * that changes ONLY the search params (same pathname, e.g. adding `&page=2`)
 * performs a client-side transition but the resulting address bar and
 * server request both drop the new param, silently re-serving page 1. A
 * plain <a> — full navigation, no client router involved — works correctly
 * every time. `prefetch={false}` did not fix it, ruling out a prefetch-cache
 * explanation. Given a full page load is what pagination already implies
 * (new data, new scroll position), losing the SPA transition here costs
 * nothing real. Re-test with next/link if the Next.js version changes.
 */
export function Pagination({
  page,
  hasMore,
  basePath,
  searchParams,
}: {
  page: number;
  hasMore: boolean;
  basePath: string;
  /** Other search params (q, status, ...) to preserve across page links. */
  searchParams: Record<string, string | undefined>;
}) {
  if (page === 1 && !hasMore) return null;

  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-neutral-400">Page {page}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <a href={hrefFor(page - 1)} className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            ← Previous
          </a>
        ) : (
          <span className="rounded border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-300">← Previous</span>
        )}
        {hasMore ? (
          <a href={hrefFor(page + 1)} className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            Next →
          </a>
        ) : (
          <span className="rounded border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-300">Next →</span>
        )}
      </div>
    </div>
  );
}
