import { describe, expect, it } from "vitest";
import { formatAmount, formatINR, formatINRCompact } from "../money";

describe("formatINR — what a customer reads on a quotation", () => {
  it("always shows two decimals, even when the value has one", () => {
    // The actual bug this exists to prevent: a real quotation total of
    // 177677.5 printed as "₹1,77,677.5" on a document sent to a customer.
    expect(formatINR(177677.5)).toBe("₹1,77,677.50");
  });

  it("shows two decimals on a whole number", () => {
    expect(formatINR(13000)).toBe("₹13,000.00");
  });

  it("uses Indian digit grouping (lakh/crore), not thousands", () => {
    expect(formatAmount(201477.5)).toBe("2,01,477.50");
    expect(formatAmount(10000000)).toBe("1,00,00,000.00");
  });

  it("never shows more than two decimals", () => {
    expect(formatINR(168009.72499999998)).toBe("₹1,68,009.72");
  });

  it("handles zero", () => {
    expect(formatINR(0)).toBe("₹0.00");
  });

  it("reproduces the reference quotation totals exactly", () => {
    expect(formatINR(238743)).toBe("₹2,38,743.00");
    expect(formatINR(49560)).toBe("₹49,560.00");
  });
});

describe("formatINRCompact — dense UI chrome, not printed documents", () => {
  it("drops decimals and rounds to whole rupees", () => {
    expect(formatINRCompact(177677.5)).toBe("₹1,77,678");
    expect(formatINRCompact(13000)).toBe("₹13,000");
  });
});
