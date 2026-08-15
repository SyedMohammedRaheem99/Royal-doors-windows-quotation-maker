// Dev-only fixture — renders the real QuotationDocument against a hand-built
// sample so the branded print layout can be checked in a browser before any
// Atlas credentials exist. Not linked from the app nav, not behind auth.
import { QuotationDocument } from "@/components/print/QuotationDocument";
import { computeItem, computeTotals } from "@/lib/pricing";
import { SETTINGS_SEED } from "@/models/settingsSeed";
import type { Quotation } from "@/models/schemas";

const item1Computed = computeItem({ billedWidthFt: 5.5, billedHeightFt: 6.5, qty: 14, pricingMode: "per_sqft", rate: 355 });
const item2Computed = computeItem({ billedWidthFt: 2.5, billedHeightFt: 2, qty: 6, pricingMode: "per_unit", rate: 1800 });
const item3Computed = computeItem({ billedWidthFt: 3, billedHeightFt: 7, qty: 2, pricingMode: "per_unit", rate: 6500 });

const items: Quotation["items"] = [
  {
    id: "1",
    productType: "sliding_2_5_track_mesh",
    description: "2.5 Track sliding window with fly mesh",
    handing: "none",
    measuredMm: { w: 1676, h: 1981 },
    billed: { w: 5.5, h: 6.5 },
    qty: 14,
    pricingMode: "per_sqft",
    rate: 355,
    ...item1Computed,
    specs: { profile: "", colour: "White", glass: "Clear or pinned", glassThickness: "", mesh: "Aluminium mesh (standard)", track: "", hardware: "", reinforcement: "" },
    surcharges: [],
    diagram: { type: "sliding_2_5_track", panels: 2, meshPanels: 1, handing: "none", fanPoint: false },
    remarks: "",
  },
  {
    id: "2",
    productType: "ventilator_fan_point",
    description: "Ventilator with fan point",
    handing: "none",
    billed: { w: 2.5, h: 2 },
    qty: 6,
    pricingMode: "per_unit",
    rate: 1800,
    ...item2Computed,
    specs: { profile: "", colour: "White", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
    surcharges: [],
    diagram: { type: "ventilator", panels: 1, meshPanels: 0, handing: "none", fanPoint: true },
    remarks: "",
  },
  {
    id: "3",
    productType: "wpc_flush_door",
    description: "WPC flush door — Main door",
    handing: "left",
    billed: { w: 3, h: 7 },
    qty: 2,
    pricingMode: "per_unit",
    rate: 6500,
    ...item3Computed,
    specs: { profile: "WPC", colour: "Teak", glass: "", glassThickness: "", mesh: "", track: "", hardware: "", reinforcement: "" },
    surcharges: [],
    diagram: { type: "flush_door", panels: 1, meshPanels: 0, handing: "left", fanPoint: false },
    remarks: "With premium mortise lock",
  },
];

const totals = computeTotals(items, 18, 1000);

const quotation: Quotation = {
  quoteNo: "RDW/25-26/0007",
  revision: 0,
  status: "draft",
  date: new Date("2026-08-15"),
  customer: {
    name: "Mr. Sharjil Bhai",
    phone: "+91 98450 12345",
    siteAddress: "Site #12, Bommasandra Industrial Layout, Bengaluru",
    project: "Bommasandra Residence",
    referredBy: "Kaleem Bhai",
    gstin: "",
  },
  items,
  transportation: 1000,
  gst: { enabled: true, rate: 18 },
  totals,
  terms: {
    profile: SETTINGS_SEED.terms.profiles[0],
    glass: SETTINGS_SEED.terms.glass[0],
    warrantyYears: 15,
    workDuration: SETTINGS_SEED.terms.workDurations[6],
    paymentScheme: SETTINGS_SEED.terms.paymentSchemes[0],
    validityDays: 5,
    extraNotes: [],
  },
  statusHistory: [],
  payments: [],
  createdBy: "dev",
};

export default function DevPrintPage() {
  return <QuotationDocument quotation={quotation} settings={SETTINGS_SEED} />;
}
