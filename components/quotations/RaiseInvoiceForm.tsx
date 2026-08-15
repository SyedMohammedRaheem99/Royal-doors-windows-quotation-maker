"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { Buyer, InvoiceInput } from "@/models/schemas";

function inputClass() {
  return "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]";
}
function labelClass() {
  return "mb-1 block text-xs font-medium text-neutral-500";
}

export function RaiseInvoiceForm({
  initialBuyer,
  defaultHsnSac,
  onSubmit,
}: {
  initialBuyer: Buyer;
  defaultHsnSac: string;
  onSubmit: (input: InvoiceInput) => Promise<{ id: string } | { error: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [buyer, setBuyer] = useState<Buyer>(initialBuyer);
  const [hsnSac, setHsnSac] = useState(defaultHsnSac);
  const [vehicleNo, setVehicleNo] = useState("");
  const [address, setAddress] = useState(initialBuyer.addressLines.join("\n"));

  function handleSubmit() {
    if (!buyer.name.trim()) {
      toast.error("Buyer name is required on a tax invoice.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await onSubmit({
          buyer: { ...buyer, addressLines: address.split("\n").filter(Boolean) },
          hsnSac,
          vehicleNo,
        });
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success("Tax invoice raised.");
          router.push(`/invoices/${result.id}`);
        }
      } catch {
        toast.error("Couldn't raise the invoice. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Buyer (Bill to)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass()}>Name *</label>
            <input className={inputClass()} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={labelClass()}>Billing address (one line each)</label>
            <textarea className={inputClass()} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className={labelClass()}>Buyer GSTIN</label>
            <input
              className={inputClass()}
              value={buyer.gstin}
              placeholder="Leave blank for an unregistered buyer"
              onChange={(e) => setBuyer({ ...buyer, gstin: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass()}>State</label>
              <input className={inputClass()} value={buyer.stateName} onChange={(e) => setBuyer({ ...buyer, stateName: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>Code</label>
              <input className={inputClass()} value={buyer.stateCode} onChange={(e) => setBuyer({ ...buyer, stateCode: e.target.value })} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          A state code different from yours switches the invoice to IGST automatically.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Invoice details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass()}>HSN / SAC *</label>
            <input className={inputClass()} value={hsnSac} onChange={(e) => setHsnSac(e.target.value)} />
          </div>
          <div>
            <label className={labelClass()}>Vehicle no. (optional)</label>
            <input className={inputClass()} value={vehicleNo} placeholder="KA 41 AA 5651" onChange={(e) => setVehicleNo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleSubmit}
          className="rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:opacity-50 hover:bg-[#0c3125]"
        >
          {pending ? "Raising..." : "Raise tax invoice"}
        </button>
        <p className="text-xs text-neutral-400">An invoice can only be raised once per quotation.</p>
      </div>
    </div>
  );
}
