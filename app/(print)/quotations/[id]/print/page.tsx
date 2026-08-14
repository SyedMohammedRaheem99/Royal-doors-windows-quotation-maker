import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { QuotationDocument } from "@/components/print/QuotationDocument";
import type { Quotation, Settings } from "@/models/schemas";

export default async function PrintQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const session = await auth();
  if (!session?.user) notFound(); // proxy.ts already protects /quotations/:path*; this is defense-in-depth

  const db = await getDb();
  const [quotationDoc, settingsDoc] = await Promise.all([
    db.collection("quotations").findOne({ _id: new ObjectId(id) }),
    db.collection("settings").findOne({}),
  ]);

  if (!quotationDoc || !settingsDoc) notFound();
  if (session.user.role !== "admin" && quotationDoc.createdBy !== session.user.id) notFound();

  // JSON round-trip strips Mongo's ObjectId/Date instances into plain
  // strings before crossing into the (partly client) component tree below.
  const quotation = JSON.parse(JSON.stringify(quotationDoc)) as Quotation;
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  return <QuotationDocument quotation={quotation} settings={settings} />;
}
