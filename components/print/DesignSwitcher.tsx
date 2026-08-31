"use client";

import React, { useState } from "react";
import { QuotationDesignA } from "./QuotationDesignA";
import { QuotationDesignB } from "./QuotationDesignB";
import { QuotationDesignC } from "./QuotationDesignC";
import type { Quotation, Settings } from "@/models/schemas";

export function DesignSwitcher({
  quotation,
  settings,
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  preparedByName?: string | null;
}) {
  const [activeDesign, setActiveDesign] = useState<"A" | "B" | "C">("B");

  return (
    <div>
      {/* Design Switcher Bar — Hidden during Print */}
      <div className="print:hidden bg-slate-900 text-white p-4 mb-6 rounded-lg shadow-xl border border-slate-700 max-w-[210mm] mx-auto flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-1">
            Design Direction Switcher
          </div>
          <div className="text-sm font-medium">Select a design to preview and compare:</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveDesign("A")}
            className={`px-4 py-2 rounded-md font-semibold text-xs transition-all ${
              activeDesign === "A"
                ? "bg-amber-400 text-slate-950 shadow-lg scale-105"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            A — The Architect
            <span className="block text-[9px] font-normal opacity-80">Minimal B&amp;W + Gold</span>
          </button>

          <button
            onClick={() => setActiveDesign("B")}
            className={`px-4 py-2 rounded-md font-semibold text-xs transition-all ${
              activeDesign === "B"
                ? "bg-amber-400 text-slate-950 shadow-lg scale-105"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            B — The Corporate ⭐
            <span className="block text-[9px] font-normal opacity-80">Navy &amp; Gold Letterhead</span>
          </button>

          <button
            onClick={() => setActiveDesign("C")}
            className={`px-4 py-2 rounded-md font-semibold text-xs transition-all ${
              activeDesign === "C"
                ? "bg-amber-400 text-slate-950 shadow-lg scale-105"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            C — The Proposal
            <span className="block text-[9px] font-normal opacity-80">Product Cards Catalogue</span>
          </button>
        </div>
      </div>

      {/* Render Selected Design Component */}
      {activeDesign === "A" && (
        <QuotationDesignA quotation={quotation} settings={settings} preparedByName={preparedByName} />
      )}
      {activeDesign === "B" && (
        <QuotationDesignB quotation={quotation} settings={settings} preparedByName={preparedByName} />
      )}
      {activeDesign === "C" && (
        <QuotationDesignC quotation={quotation} settings={settings} preparedByName={preparedByName} />
      )}
    </div>
  );
}
