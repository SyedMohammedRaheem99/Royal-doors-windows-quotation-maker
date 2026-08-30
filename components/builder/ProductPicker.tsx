"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RateCardEntry } from "@/models/schemas";

/**
 * Searchable product picker, replacing a plain <select>. The rate card grew
 * to 50+ products across this and the aluminium-range addition, past the
 * point a scrollable dropdown is usable on a phone at a site — this is the
 * "search option for mobile and laptop" the client asked for explicitly.
 *
 * Deliberately a plain filtered list, not a full combobox library — nothing
 * else in this codebase pulls in a UI dependency, and a phone worker typing
 * "sliding" to narrow ~50 options to 6 doesn't need more than that.
 */
export function ProductPicker({
  rateCard,
  value,
  onChange,
  className = "",
}: {
  rateCard: RateCardEntry[];
  value: string; // productType, "" if none chosen
  onChange: (productType: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = rateCard.find((p) => p.productType === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rateCard;
    return rateCard.filter((p) => p.label.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [rateCard, query]);

  // Close on outside click — the same pattern the nav drawer uses.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function select(productType: string) {
    onChange(productType);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className={className}
        placeholder="Search product..."
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results.length === 1) select(results[0].productType);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border border-neutral-300 bg-white shadow-lg">
          {value && (
            <button
              type="button"
              onClick={() => select("")}
              className="block w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-50"
            >
              Clear selection
            </button>
          )}
          {results.length === 0 && <p className="px-2 py-3 text-center text-xs text-neutral-400">No products match &quot;{query}&quot;.</p>}
          {results.map((p) => (
            <button
              key={p.productType}
              type="button"
              onClick={() => select(p.productType)}
              className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-neutral-50 ${
                p.productType === value ? "bg-[#0f3d2e]/5 font-medium text-[#0f3d2e]" : "text-neutral-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
