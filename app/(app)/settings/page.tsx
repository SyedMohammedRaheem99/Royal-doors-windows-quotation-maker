import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { updateSettingsFields, type EditableSettingsFields } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/dashboard");

  const db = await getDb();
  const settingsDoc = await db.collection("settings").findOne({});
  if (!settingsDoc) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Settings have not been seeded yet. Run <code>npm run seed</code> first.
      </p>
    );
  }

  const initial: EditableSettingsFields = JSON.parse(
    JSON.stringify({
      companyName: settingsDoc.companyName,
      addressLines: settingsDoc.addressLines,
      phone: settingsDoc.phone,
      whatsapp: settingsDoc.whatsapp,
      email: settingsDoc.email,
      website: settingsDoc.website,
      gstin: settingsDoc.gstin ?? "",
      bank: settingsDoc.bank,
    })
  );

  async function saveAction(fields: EditableSettingsFields) {
    "use server";
    const session2 = await auth();
    if (session2?.user.role !== "admin") return { error: "Not authorized." };
    await updateSettingsFields(fields);
    return { ok: true as const };
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Company profile and bank details shown on every quotation. Terms library (profiles, glass, payment schemes) is
        managed via the seed script for now.
      </p>
      <SettingsForm initial={initial} onSave={saveAction} />
    </div>
  );
}
