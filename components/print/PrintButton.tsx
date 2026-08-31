"use client";

/**
 * On a phone this reads "Download PDF": customers reach the document through a
 * WhatsApp share link, and "Print" describes a machine they are not sitting at.
 * window.print() is still the right call — mobile Chrome and Safari both offer
 * "Save as PDF" from it. The two labels are rendered together and swapped by a
 * CSS media query rather than by measuring the viewport in JS, which would
 * disagree with the server-rendered HTML on first paint.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed right-6 top-6 z-50 rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] shadow-lg hover:bg-[#0c3125] max-[700px]:static max-[700px]:mx-auto max-[700px]:my-3 max-[700px]:block max-[700px]:w-[calc(100%-10mm)]"
    >
      <span className="max-[700px]:hidden">Print / Save as PDF</span>
      <span className="hidden max-[700px]:inline">Download PDF</span>
    </button>
  );
}
