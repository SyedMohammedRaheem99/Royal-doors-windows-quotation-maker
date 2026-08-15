import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { settings as settingsCollection } from "@/lib/collections";
import { loadQuotationFor } from "@/lib/quotations";
import { QuotationDocument } from "@/components/print/QuotationDocument";
import type { Quotation, Settings } from "@/models/schemas";

export default async function PrintQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // proxy.ts already protects /quotations/:path*; loadQuotationFor additionally
  // enforces ownership, so a sales user can't print another rep's quotation.
  const actor = actorFromSession(await auth());
  if (!actor) notFound();

  const [loaded, settingsCol] = await Promise.all([loadQuotationFor(id, actor), settingsCollection()]);
  if (!loaded.ok) notFound();

  const settingsDoc = await settingsCol.findOne({});
  if (!settingsDoc) notFound();

  // JSON round-trip strips Mongo's ObjectId/Date instances into plain
  // strings before crossing into the (partly client) component tree below.
  const quotation = JSON.parse(JSON.stringify(loaded.data)) as Quotation;
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  return <QuotationDocument quotation={quotation} settings={settings} />;
}
