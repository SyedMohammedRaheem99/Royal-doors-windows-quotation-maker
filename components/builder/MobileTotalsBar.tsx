"use client";

import { useState } from "react";
import { computeTotals, type GstRatePercent } from "@/lib/pricing";
import { computeBuilderItem } from "./computeBuilderItem";
import { TotalsPanel } from "./TotalsPanel";
import type { BuilderGst, BuilderItem } from "./types";

/**
 * Mobile-only sticky bar showing the running grand total while a worker adds
 * items on site — tap to expand the full TotalsPanel breakdown (GST,
 * transportation, amount in words) without losing sight of the total. Hidden
 * at md:+, where the sidebar TotalsPanel is always visible instead.
 */
export function MobileTotalsBar({
  items,
  transportation,
  onTransportationChange,
  gst,
  onGstChange,
  gstPresets,
  canSave,
  saving,
  saveLabel,
  onSave,
}: {
  items: BuilderItem[];
  transportation: number;
  onTransportationChange: (v: number) => void;
  gst: BuilderGst;
  onGstChange: (g: BuilderGst) => void;
  gstPresets: GstRatePercent[];
  canSave: boolean;
  saving: boolean;
  saveLabel: string;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const computedItems = items.map(computeBuilderItem);
  const totals = computeTotals(computedItems, gst.enabled ? gst.rate : 0, transportation);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden">
      {expanded && (
        <div className="max-h-[70vh] overflow-y-auto border-b border-neutral-200 p-3">
          <TotalsPanel
            items={items}
            transportation={transportation}
            onTransportationChange={onTransportationChange}
            gst={gst}
            onGstChange={onGstChange}
            gstPresets={gstPresets}
          />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span className="text-xs text-neutral-500">{expanded ? "Hide breakdown" : "Grand Total"}</span>
          <span className="text-base font-semibold text-[#0f3d2e]">₹{totals.grandTotal.toLocaleString("en-IN")}</span>
        </button>
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={onSave}
          className="shrink-0 rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125]"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}
