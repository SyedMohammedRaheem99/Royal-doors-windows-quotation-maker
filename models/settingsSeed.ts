import type { Settings } from "./schemas";

/**
 * Seed settings document, verbatim from the reference letterhead, bank block
 * and the canonical 10-point Note found across the majority of the 76 sheets
 * in `_reference/Royal - March.xlsx`. All fields are editable in Settings —
 * this is the starting state, not a hardcoded constant.
 */

function currentIndianFinancialYearLabel(date = new Date()): string {
  // Indian FY runs April -> March. On/after April, FY is (year)-(year+1).
  const year = date.getFullYear();
  const fyStartYear = date.getMonth() >= 3 ? year : year - 1; // getMonth() 3 == April
  const shortStart = String(fyStartYear).slice(-2);
  const shortEnd = String(fyStartYear + 1).slice(-2);
  return `${shortStart}-${shortEnd}`;
}

export const SETTINGS_SEED: Omit<Settings, "_id"> = {
  companyName: "Royal Doors and Windows",
  addressLines: ["No 935, 2nd Main Road, 4th Cross", "R.K. Hegde Nagar, Thanisandra", "Bangalore - 560077"],
  phone: "91485 46403",
  whatsapp: "77603 33403",
  email: "info@royaldoorsandwindows.com",
  website: "www.royaldoorsandwindows.com",
  gstin: "", // fill in via Settings once registered/available
  bank: {
    accountName: "ROYAL DOORS AND WINDOWS",
    bankName: "YES BANK",
    accountNo: "051361900004817",
    ifsc: "YESB0000513",
    branch: "SAHAKAR NAGAR",
    upiName: "Mohammed Azgar",
    upiPhone: "988 688 5566",
  },
  gstPresets: [18, 9, 0],
  terms: {
    boilerplate: [
      "We use Aluminum mesh screen.",
      "We use Reinforcement GI all 4 sides in frames.",
      "No Warranty for glass & hardware.",
      "Silicon one side only, for both side will be extra.",
      "We use premium hardware.",
      "Above is not a final measurement, final quotation will be as per final measurement.",
      "Other color or one way glass rs 30 extra per sqft.",
      "SS Mesh if required, rs 20/- extra per sqft.",
      "If Aluminum track required, rs 20/- extra per sqft.",
    ],
    profiles: [
      "BAYDEE (Half white) German Technology UPVC Profile.",
      "GT / Galaxy Trader (Milk white) German Technology UPVC Profile.",
      "Green Tech German Technology UPVC Profile.",
      "Fenstech German Technology UPVC Profile.",
      "Eroline German Technology UPVC Profile.",
    ],
    glass: [
      "Glass clear or pinned.",
      "Glass - Pinned glass.",
      "Glass frosted.",
      "Glass golden tinted.",
      "Glass one way blue.",
      "Glass one way brown.",
      "Glass one way golden.",
      "Glass one way green.",
    ],
    warrantyYearsOptions: [15, 10],
    workDurations: [
      { fromDays: 2, toDays: 3 },
      { fromDays: 3, toDays: 4 },
      { fromDays: 4, toDays: 5 },
      { fromDays: 5, toDays: 7 },
      { fromDays: 7, toDays: 10 },
      { fromDays: 8, toDays: 10 },
      { fromDays: 10, toDays: 12 },
      { fromDays: 10, toDays: 15 },
      { fromDays: 12, toDays: 15 },
      { fromDays: 15, toDays: 20 },
      { fromDays: 20, toDays: 25 },
      { fromDays: 25, toDays: 30 },
    ],
    paymentSchemes: [
      {
        label: "60 / 30 / 10",
        steps: ["60% advance.", "30% before dispatch.", "10% after installation."],
      },
      {
        label: "70 / 20 / 10",
        steps: ["70% advance.", "20% before dispatch.", "10% after installation."],
      },
      {
        label: "70 / 30",
        steps: ["70% advance.", "30% after installation."],
      },
      {
        label: "100% upfront (small jobs)",
        steps: ["100% payment for amount less than 20,000/-."],
      },
    ],
    validityDays: 5,
  },
  quoteNumbering: {
    prefix: "RDW",
    financialYearLabel: currentIndianFinancialYearLabel(),
    counter: 0,
  },
  invoiceNumbering: {
    prefix: "INV",
    financialYearLabel: currentIndianFinancialYearLabel(),
    counter: 0,
  },
  // Place of supply for GST. Karnataka is state code 29 — the reference
  // invoices' buyer blocks used 29, though the seller block on two of them
  // incorrectly said 77.
  stateName: "Karnataka",
  stateCode: "29",
  // HSN for plastic builders' ware, as used on the reference tax invoices.
  defaultHsnSac: "3917",
  invoiceDeclaration:
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
};
