import { computeItem, SURCHARGES, type QuotationItemComputed } from "@/lib/pricing";
import type { BuilderItem } from "./types";

/** The rate after surcharges, plus the standard computed area/amount fields — the single source both ItemRow and TotalsPanel read from, so they can never disagree. */
export function computeBuilderItem(item: BuilderItem): QuotationItemComputed & { effectiveRate: number } {
  const effectiveRate =
    item.rate +
    (item.pricingMode === "per_sqft"
      ? item.surcharges.reduce((sum, key) => sum + (SURCHARGES[key as keyof typeof SURCHARGES] ?? 0), 0)
      : 0);

  const computed = computeItem({
    billedWidthFt: item.billed.w,
    billedHeightFt: item.billed.h,
    qty: item.qty,
    pricingMode: item.pricingMode,
    rate: effectiveRate,
  });

  return { ...computed, effectiveRate };
}
