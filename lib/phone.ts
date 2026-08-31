/**
 * Phone display formatting for customer-facing documents.
 *
 * The settings seed stores bare local numbers ("91485 46403") while customer
 * records are entered with a country code ("+91 98450 12345"), so the printed
 * quotation showed the company's own number unqualified next to a customer's
 * qualified one. Every number a customer might dial goes through here.
 *
 * Display only — never store the formatted form, and never use this to
 * compare or de-duplicate numbers.
 */

/** Digits only, country code stripped, for grouping decisions. */
function localDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  // 91XXXXXXXXXX — an Indian number that already carries its country code.
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

/**
 * "+91 98450 12345". Indian mobile numbers are conventionally grouped 5+5.
 *
 * Anything that isn't a recognisable 10-digit Indian number is returned
 * untouched rather than mangled — a landline with an STD code, an
 * international number, or a half-entered value stays exactly as the user
 * typed it.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const local = localDigits(trimmed);
  if (!local) return trimmed;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
