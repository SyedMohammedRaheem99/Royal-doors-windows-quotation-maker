import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageSettings, resolveActor } from "@/lib/authz";
import { rateCard as rateCardCollection } from "@/lib/collections";
import {
  bulkAdjustRates,
  createRateCardEntry,
  listRateChanges,
  setRateCardActive,
  updateRateCardEntry,
  updateRates,
} from "@/lib/rateCard";
import { RateCardEditor } from "@/components/rates/RateCardEditor";
import { RateCardInputSchema, type ProductCategory, type RateCardEntry, type RateCardInput, type RateChange } from "@/models/schemas";

export default async function RatesPage() {
  const session = await auth();
  const actor = await resolveActor(session);
  if (!actor || !canManageSettings(actor)) redirect("/dashboard");

  const actorName = session?.user?.name ?? "";

  const col = await rateCardCollection();
  // Retired products are included so an admin can see and un-retire them —
  // the builder filters to active only.
  const entriesDoc = await col.find({}).sort({ category: 1, label: 1 }).toArray();
  const entries = JSON.parse(JSON.stringify(entriesDoc)) as RateCardEntry[];
  const history = JSON.parse(JSON.stringify(await listRateChanges(actor, 50))) as RateChange[];

  async function saveRatesAction(updates: Array<{ productType: string; defaultRate: number }>) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a) return { error: "Not authenticated." };
    const name = (await auth())?.user?.name ?? "";

    const result = await updateRates(updates, a, name);
    if (!result.ok) return { error: result.error };
    revalidatePath("/rates");
    return { ok: true as const };
  }

  async function bulkAdjustAction(input: { category?: string; percent: number; reason: string }) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a) return { error: "Not authenticated." };
    const name = (await auth())?.user?.name ?? "";

    const result = await bulkAdjustRates(
      { category: (input.category || undefined) as ProductCategory | undefined, percent: input.percent, reason: input.reason },
      a,
      name
    );
    if (!result.ok) return { error: result.error };
    revalidatePath("/rates");
    return { ok: true as const, count: result.data };
  }

  async function createProductAction(input: RateCardInput) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a) return { error: "Not authenticated." };
    const name = (await auth())?.user?.name ?? "";

    const parsed = RateCardInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const result = await createRateCardEntry(parsed.data, a, name);
    if (!result.ok) return { error: result.error };
    revalidatePath("/rates");
    return { ok: true as const };
  }

  async function updateProductAction(productType: string, input: RateCardInput) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a) return { error: "Not authenticated." };
    const name = (await auth())?.user?.name ?? "";

    const parsed = RateCardInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const result = await updateRateCardEntry(productType, parsed.data, a, name);
    if (!result.ok) return { error: result.error };
    revalidatePath("/rates");
    return { ok: true as const };
  }

  async function setActiveAction(productType: string, active: boolean) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a) return { error: "Not authenticated." };

    const result = await setRateCardActive(productType, active, a);
    if (!result.ok) return { error: result.error };
    revalidatePath("/rates");
    return { ok: true as const };
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Rate Master</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Default rates used when a product is added to a new quotation. Existing quotations keep the rate they were
        created with, so changing a rate here never alters a quote already sent.
      </p>
      <RateCardEditor
        entries={entries}
        history={history}
        actorName={actorName}
        onSave={saveRatesAction}
        onBulkAdjust={bulkAdjustAction}
        onCreate={createProductAction}
        onUpdate={updateProductAction}
        onSetActive={setActiveAction}
      />
    </div>
  );
}
