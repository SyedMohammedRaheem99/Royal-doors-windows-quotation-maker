"use client";

// Dev-only QA harness for RateCardEditor — no DB required.
import { RateCardEditor } from "@/components/rates/RateCardEditor";
import { ToastProvider } from "@/components/ui/Toast";
import { RATE_CARD_SEED } from "@/models/rateCardSeed";
import type { RateCardEntry } from "@/models/schemas";

const ENTRIES = RATE_CARD_SEED.map((r, i) => ({ ...r, _id: String(i) })) as RateCardEntry[];

async function fakeSave(updates: Array<{ productType: string; defaultRate: number }>) {
  console.log("dev rates save", updates);
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true as const };
}

export default function DevRatesPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50 p-8">
        <h1 className="mb-6 text-xl font-semibold text-neutral-900">Dev rate card harness</h1>
        <RateCardEditor entries={ENTRIES} onSave={fakeSave} />
      </div>
    </ToastProvider>
  );
}
