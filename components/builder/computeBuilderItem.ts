import {
  computeItem,
  customAddonFlatTotal,
  effectiveRate as computeEffectiveRate,
  type QuotationItemComputed,
} from "@/lib/pricing";
import type { BuilderItem } from "./types";

/**
 * The rate after surcharges, plus the standard computed area/amount fields —
 * the single source both ItemRow and TotalsPanel read from, so they can
 * never disagree.
 *
 * Delegates to lib/pricing.ts's effectiveRate() rather than re-deriving the
 * surcharge sum here — this file used to duplicate that logic independently,
 * which is exactly the kind of divergence that produced the RDW/26-27/0302
 * rate-disclosure bug (a printed rate silently drifting from the rate
 * actually billed). One function, three callers (this, lib/quotations.ts,
 * the print document), can't drift again.
 */
export function computeBuilderItem(item: BuilderItem): QuotationItemComputed & { effectiveRate: number } {
  const rate = computeEffectiveRate(item);

  const computed = computeItem({
    billedWidthFt: item.billed.w,
    billedHeightFt: item.billed.h,
    qty: item.qty,
    pricingMode: item.pricingMode,
    rate,
    // Must mirror lib/quotations.ts's computeQuotationPricing exactly, or the
    // builder's live preview would quote a different number than the one saved.
    flatAddonTotal: customAddonFlatTotal(item.customAddons),
  });

  return { ...computed, effectiveRate: rate };
}
