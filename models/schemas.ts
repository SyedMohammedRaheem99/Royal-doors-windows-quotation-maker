import { z } from "zod";

/** ---------- shared enums ---------- */

export const PRODUCT_CATEGORIES = [
  "sliding",
  "casement_fixed",
  "ventilator",
  "door",
  "mesh",
  "aluminium",
] as const;
export const ProductCategory = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof ProductCategory>;

/** Drives which SVG the diagram engine renders for a line item. */
export const DIAGRAM_TYPES = [
  "sliding_2_track",
  "sliding_2_5_track",
  "sliding_3_track",
  "sliding_vertical",
  "casement",
  "fixed",
  "top_hung",
  "combination",
  "ventilator",
  "louver",
  "sliding_door",
  "french_door",
  "flush_door",
  "bathroom_door",
  "mesh_standalone",
  "aluminium_window",
  "aluminium_sliding",
] as const;
export const DiagramType = z.enum(DIAGRAM_TYPES);
export type DiagramType = z.infer<typeof DiagramType>;

export const PricingMode = z.enum(["per_sqft", "per_unit"]);
export type PricingMode = z.infer<typeof PricingMode>;

/** Directional modifier used systematically in the source data: "Ventilator with fan point (Left)". */
export const Handing = z.enum(["none", "left", "right"]);
export type Handing = z.infer<typeof Handing>;

export const UserRole = z.enum(["admin", "sales"]);
export type UserRole = z.infer<typeof UserRole>;

export const QuotationStatus = z.enum(["draft", "sent", "approved", "lost"]);
export type QuotationStatus = z.infer<typeof QuotationStatus>;

/**
 * Which status changes are allowed from each state. A quotation can be sent,
 * then won or lost; a lost one can be revived back to sent if the customer
 * comes back (common in this trade). Editing a non-draft quotation resets it
 * to draft and bumps the revision — see updateQuotation.
 */
export const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ["sent"],
  sent: ["approved", "lost", "draft"],
  approved: ["sent"],
  lost: ["sent"],
};

export const StatusEventSchema = z.object({
  from: QuotationStatus,
  to: QuotationStatus,
  at: z.date(),
  by: z.string(),
});
export type StatusEvent = z.infer<typeof StatusEventSchema>;

export const GstRatePercent = z.union([z.literal(18), z.literal(9), z.literal(0)]);
export type GstRatePercent = z.infer<typeof GstRatePercent>;

/** ---------- users ---------- */

export const UserSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string(),
  role: UserRole,
  createdAt: z.date().optional(),
});
export type User = z.infer<typeof UserSchema>;

/** ---------- customers ---------- */

export const CustomerSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  siteAddress: z.string().optional().default(""),
  project: z.string().optional().default(""), // "Project:" field seen throughout the reference sheets
  referredBy: z.string().optional().default(""), // "Ref:" field
  gstin: z.string().optional().default(""),
  createdBy: z.string(),
  createdAt: z.date().optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;

/** ---------- rate card (admin-managed pricing master) ---------- */

export const SpecOptionsSchema = z.object({
  profiles: z.array(z.string()).default([]),
  colours: z.array(z.string()).default([]),
  glass: z.array(z.string()).default([]),
  mesh: z.array(z.string()).default([]),
});
export type SpecOptions = z.infer<typeof SpecOptionsSchema>;

export const RateCardEntrySchema = z.object({
  _id: z.string().optional(),
  productType: z.string().min(1), // slug, e.g. "sliding_2_track"
  label: z.string().min(1), // "2 Track sliding window"
  category: ProductCategory,
  pricingMode: PricingMode,
  defaultRate: z.number().nonnegative(),
  minRate: z.number().nonnegative(),
  maxRate: z.number().nonnegative(),
  diagramType: DiagramType,
  specOptions: SpecOptionsSchema.default({ profiles: [], colours: [], glass: [], mesh: [] }),
  active: z.boolean().default(true),
});
export type RateCardEntry = z.infer<typeof RateCardEntrySchema>;

/** ---------- settings (single document) ---------- */

export const BankDetailsSchema = z.object({
  accountName: z.string().default("ROYAL DOORS AND WINDOWS"),
  bankName: z.string().default("YES BANK"),
  accountNo: z.string().default(""),
  ifsc: z.string().default(""),
  branch: z.string().default(""),
  upiName: z.string().default(""),
  upiPhone: z.string().default(""),
});
export type BankDetails = z.infer<typeof BankDetailsSchema>;

export const WorkDurationSchema = z.object({
  fromDays: z.number().int().positive(),
  toDays: z.number().int().positive(),
});
export type WorkDuration = z.infer<typeof WorkDurationSchema>;

export const PaymentSchemeSchema = z.object({
  label: z.string(), // "60 / 30 / 10"
  steps: z.array(z.string()), // ["60% advance.", "30% before dispatch.", "10% after installation."]
});
export type PaymentScheme = z.infer<typeof PaymentSchemeSchema>;

export const TermsLibrarySchema = z.object({
  boilerplate: z.array(z.string()).default([]),
  profiles: z.array(z.string()).default([]),
  glass: z.array(z.string()).default([]),
  warrantyYearsOptions: z.array(z.number()).default([15, 10]),
  workDurations: z.array(WorkDurationSchema).default([]),
  paymentSchemes: z.array(PaymentSchemeSchema).default([]),
  validityDays: z.number().default(5),
});
export type TermsLibrary = z.infer<typeof TermsLibrarySchema>;

export const SettingsSchema = z.object({
  _id: z.string().optional(),
  companyName: z.string().default("Royal Doors and Windows"),
  addressLines: z.array(z.string()).default([]),
  phone: z.string().default(""),
  whatsapp: z.string().default(""),
  email: z.string().default(""),
  website: z.string().default(""),
  gstin: z.string().default(""), // shown on a quotation only when that quotation's GST toggle is on
  bank: BankDetailsSchema.default({
    accountName: "ROYAL DOORS AND WINDOWS",
    bankName: "YES BANK",
    accountNo: "",
    ifsc: "",
    branch: "",
    upiName: "",
    upiPhone: "",
  }),
  gstPresets: z.array(GstRatePercent).default([18, 9, 0]),
  terms: TermsLibrarySchema,
  quoteNumbering: z.object({
    prefix: z.string().default("RDW"),
    financialYearLabel: z.string(), // "25-26"
    counter: z.number().int().nonnegative().default(0),
  }),
  /**
   * Invoices carry their OWN sequence, separate from quotations. The
   * reference Tally invoices used a plain 3-digit series ("001", "005",
   * "006") independent of any quote number, and GST rules expect an
   * invoice series that is continuous and doesn't skip.
   */
  invoiceNumbering: z
    .object({
      prefix: z.string().default("INV"),
      financialYearLabel: z.string(),
      counter: z.number().int().nonnegative().default(0),
    })
    .optional(),
  /** State code for GST place-of-supply. Karnataka is 29. */
  stateName: z.string().default("Karnataka"),
  stateCode: z.string().default("29"),
  /** HSN/SAC printed on invoices — 3917 on the reference invoices (plastic builders' ware). */
  defaultHsnSac: z.string().default("3917"),
  invoiceDeclaration: z
    .string()
    .default(
      "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
    ),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** ---------- quotations ---------- */

export const CustomerSnapshotSchema = z.object({
  name: z.string(),
  phone: z.string().default(""),
  siteAddress: z.string().default(""),
  project: z.string().default(""),
  referredBy: z.string().default(""),
  gstin: z.string().default(""),
});
export type CustomerSnapshot = z.infer<typeof CustomerSnapshotSchema>;

export const ItemSpecsSchema = z.object({
  profile: z.string().default(""),
  colour: z.string().default(""),
  glass: z.string().default(""),
  glassThickness: z.string().default(""),
  mesh: z.string().default(""),
  track: z.string().default(""),
  hardware: z.string().default(""),
  reinforcement: z.string().default(""),
});
export type ItemSpecs = z.infer<typeof ItemSpecsSchema>;

export const DiagramSpecSchema = z.object({
  type: DiagramType,
  panels: z.number().int().positive().default(2),
  meshPanels: z.number().int().nonnegative().default(0),
  handing: Handing.default("none"),
  fanPoint: z.boolean().default(false),
});
export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;

export const QuotationItemSchema = z.object({
  id: z.string(),
  productType: z.string(), // rate-card slug this item was priced from
  description: z.string().min(1), // "2.5 Track sliding window with fly mesh"
  handing: Handing.default("none"),
  measuredMm: z.object({ w: z.number().nonnegative(), h: z.number().nonnegative() }).optional(),
  billed: z.object({ w: z.number().positive(), h: z.number().positive() }),
  qty: z.number().int().positive(),
  pricingMode: PricingMode,
  rate: z.number().nonnegative(), // snapshotted from the rate card at add-time
  areaPerUnitSqft: z.number().nonnegative(),
  totalAreaSqft: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  specs: ItemSpecsSchema,
  surcharges: z.array(z.string()).default([]),
  diagram: DiagramSpecSchema,
  remarks: z.string().default(""),
});
export type QuotationItem = z.infer<typeof QuotationItemSchema>;

export const QuotationTotalsSchema = z.object({
  subtotal: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  transportation: z.number(),
  grandTotal: z.number(),
  roundOff: z.number(),
});
export type QuotationTotals = z.infer<typeof QuotationTotalsSchema>;

export const QuotationTermsSchema = z.object({
  profile: z.string().default(""),
  glass: z.string().default(""),
  warrantyYears: z.number().default(15),
  workDuration: WorkDurationSchema.optional(),
  paymentScheme: PaymentSchemeSchema.optional(),
  validityDays: z.number().default(5),
  extraNotes: z.array(z.string()).default([]),
});
export type QuotationTerms = z.infer<typeof QuotationTermsSchema>;

/**
 * What the client is trusted to send when creating a quotation — omits
 * areaPerUnitSqft/totalAreaSqft/amount, which the server always derives
 * itself from billed dimensions + rate (see app/api/quotations/route.ts).
 * A client-sent amount is never persisted; this is the same anti-stale-GST
 * discipline as lib/pricing.ts, applied to line items too.
 */
export const QuotationItemInputSchema = QuotationItemSchema.omit({
  areaPerUnitSqft: true,
  totalAreaSqft: true,
  amount: true,
});
export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>;

export const QuotationInputSchema = z.object({
  customer: CustomerSnapshotSchema,
  items: z.array(QuotationItemInputSchema).min(1),
  transportation: z.number().nonnegative().default(0),
  gst: z.object({ enabled: z.boolean(), rate: GstRatePercent }),
  terms: QuotationTermsSchema,
});
export type QuotationInput = z.infer<typeof QuotationInputSchema>;

/**
 * How a payment reached the business. Mirrors the vocabulary in the
 * `HKBK - Suhail` reference sheet, which tracked "Cash" and "Online"
 * receipts against a quotation.
 */
export const PaymentMethod = z.enum(["cash", "online", "cheque", "upi"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  method: PaymentMethod,
  receivedAt: z.date(),
  note: z.string().default(""),
  recordedBy: z.string(),
  recordedAt: z.date(),
});
export type Payment = z.infer<typeof PaymentSchema>;

/** What the client may send when recording a payment — server supplies id, recordedBy, recordedAt. */
export const PaymentInputSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero."),
  method: PaymentMethod,
  receivedAt: z.coerce.date(),
  note: z.string().max(200).default(""),
});
export type PaymentInput = z.infer<typeof PaymentInputSchema>;

/**
 * A public share link. The token is the only credential, so it must be
 * long and random; expiry limits how long a leaked link stays useful.
 */
export const ShareLinkSchema = z.object({
  token: z.string().min(32),
  createdAt: z.date(),
  expiresAt: z.date(),
  createdBy: z.string(),
  /** Bumped on each view, so the salesperson can tell whether the customer opened it. */
  viewCount: z.number().int().nonnegative().default(0),
  lastViewedAt: z.date().optional(),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const QuotationSchema = z.object({
  _id: z.string().optional(),
  quoteNo: z.string(), // "RDW/25-26/0042"
  revision: z.number().int().nonnegative().default(0),
  status: QuotationStatus.default("draft"),
  date: z.date(),
  customer: CustomerSnapshotSchema,
  items: z.array(QuotationItemSchema).default([]),
  transportation: z.number().nonnegative().default(0),
  gst: z.object({
    enabled: z.boolean().default(false),
    rate: GstRatePercent.default(0),
  }),
  totals: QuotationTotalsSchema,
  terms: QuotationTermsSchema,
  statusHistory: z.array(StatusEventSchema).default([]),
  payments: z.array(PaymentSchema).default([]),
  /** Set once this quotation has been invoiced, so it can't be invoiced twice. */
  invoiceId: z.string().optional(),
  /**
   * A public, unguessable link the customer can open without an account.
   * Absent until the salesperson explicitly shares it, and revocable.
   */
  share: ShareLinkSchema.optional(),
  createdBy: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Quotation = z.infer<typeof QuotationSchema>;

/** ---------- tax invoices ---------- */

/**
 * A GST tax invoice, generated from an approved quotation. Structurally
 * distinct from a quotation, matching the Tally-produced invoices in the
 * reference data: a buyer block with GSTIN and state code, HSN/SAC, an
 * HSN summary table, amount in words, and a declaration.
 *
 * Unlike the reference invoices — which collapsed everything into a single
 * "uPVC windows" line — this keeps the real line items, because a customer
 * who received an itemised quotation should get an itemised invoice.
 */
export const InvoiceLineSchema = z.object({
  id: z.string(),
  description: z.string(),
  hsnSac: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string().default("sqft"),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

export const BuyerSchema = z.object({
  name: z.string(),
  addressLines: z.array(z.string()).default([]),
  gstin: z.string().default(""),
  stateName: z.string().default(""),
  stateCode: z.string().default(""),
});
export type Buyer = z.infer<typeof BuyerSchema>;

export const InvoiceTotalsSchema = z.object({
  taxableValue: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  igst: z.number().default(0),
  transportation: z.number().default(0),
  grandTotal: z.number(),
  roundOff: z.number().default(0),
});
export type InvoiceTotals = z.infer<typeof InvoiceTotalsSchema>;

export const InvoiceSchema = z.object({
  _id: z.string().optional(),
  invoiceNo: z.string(), // "INV/25-26/001"
  date: z.date(),
  /** The quotation this was raised from — invoices are never created standalone. */
  quotationId: z.string(),
  quoteNo: z.string(),
  buyer: BuyerSchema,
  lines: z.array(InvoiceLineSchema).default([]),
  gstRate: GstRatePercent,
  /**
   * Intra-state (CGST+SGST) vs inter-state (IGST). Determined by comparing
   * the buyer's state code with the seller's — Karnataka to Karnataka is
   * intra-state, which is every invoice in the reference data.
   */
  supplyType: z.enum(["intra_state", "inter_state"]).default("intra_state"),
  totals: InvoiceTotalsSchema,
  vehicleNo: z.string().default(""),
  declaration: z.string().default(""),
  createdBy: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

/** What the user may adjust when raising an invoice from a quotation. */
export const InvoiceInputSchema = z.object({
  buyer: BuyerSchema,
  vehicleNo: z.string().max(30).default(""),
  hsnSac: z.string().min(1, "HSN/SAC is required on a tax invoice."),
});
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;
