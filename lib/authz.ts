import type { UserRole } from "@/models/schemas";

/**
 * Central authorization rules.
 *
 * These live in lib/ rather than in pages deliberately: page-level checks are
 * easy to forget on a new route, and were in fact missing on the customers
 * pages and on every quotation mutation. Anything that reads or changes
 * user-owned data must go through the helpers here.
 */

export interface Actor {
  id: string;
  role: UserRole;
}

/** Narrows a NextAuth session down to an Actor, or null when signed out. */
export function actorFromSession(
  session: { user?: { id?: string; role?: UserRole } } | null | undefined
): Actor | null {
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return { id: user.id, role: user.role };
}

export function isAdmin(actor: Actor | null | undefined): boolean {
  return actor?.role === "admin";
}

/**
 * Mongo filter restricting a query to what this actor may see: admins see
 * everything, sales users see only records they created. Compose it into a
 * query rather than filtering in JS, so the database never returns rows the
 * caller isn't allowed to have.
 */
export function ownershipFilter(actor: Actor): Record<string, unknown> {
  return isAdmin(actor) ? {} : { createdBy: actor.id };
}

/** Whether this actor may read/modify a record created by `createdBy`. */
export function canAccessOwned(actor: Actor | null | undefined, createdBy: string): boolean {
  if (!actor) return false;
  return isAdmin(actor) || actor.id === createdBy;
}

/** Admin-only areas: the rate master and company settings. */
export function canManageSettings(actor: Actor | null | undefined): boolean {
  return isAdmin(actor);
}
