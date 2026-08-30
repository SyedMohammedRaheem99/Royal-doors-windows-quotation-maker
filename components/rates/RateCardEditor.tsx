"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { DIAGRAM_TYPES, PRODUCT_CATEGORIES, type RateCardEntry, type RateCardInput, type RateChange } from "@/models/schemas";

const CATEGORY_LABELS: Record<string, string> = {
  sliding: "Sliding Windows",
  casement_fixed: "Casement & Fixed",
  ventilator: "Ventilators",
  door: "Doors",
  mesh: "Mesh",
  aluminium: "Aluminium",
};

type ActionResult = { ok: true } | { ok: true; count: number } | { error: string };

function inputClass(extra = "") {
  return `rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e] ${extra}`;
}
function labelClass() {
  return "mb-1 block text-xs font-medium text-neutral-500";
}

const emptyProduct: RateCardInput = {
  productType: "",
  label: "",
  category: "sliding",
  pricingMode: "per_sqft",
  defaultRate: 0,
  minRate: 0,
  maxRate: 0,
  diagramType: "fixed",
  active: true,
};

export function RateCardEditor({
  entries,
  history,
  onSave,
  onBulkAdjust,
  onCreate,
  onUpdate,
  onSetActive,
}: {
  entries: RateCardEntry[];
  history: RateChange[];
  actorName?: string;
  onSave: (updates: Array<{ productType: string; defaultRate: number }>) => Promise<ActionResult>;
  onBulkAdjust: (input: { category?: string; percent: number; reason: string }) => Promise<ActionResult>;
  onCreate: (input: RateCardInput) => Promise<ActionResult>;
  onUpdate: (productType: string, input: RateCardInput) => Promise<ActionResult>;
  onSetActive: (productType: string, active: boolean) => Promise<ActionResult>;
}) {
  const [rates, setRates] = useState<Record<string, number>>(
    Object.fromEntries(entries.map((e) => [e.productType, e.defaultRate]))
  );
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"rates" | "products" | "history">("rates");
  const [editing, setEditing] = useState<RateCardInput | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [bulkPercent, setBulkPercent] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const toast = useToast();

  const active = entries.filter((e) => e.active);
  const byCategory = active.reduce<Record<string, RateCardEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  const dirty = active.some((e) => rates[e.productType] !== e.defaultRate);

  async function handleSave() {
    setSaving(true);
    const updates = active
      .filter((e) => rates[e.productType] !== e.defaultRate)
      .map((e) => ({ productType: e.productType, defaultRate: rates[e.productType] }));
    try {
      const result = await onSave(updates);
      if ("error" in result) toast.error(result.error);
      else toast.success(`Saved ${updates.length} rate${updates.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Couldn't save rates. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleBulk() {
    const percent = Number(bulkPercent);
    if (!Number.isFinite(percent) || percent === 0) {
      toast.error("Enter a non-zero percentage.");
      return;
    }
    const scope = bulkCategory ? CATEGORY_LABELS[bulkCategory] : "ALL products";
    if (!window.confirm(`Adjust ${scope} by ${percent > 0 ? "+" : ""}${percent}%? This is logged and can be reviewed in History.`)) return;

    startTransition(async () => {
      try {
        const result = await onBulkAdjust({ category: bulkCategory, percent, reason: bulkReason });
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success(`Adjusted ${"count" in result ? result.count : 0} rate(s).`);
          setBulkPercent("");
          setBulkReason("");
        }
      } catch {
        toast.error("Couldn't apply the adjustment. Check your connection and try again.");
      }
    });
  }

  function handleProductSave() {
    if (!editing) return;
    startTransition(async () => {
      try {
        const result = editingCode ? await onUpdate(editingCode, editing) : await onCreate(editing);
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success(editingCode ? "Product updated." : "Product added.");
          setEditing(null);
          setEditingCode(null);
        }
      } catch {
        toast.error("Couldn't save the product. Check your connection and try again.");
      }
    });
  }

  function handleToggleActive(entry: RateCardEntry) {
    const retiring = entry.active;
    const message = retiring
      ? `Retire "${entry.label}"? It will stop appearing in the builder. Existing quotations are unaffected.`
      : `Restore "${entry.label}" to the builder?`;
    if (!window.confirm(message)) return;

    startTransition(async () => {
      try {
        const result = await onSetActive(entry.productType, !entry.active);
        if ("error" in result) toast.error(result.error);
        else toast.success(retiring ? "Product retired." : "Product restored.");
      } catch {
        toast.error("Couldn't update the product. Check your connection and try again.");
      }
    });
  }

  const TABS = [
    { id: "rates" as const, label: "Rates" },
    { id: "products" as const, label: `Products (${entries.length})` },
    { id: "history" as const, label: `History (${history.length})` },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium md:px-4 ${
              tab === t.id ? "border-[#0f3d2e] text-[#0f3d2e]" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rates" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-neutral-700">Bulk adjustment</h2>
            <p className="mb-3 text-xs text-neutral-500">
              Raise or lower many rates at once — the annual revision case. Every change is logged individually.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-auto">
                <label className={labelClass()}>Category</label>
                <select
                  className={inputClass("w-full sm:w-48")}
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                >
                  <option value="">All products</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label className={labelClass()}>Change (%)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputClass("w-full sm:w-28")}
                  value={bulkPercent}
                  placeholder="e.g. 5"
                  onChange={(e) => setBulkPercent(e.target.value)}
                />
              </div>
              <div className="w-full sm:flex-1">
                <label className={labelClass()}>Reason (optional)</label>
                <input
                  className={inputClass("w-full")}
                  value={bulkReason}
                  placeholder="e.g. Profile cost increase April 2026"
                  onChange={(e) => setBulkReason(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={handleBulk}
                className="w-full shrink-0 rounded border border-[#0f3d2e] px-4 py-2 text-sm font-medium text-[#0f3d2e] disabled:opacity-50 hover:bg-neutral-50 sm:w-auto"
              >
                Apply
              </button>
            </div>
          </div>

          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <h2 className="border-b border-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              {/* Table at md:+, stacked cards below — four columns (one of
                  them a number input) cannot fit a 380px phone without
                  clipping the rate field, which is the one control that
                  actually has to be reachable here. */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Pricing mode</th>
                    <th className="px-4 py-2">Range seen in reference data</th>
                    <th className="w-40 px-4 py-2">Default rate (₹)</th>
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
                          value={rates[e.productType] ?? e.defaultRate}
                          onChange={(ev) => setRates((prev) => ({ ...prev, [e.productType]: Number(ev.target.value) }))}
                          className={inputClass("w-28")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divide-y divide-neutral-100 md:hidden">
                {items.map((e) => (
                  <div key={e.productType} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-800">{e.label}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {e.pricingMode === "per_sqft" ? "Per sqft" : "Per piece"} · ₹{e.minRate} – ₹{e.maxRate}
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`Default rate for ${e.label}`}
                      value={rates[e.productType] ?? e.defaultRate}
                      onChange={(ev) => setRates((prev) => ({ ...prev, [e.productType]: Number(ev.target.value) }))}
                      className={inputClass("w-24 shrink-0")}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125]"
          >
            {saving ? "Saving..." : "Save all changes"}
          </button>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-4">
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditing({ ...emptyProduct });
                setEditingCode(null);
              }}
              className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#0c3125]"
            >
              + Add product
            </button>
          )}

          {editing && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700">
                {editingCode ? `Edit "${editing.label}"` : "New product"}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <label className={labelClass()}>Product code *</label>
                  <input
                    className={inputClass("w-full font-mono")}
                    value={editing.productType}
                    disabled={Boolean(editingCode)}
                    placeholder="sliding_4_track"
                    onChange={(e) => setEditing({ ...editing, productType: e.target.value })}
                  />
                  {editingCode && <p className="mt-1 text-xs text-neutral-400">Code can&apos;t change — quotations reference it.</p>}
                </div>
                <div className="sm:col-span-1 md:col-span-2">
                  <label className={labelClass()}>Name shown on the quotation *</label>
                  <input
                    className={inputClass("w-full")}
                    value={editing.label}
                    placeholder="4 Track sliding window"
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass()}>Category</label>
                  <select
                    className={inputClass("w-full")}
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as RateCardInput["category"] })}
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass()}>Pricing mode</label>
                  <select
                    className={inputClass("w-full")}
                    value={editing.pricingMode}
                    onChange={(e) => setEditing({ ...editing, pricingMode: e.target.value as RateCardInput["pricingMode"] })}
                  >
                    <option value="per_sqft">Per sqft</option>
                    <option value="per_unit">Per piece</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass()}>Diagram</label>
                  <select
                    className={inputClass("w-full")}
                    value={editing.diagramType}
                    onChange={(e) => setEditing({ ...editing, diagramType: e.target.value as RateCardInput["diagramType"] })}
                  >
                    {DIAGRAM_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass()}>Default rate (₹) *</label>
                  <input
                    type="number"
                    className={inputClass("w-full")}
                    value={editing.defaultRate}
                    onChange={(e) => setEditing({ ...editing, defaultRate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass()}>Typical minimum (₹)</label>
                  <input
                    type="number"
                    className={inputClass("w-full")}
                    value={editing.minRate}
                    onChange={(e) => setEditing({ ...editing, minRate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass()}>Typical maximum (₹)</label>
                  <input
                    type="number"
                    className={inputClass("w-full")}
                    value={editing.maxRate}
                    onChange={(e) => setEditing({ ...editing, maxRate: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleProductSave}
                  className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:opacity-50 hover:bg-[#0c3125]"
                >
                  {pending ? "Saving..." : editingCode ? "Save changes" : "Add product"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditingCode(null);
                  }}
                  className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.productType} className={`border-t border-neutral-100 ${e.active ? "" : "bg-neutral-50/60"}`}>
                    <td className={`px-4 py-2 ${e.active ? "" : "text-neutral-400"}`}>{e.label}</td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-400">{e.productType}</td>
                    <td className="px-4 py-2 text-neutral-500">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                    <td className="px-4 py-2 text-right">₹{e.defaultRate}</td>
                    <td className="px-4 py-2">
                      {e.active ? (
                        <span className="text-xs text-green-700">Active</span>
                      ) : (
                        <span className="text-xs text-neutral-400">Retired</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing({
                            productType: e.productType,
                            label: e.label,
                            category: e.category,
                            pricingMode: e.pricingMode,
                            defaultRate: e.defaultRate,
                            minRate: e.minRate,
                            maxRate: e.maxRate,
                            diagramType: e.diagramType,
                            active: e.active,
                          });
                          setEditingCode(e.productType);
                        }}
                        className="mr-3 text-xs text-[#0f3d2e] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleToggleActive(e)}
                        className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
                      >
                        {e.active ? "Retire" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divide-y divide-neutral-100 md:hidden">
              {entries.map((e) => (
                <div key={e.productType} className={`px-4 py-3 ${e.active ? "" : "bg-neutral-50/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm ${e.active ? "text-neutral-800" : "text-neutral-400"}`}>{e.label}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-400">{e.productType}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {CATEGORY_LABELS[e.category] ?? e.category} · ₹{e.defaultRate}
                      </p>
                    </div>
                    {e.active ? (
                      <span className="shrink-0 text-xs text-green-700">Active</span>
                    ) : (
                      <span className="shrink-0 text-xs text-neutral-400">Retired</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({
                          productType: e.productType,
                          label: e.label,
                          category: e.category,
                          pricingMode: e.pricingMode,
                          defaultRate: e.defaultRate,
                          minRate: e.minRate,
                          maxRate: e.maxRate,
                          diagramType: e.diagramType,
                          active: e.active,
                        });
                        setEditingCode(e.productType);
                      }}
                      className="text-xs text-[#0f3d2e] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggleActive(e)}
                      className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
                    >
                      {e.active ? "Retire" : "Restore"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right">From</th>
                <th className="px-4 py-2 text-right">To</th>
                <th className="px-4 py-2">By</th>
                <th className="px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(h.changedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2">{h.label}</td>
                  <td className="px-4 py-2 text-right text-neutral-500">₹{h.from}</td>
                  <td className={`px-4 py-2 text-right font-medium ${h.to > h.from ? "text-green-700" : "text-red-700"}`}>
                    ₹{h.to}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{h.changedByName || "—"}</td>
                  <td className="px-4 py-2 text-xs text-neutral-400">{h.bulkReason || "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    No rate changes recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="divide-y divide-neutral-100 md:hidden">
            {history.map((h) => (
              <div key={h._id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm text-neutral-800">{h.label}</p>
                  <p className="shrink-0 text-sm">
                    <span className="text-neutral-400">₹{h.from}</span>
                    <span className="text-neutral-300"> → </span>
                    <span className={`font-medium ${h.to > h.from ? "text-green-700" : "text-red-700"}`}>₹{h.to}</span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(h.changedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {h.changedByName ? ` · ${h.changedByName}` : ""}
                </p>
                {h.bulkReason && <p className="mt-0.5 text-xs text-neutral-400">{h.bulkReason}</p>}
              </div>
            ))}
            {history.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">No rate changes recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
