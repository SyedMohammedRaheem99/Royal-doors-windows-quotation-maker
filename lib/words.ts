/**
 * Converts a rupee amount to words using the Indian numbering system
 * (lakh / crore), matching the style seen on the reference Tax Invoices:
 * "INR. Forty nine thousand five hundred & sixty only."
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]} ${ONES[ones]}`;
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return twoDigits(rest);
  const hundredsPart = `${ONES[hundreds]} Hundred`;
  return rest === 0 ? hundredsPart : `${hundredsPart} ${twoDigits(rest)}`;
}

/** Whole-rupee part only, in words, Indian grouping (crore / lakh / thousand / hundred). */
export function rupeesInWords(amount: number): string {
  const whole = Math.round(Math.abs(amount));
  if (whole === 0) return "Zero";

  const crore = Math.floor(whole / 1e7);
  const lakh = Math.floor((whole % 1e7) / 1e5);
  const thousand = Math.floor((whole % 1e5) / 1e3);
  const hundred = whole % 1e3;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(" ");
}

/**
 * "Rupees Two Lakh Thirty-Eight Thousand Seven Hundred Forty-Three Only"
 *
 * Standard Indian invoice/quotation form. Three things this deliberately does
 * NOT do, each of which was wrong in the earlier "INR. ... only." version:
 * - No "INR." — INR is an ISO 4217 code, not an abbreviation, so the trailing
 *   full stop was simply incorrect. The customary word on an Indian
 *   commercial document is "Rupees".
 * - No trailing full stop. The string is a formal legal phrase, not a
 *   sentence, and it is set on its own line.
 * - Compound numbers are hyphenated ("Thirty-Eight", not "Thirty Eight"),
 *   which is standard English and what a bank or auditor expects to see.
 *
 * Title Case throughout is intentional and conventional for this phrase.
 */
export function amountInWords(amount: number): string {
  const hyphenated = rupeesInWords(amount).replace(
    /(Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety) (One|Two|Three|Four|Five|Six|Seven|Eight|Nine)/g,
    "$1-$2"
  );
  return `Rupees ${hyphenated} Only`;
}
