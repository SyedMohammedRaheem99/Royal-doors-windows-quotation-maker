import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { updateRates } from "@/lib/rateCard";
import { RateCardEditor } from "@/components/rates/RateCardEditor";
import type { RateCardEntry } from "@/models/schemas";

export default async function RatesPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/dashboard");

  const db = await getDb();
  const entriesDoc = await db.collection("rateCard").find({ active: true }).sort({ category: 1, label: 1 }).toArray();
  const entries = JSON.parse(JSON.stringify(entriesDoc)) as RateCardEntry[];

  async function saveAction(updates: Array<{ productType: string; defaultRate: number }>) {
    "use server";
    const session2 = await auth();
    if (session2?.user.role !== "admin") return { error: "Not authorized." };
    await updateRates(updates);
    return { ok: true as const };
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Rate Master</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Default rates used when a product is added to a new quotation. Existing quotations keep the rate they were created with.
      </p>
      <RateCardEditor entries={entries} onSave={saveAction} />
    </div>
  );
}
