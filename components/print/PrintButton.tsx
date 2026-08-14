"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed right-6 top-6 z-50 rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] shadow-lg hover:bg-[#0c3125]"
    >
      Print / Save as PDF
    </button>
  );
}
