"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { clearDraft, loadDraft, useDraftAutosave } from "./useDraftAutosave";
import type { GstRatePercent, PaymentScheme, RateCardEntry, TermsLibrary, WorkDuration } from "@/models/schemas";
import { ItemRow } from "./ItemRow";
import { MobileTotalsBar } from "./MobileTotalsBar";
import { TotalsPanel } from "./TotalsPanel";
import { emptyCustomer, emptyItem, type BuilderCustomer, type BuilderGst, type BuilderItem } from "./types";

export interface QuotationSavePayload {
  customer: BuilderCustomer;
  items: Array<{
    id: string;
    productType: string;
    description: string;
    room: string;
    handing: BuilderItem["handing"];
    measuredMm?: { w: number; h: number };
    billed: { w: number; h: number };
    qty: number;
    pricingMode: BuilderItem["pricingMode"];
    rate: number;
    specs: BuilderItem["specs"];
    surcharges: string[];
    toughenedGlassMm?: number;
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

/** Exactly the state the autosaved draft round-trips. */
interface DraftPayload {
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

  // Which item keys are collapsed to a summary line. A quotation with ten
  // fully-expanded items is unusable on a phone, which is the primary
  // on-site device — so once a new item is added, the previous ones fold up.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; quoteNo: string } | null>(null);
  const toast = useToast();

  // Autosave only applies to a NEW quotation — an edit already has a server
  // copy, and a stale local draft overriding it would be worse than losing
  // the unsaved changes. See useDraftAutosave for the full reasoning.
  const isNewQuotation = !initial;

  // Read any recoverable draft in a lazy initialiser rather than an effect.
  // An effect would setState during the first commit and trigger a second
  // render for no reason; this resolves in one pass. It also naturally runs
  // once, which is what we want — re-checking as the user types would keep
  // re-offering the very draft they are overwriting.
  //
  // loadDraft() guards `typeof window === "undefined"` and returns null on
  // the server, so this is safe during SSR; the value is simply null until
  // hydration, at which point React re-runs the initialiser on the client.
  const [recoverable, setRecoverable] = useState<number | null>(
    () => (isNewQuotation ? (loadDraft<DraftPayload>()?.savedAt ?? null) : null)
  );

  const draftState: DraftPayload = {
    customer,
    items,
    transportation,
    gst,
    warrantyYears,
    workDurationIdx,
    paymentSchemeIdx,
    profile,
    glass,
  };
  // Don't start saving until something has actually been typed, so merely
  // opening the page doesn't leave a phantom "restore draft?" prompt behind.
  const hasContent = customer.name.trim().length > 0 || items.some((it) => it.productType !== "");
  const draftSavedAt = useDraftAutosave(draftState, isNewQuotation && hasContent);

  function restoreDraft() {
    const draft = loadDraft<DraftPayload>();
    if (!draft) return;
    setCustomer(draft.data.customer);
    setItems(draft.data.items);
    setTransportation(draft.data.transportation);
    setGst(draft.data.gst);
    setWarrantyYears(draft.data.warrantyYears);
    setWorkDurationIdx(draft.data.workDurationIdx);
    setPaymentSchemeIdx(draft.data.paymentSchemeIdx);
    setProfile(draft.data.profile);
    setGlass(draft.data.glass);
    setRecoverable(null);
    toast.success("Draft restored.");
  }

  function discardDraft() {
    clearDraft();
    setRecoverable(null);
  }

  function updateItem(index: number, next: BuilderItem) {
    setItems((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    // Read the key before updating, rather than calling setCollapsedKeys from
    // inside the setItems updater — updaters must stay pure, or StrictMode's
    // double-invoke fires the nested setState twice.
    const removedKey = items[index]?.key;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (removedKey) {
      setCollapsedKeys((keys) => {
        if (!keys.has(removedKey)) return keys;
        const next = new Set(keys);
        next.delete(removedKey);
        return next;
      });
    }
  }

  /**
   * Most quotations repeat near-identical units (four bedroom windows of the
   * same spec, different sizes), so duplicating and adjusting is far faster
   * than re-selecting the product and every spec each time.
   */
  function duplicateItem(index: number) {
    setItems((prev) => {
      const source = prev[index];
      const copy: BuilderItem = {
        ...source,
        key: nextKey(),
        // Deep-copy the nested objects so editing the copy doesn't mutate
        // the original through a shared reference.
        billed: { ...source.billed },
        measuredMm: source.measuredMm ? { ...source.measuredMm } : undefined,
        specs: { ...source.specs },
        surcharges: [...source.surcharges],
      };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
          room: item.room,
          handing: item.handing,
          measuredMm: item.measuredMm,
          billed: item.billed,
          qty: item.qty,
          pricingMode: item.pricingMode,
          rate: item.rate,
          specs: item.specs,
          surcharges: item.surcharges,
          toughenedGlassMm: item.toughenedGlassMm,
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
        // The work is safely on the server now — keeping the local draft
        // would only resurface as a stale "restore?" prompt next time.
        clearDraft();
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
    <div className="flex flex-col gap-6 pb-20 md:grid md:grid-cols-[1fr_320px] md:pb-0">
      <div className="space-y-6">
        {recoverable && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              You have an unsaved draft from{" "}
              {new Date(recoverable).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#0c3125]"
              >
                Restore it
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Customer block */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Customer</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
            <div className="sm:col-span-2">
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

        {/* Room names seen across the reference quotations, offered as
            suggestions rather than a fixed list — every job differs. */}
        <datalist id="room-suggestions">
          {["Living room", "Master bedroom", "Bedroom 1", "Bedroom 2", "Kitchen", "Balcony", "Bathroom", "Terrace", "Staircase", "Pooja room", "Hall"].map(
            (room) => (
              <option key={room} value={room} />
            )
          )}
        </datalist>

        {/* Items */}
        <div className="space-y-3">
          {items.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-neutral-500">
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCollapsedKeys((prev) =>
                    prev.size === items.length ? new Set() : new Set(items.map((it) => it.key))
                  )
                }
                className="text-xs text-[#0f3d2e] hover:underline"
              >
                {collapsedKeys.size === items.length ? "Expand all" : "Collapse all"}
              </button>
            </div>
          )}
          {items.map((item, i) => (
            <ItemRow
              key={item.key}
              item={item}
              index={i}
              total={items.length}
              rateCard={rateCard}
              collapsed={collapsedKeys.has(item.key)}
              onToggleCollapsed={() =>
                setCollapsedKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(item.key)) next.delete(item.key);
                  else next.add(item.key);
                  return next;
                })
              }
              onChange={(next) => updateItem(i, next)}
              onRemove={() => removeItem(i)}
              onDuplicate={() => duplicateItem(i)}
              onMove={(dir) => moveItem(i, dir)}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const key = nextKey();
              // Fold the existing items away so the new one is the only thing
              // expanded — the common on-site flow is "add, fill, add again".
              setCollapsedKeys(new Set(items.map((it) => it.key)));
              setItems((prev) => [...prev, emptyItem(key)]);
            }}
            className="w-full rounded-lg border-2 border-dashed border-neutral-300 py-3 text-sm text-neutral-500 hover:border-[#0f3d2e] hover:text-[#0f3d2e]"
          >
            + Add item
          </button>
        </div>

        {/* Terms */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Terms</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
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

      {/* Sidebar — desktop only; MobileTotalsBar below covers this on phone/tablet. */}
      <div className="hidden space-y-4 md:block">
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

        {isNewQuotation && draftSavedAt && (
          <p className="text-center text-xs text-neutral-400">
            Draft saved locally at{" "}
            {new Date(draftSavedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 md:hidden">{error}</p>}

      <MobileTotalsBar
        items={items}
        transportation={transportation}
        onTransportationChange={setTransportation}
        gst={gst}
        onGstChange={setGst}
        gstPresets={gstPresets}
        canSave={canSave}
        saving={saving}
        saveLabel={saveLabel}
        onSave={handleSave}
      />
    </div>
  );
}
