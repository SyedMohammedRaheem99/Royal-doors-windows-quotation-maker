"use client";

import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel, suggestBilledFeet } from "@/lib/dimensions";
import { SURCHARGES } from "@/lib/pricing";
import type { RateCardEntry } from "@/models/schemas";
import { computeBuilderItem } from "./computeBuilderItem";
import type { BuilderItem } from "./types";

const SURCHARGE_OPTIONS: Array<{ key: keyof typeof SURCHARGES; label: string }> = [
  { key: "nonWhiteOrOneWayGlass", label: `Other color or one-way glass (+₹${SURCHARGES.nonWhiteOrOneWayGlass}/sqft)` },
  { key: "ssMesh", label: `SS mesh (+₹${SURCHARGES.ssMesh}/sqft)` },
  { key: "aluminiumTrack", label: `Aluminium track (+₹${SURCHARGES.aluminiumTrack}/sqft)` },
];

function inputClass(extra = "") {
  return `rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e] ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-neutral-500 mb-1";
}

export function ItemRow({
  item,
  index,
  rateCard,
  onChange,
  onRemove,
}: {
  item: BuilderItem;
  index: number;
  rateCard: RateCardEntry[];
  onChange: (next: BuilderItem) => void;
  onRemove: () => void;
}) {
  const selectedProduct = rateCard.find((p) => p.productType === item.productType);
  const computed = computeBuilderItem(item);

  function patch(fields: Partial<BuilderItem>) {
    onChange({ ...item, ...fields });
  }

  function handleProductChange(productType: string) {
    const product = rateCard.find((p) => p.productType === productType);
    if (!product) {
      patch({ productType: "" });
      return;
    }
    patch({
      productType,
      description: product.label,
      diagramType: product.diagramType,
      pricingMode: product.pricingMode,
      rate: product.defaultRate,
      surcharges: [],
    });
  }

  function applyMmSuggestion(axis: "w" | "h", mm: number) {
    const ft = suggestBilledFeet(mm);
    patch({
      measuredMm: { ...(item.measuredMm ?? { w: 0, h: 0 }), [axis]: mm },
      billed: { ...item.billed, [axis]: ft },
    });
  }

  const showFanPoint = item.diagramType === "ventilator";
  const showHanding = ["casement", "top_hung", "combination", "french_door", "flush_door", "bathroom_door"].includes(
    item.diagramType
  );

  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">Item {index + 1}</span>
          <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={labelClass()}>Product</label>
            <select
              className={inputClass("w-full")}
              value={item.productType}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">Select product...</option>
              {rateCard.map((p) => (
                <option key={p.productType} value={p.productType}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass()}>Description (on quotation)</label>
            <input
              className={inputClass("w-full")}
              value={item.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass()}>Measured width (mm)</label>
            <input
              type="number"
              className={inputClass("w-full")}
              value={item.measuredMm?.w ?? ""}
              onChange={(e) => applyMmSuggestion("w", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass()}>Measured height (mm)</label>
            <input
              type="number"
              className={inputClass("w-full")}
              value={item.measuredMm?.h ?? ""}
              onChange={(e) => applyMmSuggestion("h", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass()}>Billed width (ft)</label>
            <input
              type="number"
              step={0.5}
              min={0.5}
              className={inputClass("w-full")}
              value={item.billed.w}
              onChange={(e) => patch({ billed: { ...item.billed, w: Number(e.target.value) } })}
            />
            <p className="mt-0.5 text-[10px] text-neutral-400">{feetToArchLabel(item.billed.w)}</p>
          </div>
          <div>
            <label className={labelClass()}>Billed height (ft)</label>
            <input
              type="number"
              step={0.5}
              min={0.5}
              className={inputClass("w-full")}
              value={item.billed.h}
              onChange={(e) => patch({ billed: { ...item.billed, h: Number(e.target.value) } })}
            />
            <p className="mt-0.5 text-[10px] text-neutral-400">{feetToArchLabel(item.billed.h)}</p>
          </div>

          <div>
            <label className={labelClass()}>Qty</label>
            <input
              type="number"
              min={1}
              className={inputClass("w-full")}
              value={item.qty}
              onChange={(e) => patch({ qty: Math.max(1, Number(e.target.value)) })}
            />
          </div>
          <div>
            <label className={labelClass()}>Pricing mode</label>
            <select
              className={inputClass("w-full")}
              value={item.pricingMode}
              onChange={(e) => patch({ pricingMode: e.target.value as BuilderItem["pricingMode"] })}
            >
              <option value="per_sqft">Per sqft</option>
              <option value="per_unit">Per piece</option>
            </select>
          </div>
          <div>
            <label className={labelClass()}>Rate (₹)</label>
            <input
              type="number"
              className={inputClass("w-full")}
              value={item.rate}
              onChange={(e) => patch({ rate: Number(e.target.value) })}
            />
          </div>
          {showHanding && (
            <div>
              <label className={labelClass()}>Handing</label>
              <select
                className={inputClass("w-full")}
                value={item.handing}
                onChange={(e) => patch({ handing: e.target.value as BuilderItem["handing"] })}
              >
                <option value="none">—</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          )}

          {selectedProduct && selectedProduct.specOptions.profiles.length > 0 && (
            <div>
              <label className={labelClass()}>Profile</label>
              <select className={inputClass("w-full")} value={item.specs.profile} onChange={(e) => patch({ specs: { ...item.specs, profile: e.target.value } })}>
                <option value="">Default</option>
                {selectedProduct.specOptions.profiles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProduct && selectedProduct.specOptions.colours.length > 0 && (
            <div>
              <label className={labelClass()}>Colour</label>
              <select className={inputClass("w-full")} value={item.specs.colour} onChange={(e) => patch({ specs: { ...item.specs, colour: e.target.value } })}>
                <option value="">White</option>
                {selectedProduct.specOptions.colours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProduct && selectedProduct.specOptions.glass.length > 0 && (
            <div>
              <label className={labelClass()}>Glass</label>
              <select className={inputClass("w-full")} value={item.specs.glass} onChange={(e) => patch({ specs: { ...item.specs, glass: e.target.value } })}>
                <option value="">Clear or pinned</option>
                {selectedProduct.specOptions.glass.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProduct && selectedProduct.specOptions.mesh.length > 0 && (
            <div>
              <label className={labelClass()}>Mesh</label>
              <select className={inputClass("w-full")} value={item.specs.mesh} onChange={(e) => patch({ specs: { ...item.specs, mesh: e.target.value } })}>
                <option value="">Aluminium mesh (standard)</option>
                {selectedProduct.specOptions.mesh.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showFanPoint && (
            <label className="col-span-2 flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={item.fanPoint} onChange={(e) => patch({ fanPoint: e.target.checked })} />
              With fan point
            </label>
          )}

          {item.pricingMode === "per_sqft" && (
            <div className="col-span-4">
              <label className={labelClass()}>Surcharges</label>
              <div className="flex flex-wrap gap-4">
                {SURCHARGE_OPTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={item.surcharges.includes(s.key)}
                      onChange={(e) =>
                        patch({
                          surcharges: e.target.checked
                            ? [...item.surcharges, s.key]
                            : item.surcharges.filter((k) => k !== s.key),
                        })
                      }
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-4">
            <label className={labelClass()}>Remarks</label>
            <input className={inputClass("w-full")} value={item.remarks} onChange={(e) => patch({ remarks: e.target.value })} />
          </div>
        </div>

        <div className="mt-3 flex gap-6 rounded bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span>
            Area/unit: <strong>{computed.areaPerUnitSqft} sqft</strong>
          </span>
          <span>
            Total area: <strong>{computed.totalAreaSqft} sqft</strong>
          </span>
          <span>
            Amount: <strong className="text-[#0f3d2e]">₹{computed.amount.toLocaleString("en-IN")}</strong>
          </span>
        </div>
      </div>

      <div className="flex w-40 flex-col items-center justify-center">
        <WindowDiagram
          type={item.diagramType}
          widthFt={item.billed.w}
          heightFt={item.billed.h}
          handing={item.handing}
          fanPoint={item.fanPoint}
          className="w-full"
        />
      </div>
    </div>
  );
}
