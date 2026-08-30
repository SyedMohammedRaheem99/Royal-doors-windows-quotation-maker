import type { Quotation, TermsLibrary } from "@/models/schemas";
import type { BuilderCustomer, BuilderGst, BuilderItem } from "./types";

/** Reverse of what the builder produces — turns a saved Quotation back into builder working state, for editing and duplicating. */
export function quotationToBuilderState(quotation: Quotation, terms: TermsLibrary) {
  const customer: BuilderCustomer = { ...quotation.customer };

  const items: BuilderItem[] = quotation.items.map((item) => ({
    key: item.id,
    productType: item.productType,
    description: item.description,
    room: item.room ?? "", // absent on quotations created before room grouping existed
    diagramType: item.diagram.type,
    handing: item.handing,
    fanPoint: item.diagram.fanPoint,
    measuredMm: item.measuredMm,
    billed: item.billed,
    qty: item.qty,
    pricingMode: item.pricingMode,
    rate: item.rate,
    specs: item.specs,
    surcharges: item.surcharges,
    toughenedGlassMm: item.toughenedGlassMm,
    remarks: item.remarks,
  }));

  const transportation = quotation.transportation;
  const gst: BuilderGst = { ...quotation.gst };

  // Best-effort match back to an index in the current terms library — if the
  // exact combination no longer exists there (library edited since), falls
  // back to index 0 rather than losing the ability to render the select.
  const workDurationIdx = Math.max(
    0,
    terms.workDurations.findIndex(
      (wd) => wd.fromDays === quotation.terms.workDuration?.fromDays && wd.toDays === quotation.terms.workDuration?.toDays
    )
  );
  const paymentSchemeIdx = Math.max(
    0,
    terms.paymentSchemes.findIndex((ps) => ps.label === quotation.terms.paymentScheme?.label)
  );

  return {
    customer,
    items,
    transportation,
    gst,
    warrantyYears: quotation.terms.warrantyYears,
    workDurationIdx,
    paymentSchemeIdx,
    profile: quotation.terms.profile,
    glass: quotation.terms.glass,
  };
}
