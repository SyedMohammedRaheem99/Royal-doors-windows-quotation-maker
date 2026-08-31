import type { CustomAddon, DiagramType, GstRatePercent, Handing, ItemSpecs, PricingMode } from "@/models/schemas";

/** Client-side working state for one line item, before it's persisted as a QuotationItem. */
export interface BuilderItem {
  key: string;
  productType: string; // rate-card slug; "" until chosen
  description: string;
  /**
   * Which room or area this unit belongs to — "Master bedroom", "Balcony",
   * "Kitchen". Optional, but when used the printed quotation groups by it
   * with per-room subtotals, which is how a customer reads a multi-room job.
   */
  room: string;
  diagramType: DiagramType;
  handing: Handing;
  fanPoint: boolean;
  measuredMm?: { w: number; h: number };
  billed: { w: number; h: number }; // decimal feet, the value pricing actually uses
  qty: number;
  pricingMode: PricingMode;
  rate: number; // snapshotted from the rate card at add-time, editable
  specs: ItemSpecs;
  surcharges: string[]; // keys into SURCHARGES
  /** Priced separately from `surcharges` — see lib/pricing.ts's toughenedGlassSurcharge(). */
  toughenedGlassMm?: number;
  /** Per-line override of the computed colour surcharge — see lib/pricing.ts's colorPerSqftSurcharge(). */
  colorSurchargeOverride?: number;
  /** Free-form priced extras (DGU glass, WPC fitting, one-offs) — see CustomAddon. */
  customAddons: CustomAddon[];
  remarks: string;
}

export function emptyItem(key: string): BuilderItem {
  return {
    key,
    productType: "",
    description: "",
    room: "",
    diagramType: "fixed",
    handing: "none",
    fanPoint: false,
    billed: { w: 1, h: 1 },
    qty: 1,
    pricingMode: "per_sqft",
    rate: 0,
    specs: { profile: "", colour: "", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
    surcharges: [],
    customAddons: [],
    remarks: "",
  };
}

export interface BuilderCustomer {
  name: string;
  phone: string;
  siteAddress: string;
  project: string;
  referredBy: string;
  gstin: string;
}

export function emptyCustomer(): BuilderCustomer {
  return { name: "", phone: "", siteAddress: "", project: "", referredBy: "", gstin: "" };
}

export interface BuilderGst {
  enabled: boolean;
  rate: GstRatePercent;
}
