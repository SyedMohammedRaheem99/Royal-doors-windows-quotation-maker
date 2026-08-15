import { describe, expect, it } from "vitest";
import { CUSTOMER_INDEXES, QUOTATION_INDEXES, RATE_CARD_INDEXES, USER_INDEXES } from "../indexes";

describe("index definitions — structural sanity, run without a live DB", () => {
  it("every index has an explicit name", () => {
    // Explicit names are what make scripts/migrate.mjs safe to re-run: an
    // unnamed index gets a Mongo-generated name derived from its keys, which
    // silently changes if the key order ever changes, defeating idempotency.
    for (const set of [QUOTATION_INDEXES, CUSTOMER_INDEXES, USER_INDEXES, RATE_CARD_INDEXES]) {
      for (const idx of set) {
        expect(idx.name, JSON.stringify(idx.key)).toBeTruthy();
      }
    }
  });

  it("no two indexes in the same collection share a name", () => {
    for (const set of [QUOTATION_INDEXES, CUSTOMER_INDEXES, USER_INDEXES, RATE_CARD_INDEXES]) {
      const names = set.map((i) => i.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("quoteNo, user email, and rate card productType are unique", () => {
    // These three are data-integrity backstops, not just performance
    // indexes — verified against a live DB in scripts/test-indexes.mjs, but
    // this catches someone removing `unique: true` in a future edit.
    expect(QUOTATION_INDEXES.find((i) => i.name === "quoteNo_unique")?.unique).toBe(true);
    expect(USER_INDEXES.find((i) => i.name === "email_unique")?.unique).toBe(true);
    expect(RATE_CARD_INDEXES.find((i) => i.name === "productType_unique")?.unique).toBe(true);
  });

  it("the collated customer-name index shares its key with the plain one but not its name", () => {
    const plain = CUSTOMER_INDEXES.find((i) => i.name === "createdBy_name");
    const collated = CUSTOMER_INDEXES.find((i) => i.name === "createdBy_name_collated");
    expect(plain?.key).toEqual(collated?.key);
    expect(collated?.collation).toBeDefined();
  });
});
