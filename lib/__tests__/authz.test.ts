import { describe, expect, it } from "vitest";
import { actorFromSession, canAccessOwned, canManageSettings, canManageUser, ownershipFilter } from "../authz";
import { STATUS_TRANSITIONS, type QuotationStatus } from "@/models/schemas";

const superAdmin = { id: "super-1", role: "super_admin" as const, managedUserIds: [] };
const admin1 = { id: "admin-1", role: "admin" as const, managedUserIds: ["worker-1"] };
const admin2 = { id: "admin-2", role: "admin" as const, managedUserIds: ["worker-2"] };
const worker1 = { id: "worker-1", role: "worker" as const, managedUserIds: [] };

describe("ownershipFilter — what a query is allowed to return", () => {
  it("does not restrict super_admin", () => {
    expect(ownershipFilter(superAdmin)).toEqual({});
  });

  it("restricts an admin to their own records plus their managed workers'", () => {
    expect(ownershipFilter(admin1)).toEqual({ createdBy: { $in: ["admin-1", "worker-1"] } });
  });

  it("restricts a worker to their own records only", () => {
    expect(ownershipFilter(worker1)).toEqual({ createdBy: "worker-1" });
  });

  it("is applied at the query level, so the DB never returns forbidden rows", () => {
    // Guards the design decision, not just the value: filtering in JS after
    // fetching would still pull other reps' data across the wire.
    const filter = ownershipFilter(worker1);
    expect(filter).toHaveProperty("createdBy");
  });
});

describe("canAccessOwned — the rule the mutations enforce", () => {
  it("lets super_admin access anyone's record", () => {
    expect(canAccessOwned(superAdmin, "worker-1")).toBe(true);
    expect(canAccessOwned(superAdmin, "admin-1")).toBe(true);
    expect(canAccessOwned(superAdmin, "worker-2")).toBe(true);
  });

  it("lets an admin access their own record and their managed worker's", () => {
    expect(canAccessOwned(admin1, "admin-1")).toBe(true);
    expect(canAccessOwned(admin1, "worker-1")).toBe(true);
  });

  it("BLOCKS an admin from another admin's record or their worker's", () => {
    expect(canAccessOwned(admin1, "admin-2")).toBe(false);
    expect(canAccessOwned(admin1, "worker-2")).toBe(false);
  });

  it("BLOCKS an admin from the super_admin's record", () => {
    expect(canAccessOwned(admin1, "super-1")).toBe(false);
  });

  it("lets a worker access their own record", () => {
    expect(canAccessOwned(worker1, "worker-1")).toBe(true);
  });

  it("BLOCKS a worker from another worker's or any admin's record", () => {
    // This is the hole that existed before Phase 1: mutations took only a
    // userId and never checked it, so guessing a URL was enough to edit
    // someone else's quotation.
    expect(canAccessOwned(worker1, "worker-2")).toBe(false);
    expect(canAccessOwned(worker1, "admin-1")).toBe(false);
    expect(canAccessOwned(worker1, "super-1")).toBe(false);
  });

  it("blocks a signed-out actor", () => {
    expect(canAccessOwned(null, "worker-1")).toBe(false);
    expect(canAccessOwned(undefined, "worker-1")).toBe(false);
  });
});

describe("canManageUser — the account-management hierarchy (distinct from record ownership)", () => {
  const targetAdmin1 = { id: "admin-1", role: "admin" as const, managedBy: "super-1" };
  const targetWorker1 = { id: "worker-1", role: "worker" as const, managedBy: "admin-1" };
  const targetWorker2 = { id: "worker-2", role: "worker" as const, managedBy: "admin-2" };
  const targetSuperAdmin = { id: "super-1", role: "super_admin" as const };

  it("lets super_admin manage any admin or worker", () => {
    expect(canManageUser(superAdmin, targetAdmin1)).toBe(true);
    expect(canManageUser(superAdmin, targetWorker1)).toBe(true);
    expect(canManageUser(superAdmin, targetWorker2)).toBe(true);
  });

  it("never lets anyone manage a super_admin, including another super_admin", () => {
    expect(canManageUser(superAdmin, targetSuperAdmin)).toBe(false);
    expect(canManageUser(admin1, targetSuperAdmin)).toBe(false);
  });

  it("lets an admin manage a worker they created, not one they didn't", () => {
    expect(canManageUser(admin1, targetWorker1)).toBe(true);
    expect(canManageUser(admin1, targetWorker2)).toBe(false);
  });

  it("does not let an admin manage another admin", () => {
    expect(canManageUser(admin2, targetAdmin1)).toBe(false);
  });

  it("never lets a worker manage any account, including their own", () => {
    expect(canManageUser(worker1, targetWorker1)).toBe(false);
  });

  it("blocks a signed-out actor", () => {
    expect(canManageUser(null, targetWorker1)).toBe(false);
  });
});

describe("canManageSettings — admin-tier areas (Rate Master, Settings)", () => {
  it("allows admin and super_admin", () => {
    expect(canManageSettings(admin1)).toBe(true);
    expect(canManageSettings(superAdmin)).toBe(true);
  });

  it("denies workers and signed-out visitors", () => {
    expect(canManageSettings(worker1)).toBe(false);
    expect(canManageSettings(null)).toBe(false);
  });
});

describe("actorFromSession — sync narrowing (managedUserIds always empty; use resolveActor for the real list)", () => {
  it("narrows a valid session", () => {
    expect(actorFromSession({ user: { id: "u1", role: "worker" } })).toEqual({
      id: "u1",
      role: "worker",
      managedUserIds: [],
    });
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
