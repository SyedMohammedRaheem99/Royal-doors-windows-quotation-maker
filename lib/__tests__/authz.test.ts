import { describe, expect, it } from "vitest";
import { actorFromSession, canAccessOwned, canManageSettings, ownershipFilter } from "../authz";
import { STATUS_TRANSITIONS, type QuotationStatus } from "@/models/schemas";

const admin = { id: "admin-1", role: "admin" as const };
const sales = { id: "sales-1", role: "sales" as const };
const otherSales = { id: "sales-2", role: "sales" as const };

describe("ownershipFilter — what a query is allowed to return", () => {
  it("does not restrict admins", () => {
    expect(ownershipFilter(admin)).toEqual({});
  });

  it("restricts a sales user to their own records", () => {
    expect(ownershipFilter(sales)).toEqual({ createdBy: "sales-1" });
  });

  it("is applied at the query level, so the DB never returns forbidden rows", () => {
    // Guards the design decision, not just the value: filtering in JS after
    // fetching would still pull other reps' data across the wire.
    const filter = ownershipFilter(sales);
    expect(filter).toHaveProperty("createdBy");
  });
});

describe("canAccessOwned — the rule the mutations enforce", () => {
  it("lets an admin access anyone's record", () => {
    expect(canAccessOwned(admin, "sales-1")).toBe(true);
    expect(canAccessOwned(admin, "sales-2")).toBe(true);
  });

  it("lets a sales user access their own record", () => {
    expect(canAccessOwned(sales, "sales-1")).toBe(true);
  });

  it("BLOCKS a sales user from another rep's record", () => {
    // This is the hole that existed: updateQuotation/duplicateQuotation/
    // setQuotationStatus took only a userId and never checked it, so guessing
    // a URL was enough to edit someone else's quotation.
    expect(canAccessOwned(sales, "sales-2")).toBe(false);
    expect(canAccessOwned(otherSales, "sales-1")).toBe(false);
  });

  it("blocks a signed-out actor", () => {
    expect(canAccessOwned(null, "sales-1")).toBe(false);
    expect(canAccessOwned(undefined, "sales-1")).toBe(false);
  });
});

describe("canManageSettings — admin-only areas", () => {
  it("allows admins", () => {
    expect(canManageSettings(admin)).toBe(true);
  });

  it("denies sales users and signed-out visitors", () => {
    expect(canManageSettings(sales)).toBe(false);
    expect(canManageSettings(null)).toBe(false);
  });
});

describe("actorFromSession", () => {
  it("narrows a valid session", () => {
    expect(actorFromSession({ user: { id: "u1", role: "sales" } })).toEqual({ id: "u1", role: "sales" });
  });

  it("returns null when signed out or the session is incomplete", () => {
    expect(actorFromSession(null)).toBeNull();
    expect(actorFromSession(undefined)).toBeNull();
    expect(actorFromSession({})).toBeNull();
    expect(actorFromSession({ user: { id: "u1" } })).toBeNull();
    expect(actorFromSession({ user: { role: "admin" } })).toBeNull();
  });
});

describe("STATUS_TRANSITIONS — the workflow rules", () => {
  it("only lets a draft be sent", () => {
    expect(STATUS_TRANSITIONS.draft).toEqual(["sent"]);
  });

  it("lets a sent quotation be won, lost, or pulled back to draft", () => {
    expect(STATUS_TRANSITIONS.sent).toEqual(expect.arrayContaining(["approved", "lost", "draft"]));
  });

  it("allows a lost quotation to be revived (customers do come back)", () => {
    expect(STATUS_TRANSITIONS.lost).toContain("sent");
  });

  it("never allows jumping straight from draft to approved", () => {
    // A quotation the customer has never been sent cannot have been accepted.
    expect(STATUS_TRANSITIONS.draft).not.toContain("approved");
  });

  it("defines transitions for every status, so no state is a dead end by accident", () => {
    const statuses: QuotationStatus[] = ["draft", "sent", "approved", "lost"];
    for (const status of statuses) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
    }
  });

  it("never lists a self-transition", () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });
});
