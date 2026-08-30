import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { settings as settingsCollection } from "@/lib/collections";
import { loadQuotationFor } from "@/lib/quotations";
import { createInvoiceFromQuotation } from "@/lib/invoices";
import { RaiseInvoiceForm } from "@/components/quotations/RaiseInvoiceForm";
import { InvoiceInputSchema, type Buyer, type InvoiceInput, type Settings } from "@/models/schemas";

// No loading.tsx here for the same reason as the quotation detail page:
// a Suspense boundary would stream and lock the status to 200 before
// notFound() can set 404 on the ownership check.
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  if (!from) redirect("/quotations");

  const actor = await resolveActor(await auth());
  if (!actor) notFound();

  const loaded = await loadQuotationFor(from, actor);
  if (!loaded.ok) notFound();
  const quotation = loaded.data;

  const settingsCol = await settingsCollection();
  const settingsDoc = await settingsCol.findOne({});
  if (!settingsDoc) notFound();
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  // Surface the blocking conditions here rather than letting the user fill
  // in a form only to be rejected on submit.
  const blockers: string[] = [];
  if (quotation.status !== "approved") blockers.push("This quotation is not approved yet.");
  if (quotation.invoiceId) blockers.push("This quotation has already been invoiced.");
  if (!quotation.gst.enabled) blockers.push("This quotation has GST turned off.");
  if (!settings.gstin?.trim()) blockers.push("Your company GSTIN is not set in Settings.");

  if (blockers.length > 0) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">Cannot raise an invoice</h1>
        <ul className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Link href={`/quotations/${from}`} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Back to quotation
          </Link>
          {quotation.invoiceId && (
            <Link
              href={`/invoices/${quotation.invoiceId}`}
              className="rounded bg-[#0f3d2e] px-3 py-1.5 text-sm font-medium text-[#c9a227] hover:bg-[#0c3125]"
            >
              View the invoice
            </Link>
          )}
        </div>
      </div>
    );
  }

  const initialBuyer: Buyer = {
    name: quotation.customer.name,
    addressLines: [quotation.customer.siteAddress, quotation.customer.project].filter(Boolean),
    gstin: quotation.customer.gstin ?? "",
    stateName: settings.stateName ?? "Karnataka",
    stateCode: settings.stateCode ?? "29",
  };

  async function raiseAction(input: InvoiceInput) {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const parsed = InvoiceInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const result = await createInvoiceFromQuotation(from!, parsed.data, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${from}`);
    revalidatePath("/invoices");
    return { id: result.data.id };
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Raise tax invoice</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        From {quotation.quoteNo} — {quotation.customer.name} · ₹
        {quotation.totals.grandTotal.toLocaleString("en-IN")}
      </p>
      <RaiseInvoiceForm
        initialBuyer={initialBuyer}
        defaultHsnSac={settings.defaultHsnSac ?? "3917"}
        onSubmit={raiseAction}
      />
    </div>
  );
}
