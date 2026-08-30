import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { settings as settingsCollection } from "@/lib/collections";
import { loadInvoiceFor } from "@/lib/invoices";
import { InvoiceDocument } from "@/components/print/InvoiceDocument";
import type { Invoice, Settings } from "@/models/schemas";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = await resolveActor(await auth());
  if (!actor) notFound();

  const [loaded, settingsCol] = await Promise.all([loadInvoiceFor(id, actor), settingsCollection()]);
  if (!loaded.ok) notFound();

  const settingsDoc = await settingsCol.findOne({});
  if (!settingsDoc) notFound();

  const invoice = JSON.parse(JSON.stringify(loaded.data)) as Invoice;
  const settings = JSON.parse(JSON.stringify(settingsDoc)) as Settings;

  return <InvoiceDocument invoice={invoice} settings={settings} />;
}
