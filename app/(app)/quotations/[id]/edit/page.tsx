import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { rateCard as rateCardCollection, settings as settingsCollection } from "@/lib/collections";
import { loadQuotationFor, updateQuotation } from "@/lib/quotations";
import { QuotationBuilder, type QuotationSavePayload, type SaveResult } from "@/components/builder/QuotationBuilder";
import { quotationToBuilderState } from "@/components/builder/fromQuotation";
import { QuotationInputSchema, type Quotation, type RateCardEntry, type Settings } from "@/models/schemas";

// No loading.tsx alongside this page, deliberately — see the comment on
// QuotationDetailPage in ../page.tsx for why a Suspense boundary here would
// undermine the ownership check's 404 status.
export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = actorFromSession(await auth());
  if (!actor) notFound();

  const [loaded, rateCardCol, settingsCol] = await Promise.all([
    loadQuotationFor(id, actor),
    rateCardCollection(),
    settingsCollection(),
  ]);
  if (!loaded.ok) notFound();

  const [rateCardDocs, settingsDoc] = await Promise.all([
    rateCardCol.find({ active: true }).sort({ category: 1, label: 1 }).toArray(),
    settingsCol.findOne({}),
  ]);
  if (!settingsDoc) notFound();

  const quotation = JSON.parse(JSON.stringify(loaded.data)) as Quotation;
  const rateCard = JSON.parse(JSON.stringify(rateCardDocs)) as RateCardEntry[];
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  const initial = quotationToBuilderState(quotation, settings.terms);

  async function saveAction(payload: QuotationSavePayload): Promise<SaveResult> {
    "use server";
    const actor2 = actorFromSession(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const parsed = QuotationInputSchema.safeParse(payload);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const result = await updateQuotation(id, parsed.data, actor2);
    return result.ok ? result.data : { error: result.error };
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Edit {quotation.quoteNo}</h1>
      <QuotationBuilder
        rateCard={rateCard}
        gstPresets={settings.gstPresets}
        terms={settings.terms}
        onSave={saveAction}
        initial={initial}
        saveLabel="Save changes"
      />
    </div>
  );
}
