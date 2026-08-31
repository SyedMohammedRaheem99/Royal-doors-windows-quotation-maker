import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { amountInWords } from "@/lib/words";
import { withRevisionSuffix } from "@/lib/numbering";
import { addPayment, duplicateQuotation, loadQuotationFor, removePayment, setQuotationStatus } from "@/lib/quotations";
import { createShareLink, revokeShareLink } from "@/lib/sharing";
import { settings as settingsCollection } from "@/lib/collections";
import { StatusBadge } from "@/components/quotations/StatusBadge";
import { StatusActions } from "@/components/quotations/StatusActions";
import { PaymentsPanel } from "@/components/quotations/PaymentsPanel";
import { SharePanel } from "@/components/quotations/SharePanel";
import { PaymentInputSchema, type PaymentInput, type QuotationStatus } from "@/models/schemas";

// There is deliberately no loading.tsx on this segment OR its parent
// (../loading.tsx) — a loading.tsx anywhere in the ancestor chain wraps this
// route in a Suspense boundary, which forces streaming and locks the HTTP
// response to 200 before notFound() below can set 404 (Next.js can't change
// the status code once streaming starts). Confirmed by removing ONLY this
// segment's own loading.tsx: it made no difference, because ../loading.tsx
// (the /quotations list page) was still wrapping this child route. The
// response body is still correctly the not-found page either way — nothing
// leaks — but a wrong status code on an authorization check is worth
// avoiding for anything that inspects it (monitoring, API clients).
// Verified by scripts/test-authz.mjs.
export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = await resolveActor(await auth());
  if (!actor) notFound();

  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) notFound();
  const quotation = loaded.data;

  const settingsCol = await settingsCollection();
  const settingsDoc = await settingsCol.findOne({});
  const companyName = settingsDoc?.companyName ?? "Royal Doors and Windows";

  async function duplicateAction() {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return;
    const result = await duplicateQuotation(id, actor2);
    if (!result.ok) return;
    redirect(`/quotations/${result.data.id}/edit`);
  }

  async function statusAction(to: QuotationStatus) {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const result = await setQuotationStatus(id, to, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${id}`);
    revalidatePath("/quotations");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  async function addPaymentAction(input: PaymentInput) {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    // Re-validate server-side: the client form is a convenience, not a
    // trust boundary.
    const parsed = PaymentInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const result = await addPayment(id, parsed.data, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${id}`);
    return { ok: true as const };
  }

  async function removePaymentAction(paymentId: string) {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const result = await removePayment(id, paymentId, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${id}`);
    return { ok: true as const };
  }

  async function createShareAction() {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const result = await createShareLink(id, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${id}`);
    return { token: result.data.token };
  }

  async function revokeShareAction() {
    "use server";
    const actor2 = await resolveActor(await auth());
    if (!actor2) return { error: "Not authenticated." };

    const result = await revokeShareLink(id, actor2);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/quotations/${id}`);
    return { ok: true as const };
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{withRevisionSuffix(quotation.quoteNo, quotation.revision)}</h1>
            <StatusBadge status={quotation.status} />
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {quotation.customer.name} — {quotation.customer.project || quotation.customer.siteAddress}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
          <div className="grid grid-cols-3 gap-2 md:flex md:items-center">
            <Link href={`/quotations/${id}/print`} target="_blank" className="rounded border border-neutral-300 px-3 py-1.5 text-center text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Print
            </Link>
            <Link href={`/quotations/${id}/edit`} className="rounded border border-neutral-300 px-3 py-1.5 text-center text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Edit
            </Link>
            <form action={duplicateAction}>
              <button type="submit" className="w-full rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#0c3125]">
                Duplicate
              </button>
            </form>
          </div>
          {/* Tax invoicing is hidden for now — see docs/archive/FUTURE-IDEAS.md's "Tax
              invoicing" entry. The underlying feature (lib/invoices.ts, the
              /invoices pages) is untouched; re-enable by restoring this
              block.
          {quotation.invoiceId ? (
            <Link
              href={`/invoices/${quotation.invoiceId}`}
              className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              View tax invoice →
            </Link>
          ) : (
            quotation.status === "approved" && (
              <Link
                href={`/invoices/new?from=${id}`}
                className="rounded border border-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#0f3d2e] hover:bg-neutral-50"
              >
                Raise tax invoice
              </Link>
            )
          )}
          */}
          <StatusActions status={quotation.status} onChange={statusAction} />
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Size (ft)</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Sqft</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, i) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-4 py-2">{item.description}</td>
                <td className="px-4 py-2">
                  {item.billed.w} x {item.billed.h}
                </td>
                <td className="px-4 py-2">{item.qty}</td>
                <td className="px-4 py-2">{item.totalAreaSqft}</td>
                <td className="px-4 py-2">₹{item.rate}</td>
                <td className="px-4 py-2 text-right font-medium">₹{item.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {quotation.items.map((item, i) => (
          <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-neutral-900">
                <span className="text-neutral-400">{i + 1}.</span> {item.description}
              </p>
              <p className="shrink-0 text-sm font-semibold text-neutral-900">₹{item.amount.toLocaleString("en-IN")}</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-neutral-500">
              <div>
                <span className="block text-neutral-400">Size (ft)</span>
                {item.billed.w} x {item.billed.h}
              </div>
              <div>
                <span className="block text-neutral-400">Qty × Sqft</span>
                {item.qty} × {item.totalAreaSqft}
              </div>
              <div>
                <span className="block text-neutral-400">Rate</span>₹{item.rate}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 w-full space-y-1 text-sm md:ml-auto md:w-64">
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal</span>
          <span>₹{quotation.totals.subtotal.toLocaleString("en-IN")}</span>
        </div>
        {quotation.gst.enabled && (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>CGST</span>
              <span>₹{quotation.totals.cgst.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>SGST</span>
              <span>₹{quotation.totals.sgst.toLocaleString("en-IN")}</span>
            </div>
          </>
        )}
        {quotation.totals.transportation > 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Transportation</span>
            <span>₹{quotation.totals.transportation.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 text-base font-semibold text-[#0f3d2e]">
          <span>Grand Total</span>
          <span>₹{quotation.totals.grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>
      <p className="mt-2 text-right text-xs italic text-neutral-500">{amountInWords(quotation.totals.grandTotal)}</p>

      <div className="mt-8">
        <SharePanel
          share={
            quotation.share
              ? {
                  token: quotation.share.token,
                  expiresAt: new Date(quotation.share.expiresAt).toISOString(),
                  viewCount: quotation.share.viewCount ?? 0,
                  lastViewedAt: quotation.share.lastViewedAt
                    ? new Date(quotation.share.lastViewedAt).toISOString()
                    : undefined,
                }
              : null
          }
          customerName={quotation.customer.name}
          customerPhone={quotation.customer.phone ?? ""}
          quoteNo={quotation.quoteNo}
          grandTotal={quotation.totals.grandTotal}
          companyName={companyName}
          onCreate={createShareAction}
          onRevoke={revokeShareAction}
        />
      </div>

      <div className="mt-6">
        <PaymentsPanel
          payments={JSON.parse(JSON.stringify(quotation.payments ?? []))}
          grandTotal={quotation.totals.grandTotal}
          scheme={quotation.terms.paymentScheme}
          canRecord={quotation.status === "approved"}
          onAdd={addPaymentAction}
          onRemove={removePaymentAction}
        />
      </div>
    </div>
  );
}
