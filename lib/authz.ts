import { users as usersCollection } from "./collections";
import type { UserRole } from "@/models/schemas";

/**
 * Central authorization rules.
 *
 * These live in lib/ rather than in pages deliberately: page-level checks are
 * easy to forget on a new route, and were in fact missing on the customers
 * pages and on every quotation mutation. Anything that reads or changes
 * user-owned data must go through the helpers here.
 *
 * Three-tier hierarchy: super_admin sees everything. An admin sees their own
 * records plus those of the workers they manage — never another admin's,
 * never another admin's workers', and never the super_admin's. A worker sees
 * only their own. This is enforced by scoping every query with
 * `ownershipFilter`/`canAccessOwned`, never by filtering results in JS after
 * the fact.
 */

export interface Actor {
  id: string;
  role: UserRole;
  /**
   * The ids of workers this actor manages (via User.managedBy). Empty for
   * `worker` (never needed — their filter is always just their own id) and
   * for `super_admin` (never needed — `{}` already covers everyone). Only
   * `admin` actors carry a non-empty list, and it's resolved once per request
   * by `resolveActor`, not computed inside these otherwise-pure helpers.
   */
  managedUserIds: string[];
}

/** Narrows a NextAuth session down to an id/role pair, or null when signed out. */
function baseActorFromSession(
  session: { user?: { id?: string; role?: UserRole } } | null | undefined
): { id: string; role: UserRole } | null {
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return { id: user.id, role: user.role };
}

/**
 * Synchronous narrowing, kept for callers (tests, mostly) that don't need the
 * managed-worker list resolved — e.g. checking `role` alone. Prefer
 * `resolveActor` in every page/action/API route, since `ownershipFilter` and
 * `canAccessOwned` need `managedUserIds` populated to scope an `admin`
 * correctly.
 */
export function actorFromSession(
  session: { user?: { id?: string; role?: UserRole } } | null | undefined
): Actor | null {
  const base = baseActorFromSession(session);
  if (!base) return null;
  return { ...base, managedUserIds: [] };
}

/**
 * The real entry point: narrows the session AND resolves which workers this
 * actor manages, so `ownershipFilter`/`canAccessOwned` can scope an `admin`
 * to "own + managed workers'" rather than just "own." Only queries the
 * database for role `admin` — a `worker`'s filter never consults
 * `managedUserIds`, and a `super_admin`'s `{}` filter doesn't either, so both
 * skip the query entirely.
 */
export async function resolveActor(
  session: { user?: { id?: string; role?: UserRole } } | null | undefined
): Promise<Actor | null> {
  const base = baseActorFromSession(session);
  if (!base) return null;
  if (base.role !== "admin") return { ...base, managedUserIds: [] };

  const col = await usersCollection();
  const managed = await col.find({ managedBy: base.id }).project({ _id: 1 }).toArray();
  return { ...base, managedUserIds: managed.map((u) => u._id.toString()) };
}

export function isSuperAdmin(actor: Actor | null | undefined): boolean {
  return actor?.role === "super_admin";
}

/** admin or super_admin — the tier that can reach Rate Master, Settings, and Users. */
export function isAdminTier(actor: Actor | null | undefined): boolean {
  return actor?.role === "admin" || actor?.role === "super_admin";
}

/**
 * Mongo filter restricting a query to what this actor may see:
 * super_admin sees everything, admin sees their own + their managed workers',
 * worker sees only their own. Compose it into a query rather than filtering
 * in JS, so the database never returns rows the caller isn't allowed to have.
 */
export function ownershipFilter(actor: Actor): Record<string, unknown> {
  if (isSuperAdmin(actor)) return {};
  if (actor.role === "admin") {
    return { createdBy: { $in: [actor.id, ...actor.managedUserIds] } };
  }
  return { createdBy: actor.id };
}

/** Whether this actor may read/modify a record created by `createdBy`. */
export function canAccessOwned(actor: Actor | null | undefined, createdBy: string): boolean {
  if (!actor) return false;
  if (isSuperAdmin(actor)) return true;
  if (actor.role === "admin") {
    return actor.id === createdBy || actor.managedUserIds.includes(createdBy);
  }
  return actor.id === createdBy;
}

/**
 * Whether this actor may manage (edit / reset password / deactivate) the
 * target user account. Distinct from `canAccessOwned`: that relation is about
 * quotation/customer ownership via `createdBy`; this one is about the
 * account-management hierarchy via `managedBy`. A super_admin is never a
 * valid target for anyone, including another super_admin (there is only one,
 * but the rule is principled rather than relying on that).
 */
export function canManageUser(
  actor: Actor | null | undefined,
  target: { id: string; role: UserRole; managedBy?: string }
): boolean {
  if (!actor) return false;
  if (target.role === "super_admin") return false;
  if (isSuperAdmin(actor)) return true;
  if (actor.role === "admin") return target.managedBy === actor.id;
  return false; // workers can never manage accounts, including their own
}

/** Rate master and company settings — operational tools for admin and super_admin. */
export function canManageSettings(actor: Actor | null | undefined): boolean {
  return isAdminTier(actor);
}
