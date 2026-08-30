"use client";

import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { feetToArchLabel, suggestBilledFeet } from "@/lib/dimensions";
import { SURCHARGES, toughenedGlassSurcharge } from "@/lib/pricing";
import type { RateCardEntry } from "@/models/schemas";
import { computeBuilderItem } from "./computeBuilderItem";
import { ProductPicker } from "./ProductPicker";
import type { BuilderItem } from "./types";

const SURCHARGE_OPTIONS: Array<{ key: keyof typeof SURCHARGES; label: string }> = [
  { key: "nonWhiteOrOneWayGlass", label: `Other color or one-way glass (+₹${SURCHARGES.nonWhiteOrOneWayGlass}/sqft)` },
  { key: "ssMesh", label: `SS mesh (+₹${SURCHARGES.ssMesh}/sqft)` },
  { key: "aluminiumTrack", label: `Aluminium track (+₹${SURCHARGES.aluminiumTrack}/sqft)` },
  { key: "frenchWindowDesign", label: `French window design (+₹${SURCHARGES.frenchWindowDesign}/sqft)` },
];

// Common thicknesses from the client's rate sheet — a worker picks one
// rather than typing a number, so the surcharge always resolves to a value
// toughenedGlassSurcharge() can price, never an unparseable free-text entry.
const TOUGHENED_GLASS_THICKNESS_OPTIONS = [5, 6, 8, 10, 12];

// Products that are, by definition, the "with fan point" variant. Selecting one
// must switch the diagram to the fan-point drawing automatically — the worker
// shouldn't have to also tick a checkbox to make the picture match the product
// they already chose. The checkbox stays, so a plain ventilator can still be
// given a fan point without changing product.
const FAN_POINT_PRODUCTS = new Set(["ventilator_fan_point", "aluminium_ventilator_fan_point"]);

function inputClass(extra = "") {
  return `rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e] ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-neutral-500 mb-1";
}

export function ItemRow({
  item,
  index,
  total,
  rateCard,
  collapsed = false,
  onToggleCollapsed,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  item: BuilderItem;
  index: number;
  total: number;
  rateCard: RateCardEntry[];
  /** Collapsed shows a one-line summary — on a phone a 10-item quotation is otherwise an endless scroll. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: (next: BuilderItem) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
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
      toughenedGlassMm: undefined,
      // The fan-point variants are distinct products, so the flag has to follow
      // the product choice — otherwise picking "Ventilator with fan point"
      // leaves fanPoint false and draws the plain louvered vent, making the two
      // products indistinguishable on the quotation. Reset to false for
      // everything else so the flag can't stay stuck on from a previous pick.
      fanPoint: FAN_POINT_PRODUCTS.has(productType),
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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left hover:bg-neutral-50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-800">
            {index + 1}. {item.description || "Untitled item"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {item.billed.w} × {item.billed.h} ft · Qty {item.qty} · {computed.totalAreaSqft} sqft
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[#0f3d2e]">₹{computed.amount.toLocaleString("en-IN")}</p>
          <p className="text-xs text-neutral-400">Edit</p>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 md:grid md:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">Item {index + 1}</span>
          <div className="flex items-center gap-1">
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="rounded px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                Collapse
              </button>
            )}
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              title="Move up"
              aria-label="Move item up"
              className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              title="Move down"
              aria-label="Move item down"
              className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
            >
              Duplicate
            </button>
            <button type="button" onClick={onRemove} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
              Remove
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label className={labelClass()}>Product</label>
            <ProductPicker
              className={inputClass("w-full")}
              rateCard={rateCard}
              value={item.productType}
              onChange={handleProductChange}
            />
          </div>
          <div>
            <label className={labelClass()}>Description (on quotation)</label>
            <input
              className={inputClass("w-full")}
              value={item.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass()}>Room / area</label>
            <input
              className={inputClass("w-full")}
              value={item.room}
              placeholder="e.g. Master bedroom"
              list="room-suggestions"
              onChange={(e) => patch({ room: e.target.value })}
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
            <div className="col-span-2 md:col-span-4">
              <label className={labelClass()}>Surcharges</label>
              <div className="flex flex-wrap items-center gap-4">
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
                {/* Priced by thickness rather than a flat amount — see
                    lib/pricing.ts's toughenedGlassSurcharge() — so it isn't
                    one of SURCHARGE_OPTIONS above and needs its own control. */}
                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={item.toughenedGlassMm != null}
                    onChange={(e) =>
                      patch({ toughenedGlassMm: e.target.checked ? TOUGHENED_GLASS_THICKNESS_OPTIONS[0] : undefined })
                    }
                  />
                  Toughened glass
                </label>
                {item.toughenedGlassMm != null && (
                  <select
                    className={inputClass()}
                    value={item.toughenedGlassMm}
                    onChange={(e) => patch({ toughenedGlassMm: Number(e.target.value) })}
                  >
                    {TOUGHENED_GLASS_THICKNESS_OPTIONS.map((mm) => (
                      <option key={mm} value={mm}>
                        {mm}mm (+₹{toughenedGlassSurcharge(mm)}/sqft)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          <div className="col-span-2 md:col-span-4">
            <label className={labelClass()}>Remarks</label>
            <input className={inputClass("w-full")} value={item.remarks} onChange={(e) => patch({ remarks: e.target.value })} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 rounded bg-neutral-50 px-3 py-2 text-xs text-neutral-600 sm:flex-row sm:flex-wrap sm:gap-6 sm:gap-y-1.5">
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

      <div className="flex w-32 flex-col items-center justify-center self-center md:w-40">
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
