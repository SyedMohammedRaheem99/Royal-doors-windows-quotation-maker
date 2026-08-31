import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createQuotation } from "@/lib/quotations";
import { QuotationBuilder, type QuotationSavePayload, type SaveResult } from "@/components/builder/QuotationBuilder";
import { QuotationInputSchema, type RateCardEntry, type Settings } from "@/models/schemas";

export default async function NewQuotationPage() {
  const actor = await resolveActor(await auth());
  if (!actor) redirect("/login");

  const db = await getDb();
  const rateCardDocs = await db.collection("rateCard").find({ active: true }).sort({ category: 1, label: 1 }).toArray();
  const settingsDoc = await db.collection("settings").findOne({});

  if (!settingsDoc) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Settings have not been seeded yet. Run <code>npm run seed</code> first.
      </p>
    );
  }

  // Strip Mongo's ObjectId (and any other non-plain fields) before crossing
  // the Server -> Client Component boundary, which only accepts plain data.
  const rateCard = JSON.parse(JSON.stringify(rateCardDocs)) as RateCardEntry[];
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  async function saveAction(payload: QuotationSavePayload): Promise<SaveResult> {
    "use server";
    const session = await auth();
    if (!session?.user) return { error: "Not authenticated." };

    const parsed = QuotationInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    return createQuotation(parsed.data, session.user.id);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">New Quotation</h1>
      <QuotationBuilder rateCard={rateCard} gstPresets={settings.gstPresets} terms={settings.terms} onSave={saveAction} />
    </div>
  );
}
