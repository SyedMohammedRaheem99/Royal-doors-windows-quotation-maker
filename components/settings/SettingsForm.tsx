"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { EditableSettingsFields } from "@/lib/settings";

function inputClass() {
  return "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]";
}
function labelClass() {
  return "block text-xs font-medium text-neutral-500 mb-1";
}

export function SettingsForm({
  initial,
  onSave,
}: {
  initial: EditableSettingsFields;
  onSave: (fields: EditableSettingsFields) => Promise<{ ok: true } | { error: string }>;
}) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const toast = useToast();

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await onSave(fields);
      if ("error" in result) {
        setMessage(result.error);
        toast.error(result.error);
      } else {
        setMessage("Settings saved.");
        toast.success("Settings saved.");
      }
    } catch {
      const text = "Couldn't save settings. Check your connection and try again.";
      setMessage(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Company</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass()}>Company name</label>
            <input className={inputClass()} value={fields.companyName} onChange={(e) => setFields({ ...fields, companyName: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={labelClass()}>Address (one line each)</label>
            <textarea
              className={inputClass()}
              rows={3}
              value={fields.addressLines.join("\n")}
              onChange={(e) => setFields({ ...fields, addressLines: e.target.value.split("\n") })}
            />
          </div>
          <div>
            <label className={labelClass()}>Phone</label>
            <input className={inputClass()} value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelClass()}>WhatsApp</label>
            <input className={inputClass()} value={fields.whatsapp} onChange={(e) => setFields({ ...fields, whatsapp: e.target.value })} />
          </div>
          <div>
            <label className={labelClass()}>Email</label>
            <input className={inputClass()} value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} />
          </div>
          <div>
            <label className={labelClass()}>Website</label>
            <input className={inputClass()} value={fields.website} onChange={(e) => setFields({ ...fields, website: e.target.value })} />
          </div>
          <div>
            <label className={labelClass()}>Company GSTIN</label>
            <input className={inputClass()} value={fields.gstin} onChange={(e) => setFields({ ...fields, gstin: e.target.value })} />
            <p className="mt-1 text-xs text-neutral-400">Required before a tax invoice can be raised.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={labelClass()}>State</label>
              <input className={inputClass()} value={fields.stateName} onChange={(e) => setFields({ ...fields, stateName: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>Code</label>
              <input className={inputClass()} value={fields.stateCode} onChange={(e) => setFields({ ...fields, stateCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass()}>Default HSN / SAC</label>
            <input className={inputClass()} value={fields.defaultHsnSac} onChange={(e) => setFields({ ...fields, defaultHsnSac: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Bank Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass()}>Account name</label>
            <input className={inputClass()} value={fields.bank.accountName} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, accountName: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>Bank name</label>
            <input className={inputClass()} value={fields.bank.bankName} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, bankName: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>Account number</label>
            <input className={inputClass()} value={fields.bank.accountNo} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, accountNo: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>IFSC code</label>
            <input className={inputClass()} value={fields.bank.ifsc} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, ifsc: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>Branch</label>
            <input className={inputClass()} value={fields.bank.branch} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, branch: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>UPI name</label>
            <input className={inputClass()} value={fields.bank.upiName} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, upiName: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass()}>UPI phone</label>
            <input className={inputClass()} value={fields.bank.upiPhone} onChange={(e) => setFields({ ...fields, bank: { ...fields.bank, upiPhone: e.target.value } })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125]"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {message && <span className="text-sm text-neutral-600">{message}</span>}
      </div>
    </div>
  );
}
