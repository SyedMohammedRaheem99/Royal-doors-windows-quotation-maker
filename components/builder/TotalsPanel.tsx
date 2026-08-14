"use client";

import { amountInWords } from "@/lib/words";
import { computeTotals, type GstRatePercent } from "@/lib/pricing";
import { computeBuilderItem } from "./computeBuilderItem";
import type { BuilderGst, BuilderItem } from "./types";

export function TotalsPanel({
  items,
  transportation,
  onTransportationChange,
  gst,
  onGstChange,
  gstPresets,
}: {
  items: BuilderItem[];
  transportation: number;
  onTransportationChange: (v: number) => void;
  gst: BuilderGst;
  onGstChange: (g: BuilderGst) => void;
  gstPresets: GstRatePercent[];
}) {
  const computedItems = items.map(computeBuilderItem);
  const totals = computeTotals(computedItems, gst.enabled ? gst.rate : 0, transportation);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Totals</h2>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Transportation (₹)</label>
          <input
            type="number"
            min={0}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
            value={transportation}
            onChange={(e) => onTransportationChange(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-500">
            <input type="checkbox" checked={gst.enabled} onChange={(e) => onGstChange({ ...gst, enabled: e.target.checked })} />
            Apply GST
          </label>
          <select
            disabled={!gst.enabled}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100 focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
            value={gst.rate}
            onChange={(e) => onGstChange({ ...gst, rate: Number(e.target.value) as GstRatePercent })}
          >
            {gstPresets.map((r) => (
              <option key={r} value={r}>
                {r}% (CGST {r / 2}% + SGST {r / 2}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={totals.subtotal} />
        {gst.enabled && (
          <>
            <Row label={`CGST (${gst.rate / 2}%)`} value={totals.cgst} />
            <Row label={`SGST (${gst.rate / 2}%)`} value={totals.sgst} />
          </>
        )}
        {transportation > 0 && <Row label="Transportation" value={totals.transportation} />}
        <div className="my-2 border-t border-neutral-200" />
        <Row label="Grand Total" value={totals.grandTotal} emphasize />
      </dl>

      <p className="mt-3 text-xs italic text-neutral-500">{amountInWords(totals.grandTotal)}</p>
    </div>
  );
}

function Row({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className={`flex justify-between ${emphasize ? "text-base font-semibold text-[#0f3d2e]" : "text-neutral-600"}`}>
      <dt>{label}</dt>
      <dd>₹{value.toLocaleString("en-IN")}</dd>
    </div>
  );
}
