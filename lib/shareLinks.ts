/**
 * Pure link-building helpers for sharing.
 *
 * Deliberately separate from lib/sharing.ts, which touches MongoDB and
 * node:crypto: these two functions are used by SharePanel, a client
 * component, and importing them from the server module pulled the entire
 * MongoDB driver into the browser bundle and broke the production build
 * ("Can't resolve 'child_process'/'dns'"). Anything imported by a
 * "use client" component must stay free of server-only dependencies.
 */

/** Builds the absolute public URL for a share token. */
export function shareUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/share/${token}`;
}

/**
 * A wa.me deep link with a prefilled message. Works on WhatsApp mobile and
 * Web, and needs no API key or business account — the salesperson sends it
 * from their own WhatsApp, which is how this business already works.
 */
export function whatsappUrl(opts: {
  phone?: string;
  customerName: string;
  quoteNo: string;
  grandTotal: number;
  link: string;
  companyName: string;
}): string {
  const amount = `₹${opts.grandTotal.toLocaleString("en-IN")}`;
  const message = [
    `Hello ${opts.customerName},`,
    ``,
    `Please find your quotation ${opts.quoteNo} from ${opts.companyName}.`,
    `Total: ${amount}`,
    ``,
    `View it here: ${opts.link}`,
  ].join("\n");

  // Strip everything but digits; wa.me rejects spaces and punctuation.
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  // Assume India (+91) when a bare 10-digit number is stored, which is how
  // the reference data recorded them.
  const normalised = digits.length === 10 ? `91${digits}` : digits;

  return normalised
    ? `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
