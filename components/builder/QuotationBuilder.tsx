"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { GstRatePercent, PaymentScheme, RateCardEntry, TermsLibrary, WorkDuration } from "@/models/schemas";
import { ItemRow } from "./ItemRow";
import { TotalsPanel } from "./TotalsPanel";
import { emptyCustomer, emptyItem, type BuilderCustomer, type BuilderGst, type BuilderItem } from "./types";

export interface QuotationSavePayload {
  customer: BuilderCustomer;
  items: Array<{
    id: string;
    productType: string;
    description: string;
    handing: BuilderItem["handing"];
    measuredMm?: { w: number; h: number };
    billed: { w: number; h: number };
    qty: number;
    pricingMode: BuilderItem["pricingMode"];
    rate: number;
    specs: BuilderItem["specs"];
    surcharges: string[];
    diagram: {
      type: BuilderItem["diagramType"];
      panels: number;
      meshPanels: number;
      handing: BuilderItem["handing"];
      fanPoint: boolean;
    };
    remarks: string;
  }>;
  transportation: number;
  gst: BuilderGst;
  terms: {
    profile: string;
    glass: string;
    warrantyYears: number;
    workDuration?: WorkDuration;
    paymentScheme?: PaymentScheme;
    validityDays: number;
    extraNotes: string[];
  };
}

export type SaveResult = { id: string; quoteNo: string } | { error: string };

function inputClass() {
  return "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]";
}
function labelClass() {
  return "block text-xs font-medium text-neutral-500 mb-1";
}

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `item-${Date.now()}-${keyCounter}`;
}

export interface QuotationBuilderInitial {
  customer: BuilderCustomer;
  items: BuilderItem[];
  transportation: number;
  gst: BuilderGst;
  warrantyYears: number;
  workDurationIdx: number;
  paymentSchemeIdx: number;
  profile: string;
  glass: string;
}

export function QuotationBuilder({
  rateCard,
  gstPresets,
  terms,
  onSave,
  navigateOnSuccess = true,
  initial,
  saveLabel = "Save quotation",
}: {
  rateCard: RateCardEntry[];
  gstPresets: GstRatePercent[];
  terms: TermsLibrary;
  onSave: (payload: QuotationSavePayload) => Promise<SaveResult>;
  navigateOnSuccess?: boolean;
  /** Pre-fills the form from an existing quotation — used by edit and duplicate. */
  initial?: QuotationBuilderInitial;
  saveLabel?: string;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<BuilderCustomer>(initial?.customer ?? emptyCustomer());
  const [items, setItems] = useState<BuilderItem[]>(initial?.items ?? [emptyItem(nextKey())]);
  const [transportation, setTransportation] = useState(initial?.transportation ?? 0);
  const [gst, setGst] = useState<BuilderGst>(initial?.gst ?? { enabled: false, rate: (gstPresets[0] ?? 18) as GstRatePercent });

  const [warrantyYears, setWarrantyYears] = useState(initial?.warrantyYears ?? terms.warrantyYearsOptions[0] ?? 15);
  const [workDurationIdx, setWorkDurationIdx] = useState(initial?.workDurationIdx ?? 0);
  const [paymentSchemeIdx, setPaymentSchemeIdx] = useState(initial?.paymentSchemeIdx ?? 0);
  const [profile, setProfile] = useState(initial?.profile ?? terms.profiles[0] ?? "");
  const [glass, setGlass] = useState(initial?.glass ?? terms.glass[0] ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; quoteNo: string } | null>(null);
  const toast = useToast();

  function updateItem(index: number, next: BuilderItem) {
    setItems((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave = customer.name.trim().length > 0 && items.length > 0 && items.every((it) => it.productType);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload: QuotationSavePayload = {
        customer,
        items: items.map((item) => ({
          id: item.key,
          productType: item.productType,
          description: item.description,
          handing: item.handing,
          measuredMm: item.measuredMm,
          billed: item.billed,
          qty: item.qty,
          pricingMode: item.pricingMode,
          rate: item.rate,
          specs: item.specs,
          surcharges: item.surcharges,
          diagram: { type: item.diagramType, panels: 2, meshPanels: 0, handing: item.handing, fanPoint: item.fanPoint },
          remarks: item.remarks,
        })),
        transportation,
        gst,
        terms: {
          profile,
          glass,
          warrantyYears,
          workDuration: terms.workDurations[workDurationIdx],
          paymentScheme: terms.paymentSchemes[paymentSchemeIdx],
          validityDays: terms.validityDays,
          extraNotes: [],
        },
      };

      const result = await onSave(payload);
      if ("error" in result) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setSuccess(result);
        toast.success(`Saved as ${result.quoteNo}`);
        if (navigateOnSuccess) router.push(`/quotations/${result.id}`);
      }
    } catch {
      // A thrown exception (dropped connection, unexpected server error) is
      // exactly the case handleSave previously left the user with no
      // feedback for — the button just stopped spinning.
      const message = "Couldn't save the quotation. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {/* Customer block */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Customer</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass()}>Name *</label>
              <input className={inputClass()} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>Phone</label>
              <input className={inputClass()} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>Project / Site</label>
              <input className={inputClass()} value={customer.project} onChange={(e) => setCustomer({ ...customer, project: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={labelClass()}>Site address</label>
              <input className={inputClass()} value={customer.siteAddress} onChange={(e) => setCustomer({ ...customer, siteAddress: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>Referred by</label>
              <input className={inputClass()} value={customer.referredBy} onChange={(e) => setCustomer({ ...customer, referredBy: e.target.value })} />
            </div>
            <div>
              <label className={labelClass()}>GSTIN (optional)</label>
              <input className={inputClass()} value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item, i) => (
            <ItemRow key={item.key} item={item} index={i} rateCard={rateCard} onChange={(next) => updateItem(i, next)} onRemove={() => removeItem(i)} />
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem(nextKey())])}
            className="w-full rounded-lg border-2 border-dashed border-neutral-300 py-3 text-sm text-neutral-500 hover:border-[#0f3d2e] hover:text-[#0f3d2e]"
          >
            + Add item
          </button>
        </div>

        {/* Terms */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Terms</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass()}>Profile</label>
              <select className={inputClass()} value={profile} onChange={(e) => setProfile(e.target.value)}>
                {terms.profiles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Glass</label>
              <select className={inputClass()} value={glass} onChange={(e) => setGlass(e.target.value)}>
                {terms.glass.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Warranty</label>
              <select className={inputClass()} value={warrantyYears} onChange={(e) => setWarrantyYears(Number(e.target.value))}>
                {terms.warrantyYearsOptions.map((y) => (
                  <option key={y} value={y}>
                    {y} years
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass()}>Work duration</label>
              <select className={inputClass()} value={workDurationIdx} onChange={(e) => setWorkDurationIdx(Number(e.target.value))}>
                {terms.workDurations.map((wd, i) => (
                  <option key={i} value={i}>
                    {wd.fromDays} to {wd.toDays} days
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass()}>Payment scheme</label>
              <select className={inputClass()} value={paymentSchemeIdx} onChange={(e) => setPaymentSchemeIdx(Number(e.target.value))}>
                {terms.paymentSchemes.map((ps, i) => (
                  <option key={i} value={i}>
                    {ps.label} — {ps.steps.join(" ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <TotalsPanel items={items} transportation={transportation} onTransportationChange={setTransportation} gst={gst} onGstChange={setGst} gstPresets={gstPresets} />

        {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {success && !navigateOnSuccess && (
          <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            Saved as {success.quoteNo}
          </p>
        )}

        <button
          type="button"
          disabled={!canSave || saving}
          onClick={handleSave}
          className="w-full rounded bg-[#0f3d2e] py-2.5 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125]"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}
