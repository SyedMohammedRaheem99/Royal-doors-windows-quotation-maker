import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { updateQuotation } from "@/lib/quotations";
import { QuotationBuilder, type QuotationSavePayload, type SaveResult } from "@/components/builder/QuotationBuilder";
import { quotationToBuilderState } from "@/components/builder/fromQuotation";
import { QuotationInputSchema, type Quotation, type RateCardEntry, type Settings } from "@/models/schemas";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const session = await auth();
  const db = await getDb();

  const [quotationDoc, rateCardDocs, settingsDoc] = await Promise.all([
    db.collection("quotations").findOne({ _id: new ObjectId(id) }),
    db.collection("rateCard").find({ active: true }).sort({ category: 1, label: 1 }).toArray(),
    db.collection("settings").findOne({}),
  ]);

  if (!quotationDoc || !settingsDoc) notFound();
  if (session?.user.role !== "admin" && quotationDoc.createdBy !== session?.user.id) notFound();

  const quotation = JSON.parse(JSON.stringify(quotationDoc)) as Quotation;
  const rateCard = JSON.parse(JSON.stringify(rateCardDocs)) as RateCardEntry[];
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  const initial = quotationToBuilderState(quotation, settings.terms);

  async function saveAction(payload: QuotationSavePayload): Promise<SaveResult> {
    "use server";
    const session2 = await auth();
    if (!session2?.user) return { error: "Not authenticated." };

    const parsed = QuotationInputSchema.safeParse(payload);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    return updateQuotation(id, parsed.data, session2.user.id);
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
