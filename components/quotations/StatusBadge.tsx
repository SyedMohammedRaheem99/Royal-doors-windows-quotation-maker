import type { QuotationStatus } from "@/models/schemas";

const STYLES: Record<QuotationStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  approved: "bg-green-50 text-green-700 ring-green-200",
  lost: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status, className = "" }: { status: QuotationStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        STYLES[status] ?? STYLES.draft
      } ${className}`}
    >
      {status}
    </span>
  );
}
