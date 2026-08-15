import { notFound } from "next/navigation";
import { settings as settingsCollection } from "@/lib/collections";
import { recordShareView, resolveShareToken } from "@/lib/sharing";
import { QuotationDocument } from "@/components/print/QuotationDocument";
import type { Quotation, Settings } from "@/models/schemas";

/**
 * The public quotation view — the ONLY route in this app that serves data to
 * an unauthenticated visitor.
 *
 * Deliberately narrow: it resolves a token to exactly one quotation and
 * renders the same customer-facing document the salesperson prints. There is
 * no navigation, no list, and no way to reach any other record from here, so
 * a leaked link exposes one quotation and nothing else.
 *
 * noindex/nofollow because these links are shared over WhatsApp and must
 * never turn up in a search engine.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedQuotationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const quotation = await resolveShareToken(token);
  // Same response for an unknown, revoked, or expired token — a visitor
  // must not be able to tell which.
  if (!quotation) notFound();

  const settingsCol = await settingsCollection();
  const settingsDoc = await settingsCol.findOne({});
  if (!settingsDoc) notFound();

  // Fire-and-forget; a failure here must not break the customer's page.
  void recordShareView(token);

  const plainQuotation = JSON.parse(JSON.stringify(quotation)) as Quotation;
  const plainSettings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  return <QuotationDocument quotation={plainQuotation} settings={plainSettings} />;
}
