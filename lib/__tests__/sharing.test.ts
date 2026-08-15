import { describe, expect, it } from "vitest";
// From lib/shareLinks, not lib/sharing: these are the client-safe helpers,
// and importing the server module here would pull MongoDB into the test.
import { shareUrl, whatsappUrl } from "../shareLinks";

describe("shareUrl", () => {
  it("builds an absolute link from an origin and token", () => {
    expect(shareUrl("abc123", "https://quote.example.com")).toBe("https://quote.example.com/share/abc123");
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(shareUrl("abc123", "https://quote.example.com/")).toBe("https://quote.example.com/share/abc123");
  });
});

describe("whatsappUrl", () => {
  const base = {
    customerName: "Nayaz Ahmed",
    quoteNo: "RDW/25-26/0042",
    grandTotal: 152654,
    link: "https://quote.example.com/share/tok",
    companyName: "Royal Doors and Windows",
  };

  it("targets a specific number when a phone is known", () => {
    const url = whatsappUrl({ ...base, phone: "9876543210" });
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("assumes +91 for a bare 10-digit Indian number", () => {
    // The reference data stored numbers without a country code.
    const url = whatsappUrl({ ...base, phone: "9845012345" });
    expect(url).toContain("wa.me/919845012345");
  });

  it("strips spaces and punctuation, which wa.me rejects", () => {
    const url = whatsappUrl({ ...base, phone: "+91 98450 12345" });
    expect(url).toContain("wa.me/919845012345");
  });

  it("leaves an already-prefixed number alone rather than double-prefixing", () => {
    const url = whatsappUrl({ ...base, phone: "919845012345" });
    expect(url).toContain("wa.me/919845012345");
    expect(url).not.toContain("9191");
  });

  it("falls back to the contact picker when no phone is stored", () => {
    const url = whatsappUrl({ ...base, phone: "" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("includes the quote number, total, and link in the message", () => {
    const decoded = decodeURIComponent(whatsappUrl({ ...base, phone: "9876543210" }));
    expect(decoded).toContain("RDW/25-26/0042");
    expect(decoded).toContain("1,52,654"); // Indian digit grouping
    expect(decoded).toContain("https://quote.example.com/share/tok");
    expect(decoded).toContain("Nayaz Ahmed");
  });

  it("percent-encodes the message so newlines and symbols survive the URL", () => {
    const url = whatsappUrl({ ...base, phone: "9876543210" });
    // A raw newline or '#' in a query string would truncate the message.
    expect(url).not.toContain("\n");
    expect(url).toContain("%0A");
  });
});
