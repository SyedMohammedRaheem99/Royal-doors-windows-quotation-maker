"use client";

// Dev-only QA harness — exercises the real QuotationBuilder client component
// with the same seed data the real DB gets seeded with, but no DB required.
// Not linked from the app nav, not behind auth. Lets the builder UI and live
// pricing be verified in a browser before Atlas credentials exist.
import { QuotationBuilder, type QuotationSavePayload, type SaveResult } from "@/components/builder/QuotationBuilder";
import { RATE_CARD_SEED } from "@/models/rateCardSeed";
import { SETTINGS_SEED } from "@/models/settingsSeed";
import type { RateCardEntry } from "@/models/schemas";

const RATE_CARD = RATE_CARD_SEED.map((r, i) => ({ ...r, _id: String(i) })) as RateCardEntry[];

async function fakeSave(payload: QuotationSavePayload): Promise<SaveResult> {
  console.log("dev builder save payload", payload);
  await new Promise((r) => setTimeout(r, 300));
  return { id: "dev-fake-id", quoteNo: "RDW/25-26/DEV" };
}

export default function DevBuilderPage() {
  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Dev builder harness</h1>
      <QuotationBuilder
        rateCard={RATE_CARD}
        gstPresets={SETTINGS_SEED.gstPresets}
        terms={SETTINGS_SEED.terms}
        onSave={fakeSave}
        navigateOnSuccess={false}
      />
    </div>
  );
}
