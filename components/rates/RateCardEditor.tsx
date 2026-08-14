"use client";

import { useState } from "react";
import type { RateCardEntry } from "@/models/schemas";

const CATEGORY_LABELS: Record<string, string> = {
  sliding: "Sliding Windows",
  casement_fixed: "Casement & Fixed",
  ventilator: "Ventilators",
  door: "Doors",
  mesh: "Mesh",
  aluminium: "Aluminium",
};

export function RateCardEditor({
  entries,
  onSave,
}: {
  entries: RateCardEntry[];
  onSave: (updates: Array<{ productType: string; defaultRate: number }>) => Promise<{ ok: true } | { error: string }>;
}) {
  const [rates, setRates] = useState<Record<string, number>>(Object.fromEntries(entries.map((e) => [e.productType, e.defaultRate])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const byCategory = entries.reduce<Record<string, RateCardEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  const dirty = entries.some((e) => rates[e.productType] !== e.defaultRate);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const updates = entries
      .filter((e) => rates[e.productType] !== e.defaultRate)
      .map((e) => ({ productType: e.productType, defaultRate: rates[e.productType] }));
    const result = await onSave(updates);
    setSaving(false);
    setMessage("error" in result ? result.error : `Saved ${updates.length} rate(s).`);
  }

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Pricing mode</th>
                <th className="px-4 py-2">Range seen in reference data</th>
                <th className="px-4 py-2 w-40">Default rate (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.productType} className="border-t border-neutral-100">
                  <td className="px-4 py-2">{e.label}</td>
                  <td className="px-4 py-2 text-neutral-500">{e.pricingMode === "per_sqft" ? "Per sqft" : "Per piece"}</td>
                  <td className="px-4 py-2 text-neutral-400">
                    ₹{e.minRate} – ₹{e.maxRate}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={rates[e.productType]}
                      onChange={(ev) => setRates((prev) => ({ ...prev, [e.productType]: Number(ev.target.value) }))}
                      className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={handleSave}
          className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125]"
        >
          {saving ? "Saving..." : "Save all changes"}
        </button>
        {message && <span className="text-sm text-neutral-600">{message}</span>}
      </div>
    </div>
  );
}
