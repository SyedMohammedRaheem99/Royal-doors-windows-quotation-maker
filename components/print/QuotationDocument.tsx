import type { Quotation, Settings } from "@/models/schemas";
import { QuotationDesignB } from "./QuotationDesignB";

/**
 * The production quotation document. Three alternative designs (A/B/C) were
 * built and compared via a dev-only switcher at /dev/print; the client
 * confirmed Design B ("The Corporate" — deep emerald, gold "ROYAL" wordmark,
 * white "DOORS & WINDOWS" subheading) as final. This file renders that design
 * directly rather than through the switcher, so every real customer-facing
 * quotation always gets the one finished document — the switcher stays
 * available at /dev/print for any future design work but is not part of the
 * live path.
 */
export function QuotationDocument({
  quotation,
  settings,
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  preparedByName?: string | null;
}) {
  return <QuotationDesignB quotation={quotation} settings={settings} preparedByName={preparedByName} />;
}
