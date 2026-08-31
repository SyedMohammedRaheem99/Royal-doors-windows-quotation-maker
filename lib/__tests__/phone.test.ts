import { describe, expect, it } from "vitest";
import { formatPhone } from "../phone";

describe("formatPhone — company and customer numbers must look alike", () => {
  it("qualifies a bare 10-digit number with +91", () => {
    // The actual bug: settings stored "91485 46403" and the printed footer
    // showed it unqualified next to a customer's "+91 98450 12345".
    expect(formatPhone("91485 46403")).toBe("+91 91485 46403");
  });

  it("does not double the country code on an already-qualified number", () => {
    expect(formatPhone("+91 98450 12345")).toBe("+91 98450 12345");
    expect(formatPhone("919845012345")).toBe("+91 98450 12345");
  });

  it("normalises whatever separators were typed", () => {
    expect(formatPhone("98450-12345")).toBe("+91 98450 12345");
    expect(formatPhone("9845012345")).toBe("+91 98450 12345");
  });

  it("leaves anything it does not recognise untouched rather than mangling it", () => {
    // A landline with an STD code, or a half-entered number, must survive.
    expect(formatPhone("080 2345 6789")).toBe("080 2345 6789");
    expect(formatPhone("98450")).toBe("98450");
  });

  it("returns an empty string for missing values so callers can guard on it", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
    expect(formatPhone("")).toBe("");
  });
});
