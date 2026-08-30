/**
 * Minimal app-wide footer. Deliberately quiet — this sits under every screen
 * including the quotation builder, so it stays out of the way of the work and
 * exists mainly for the build credit and a support contact.
 *
 * The printed quotation has its own separate footer band
 * (components/print/QuotationDocument.tsx) — that one is customer-facing and
 * carries the company's own contact details. This one is for the people using
 * the app internally, so it carries the developer credit instead.
 */
const BUILD_YEAR = 2026;

export function AppFooter({ companyName, supportPhone }: { companyName: string; supportPhone?: string }) {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-neutral-500 sm:flex-row">
        <p>
          &copy; {BUILD_YEAR} {companyName}. All rights reserved.
        </p>
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
          {supportPhone && (
            <p>
              Support:{" "}
              <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} className="hover:text-[#0f3d2e] hover:underline">
                {supportPhone}
              </a>
            </p>
          )}
          <p>
            Designed &amp; developed by{" "}
            <a
              href="https://hftprimemarketing.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0f3d2e] hover:underline"
            >
              HFT Prime Marketing
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
