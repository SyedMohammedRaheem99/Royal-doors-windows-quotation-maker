"use client";

// Dev-only QA harness for RateCardEditor — no DB required.
import { RateCardEditor } from "@/components/rates/RateCardEditor";
import { ToastProvider } from "@/components/ui/Toast";
import { RATE_CARD_SEED } from "@/models/rateCardSeed";
import type { RateCardEntry, RateChange } from "@/models/schemas";

const ENTRIES = RATE_CARD_SEED.map((r, i) => ({ ...r, _id: String(i) })) as RateCardEntry[];

// A couple of representative history rows so the History tab renders with
// content rather than only its empty state.
const HISTORY: RateChange[] = [
  {
    _id: "h1",
    productType: "sliding_2_track",
    label: "2 Track sliding window",
    from: 300,
    to: 315,
    changedBy: "u1",
    changedByName: "Admin User",
    changedAt: new Date(),
    bulkReason: "Bulk +5%",
  },
  {
    _id: "h2",
    productType: "openable_window",
    label: "Openable window",
    from: 470,
    to: 450,
    changedBy: "u1",
    changedByName: "Admin User",
    changedAt: new Date(Date.now() - 86400000),
    bulkReason: "",
  },
];

async function noop() {
  await new Promise((r) => setTimeout(r, 250));
  return { ok: true as const };
}

export default function DevRatesPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50 p-8">
        <h1 className="mb-6 text-xl font-semibold text-neutral-900">Dev rate card harness</h1>
        <RateCardEditor
          entries={ENTRIES}
          history={HISTORY}
          onSave={async (updates) => {
            console.log("dev rates save", updates);
            return noop();
          }}
          onBulkAdjust={async (input) => {
            console.log("dev bulk adjust", input);
            await new Promise((r) => setTimeout(r, 250));
            return { ok: true as const, count: 3 };
          }}
          onCreate={async (input) => {
            console.log("dev create product", input);
            return noop();
          }}
          onUpdate={async (code, input) => {
            console.log("dev update product", code, input);
            return noop();
          }}
          onSetActive={async (code, active) => {
            console.log("dev set active", code, active);
            return noop();
          }}
        />
      </div>
    </ToastProvider>
  );
}
