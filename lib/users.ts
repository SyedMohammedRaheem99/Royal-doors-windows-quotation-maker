import { ObjectId } from "mongodb";
import { users as usersCollection, type UserDoc } from "./collections";
import { canManageUser, isSuperAdmin, type Actor } from "./authz";
import { hashPassword } from "./password";
import type { Result } from "./quotations";
import type { CreateUserInput, ResetPasswordInput } from "@/models/schemas";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

export type StoredUser = Omit<UserDoc, "passwordHash"> & { _id: ObjectId };

function toPublic(doc: UserDoc & { _id: ObjectId }): StoredUser {
  const { passwordHash: _passwordHash, ...rest } = doc;
  return rest;
}

/**
 * The name to print as "Prepared by" on a quotation/invoice document.
 * Deliberately unscoped by authz — a printed document already only reaches
 * whoever the quotation itself was shared with (ownership check on the
 * authenticated print route, token check on the public share route), and the
 * only thing being resolved here is a display name, the same unscoped shape
 * lib/dashboard.ts already uses to label its rep-breakdown rows. Returns null
 * rather than throwing so a stale/deleted createdBy never breaks the print.
 */
export async function getPreparedByName(userId: string): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null;
  const col = await usersCollection();
  const user = await col.findOne({ _id: new ObjectId(userId) });
  return user?.name ?? null;
}

/**
 * Users this actor may see and manage. super_admin sees every account;
 * an admin sees themself plus the workers they manage; a worker sees none —
 * they can never reach this screen (also gated by proxy.ts + the page).
 */
export async function listUsersFor(actor: Actor): Promise<Result<StoredUser[]>> {
  if (actor.role === "worker") return fail("Not authorized.");

  // ownershipFilter keys on createdBy, which user documents don't have — the
  // equivalent relation for users is managedBy/self, built directly here
  // rather than reusing ownershipFilter.
  const col = await usersCollection();
  const query = isSuperAdmin(actor)
    ? {}
    : { $or: [{ _id: new ObjectId(actor.id) }, { managedBy: actor.id }] };

  const rows = await col.find(query).sort({ createdAt: -1 }).toArray();
  return ok(rows.map(toPublic));
}

/**
 * Creates a new admin or worker account. Enforces the creation matrix
 * server-side — the UI only offers the roles an actor may create, but that's
 * a convenience, not the guard:
 *   super_admin -> may create admin or worker
 *   admin       -> may create worker only
 *   worker      -> may create no one
 */
export async function createUser(input: CreateUserInput, actor: Actor): Promise<Result<{ id: string }>> {
  if (actor.role === "worker") return fail("Not authorized.");
  if (actor.role === "admin" && input.role !== "worker") {
    return fail("An admin may only create worker accounts.");
  }

  const col = await usersCollection();
  const existing = await col.findOne({ email: input.email });
  if (existing) return fail("A user with this email already exists.");

  const passwordHash = await hashPassword(input.password);
  const result = await col.insertOne({
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
    managedBy: actor.id,
    active: true,
    createdAt: new Date(),
  });

  return ok({ id: result.insertedId.toString() });
}

/**
 * Resets another user's password — the only reset path in the app (see
 * ROADMAP: super_admin has no self-service reset at all; admin/worker resets
 * are performed by whoever manages them, relayed out of band, since there is
 * no email infrastructure here). canManageUser rejects any super_admin
 * target unconditionally.
 */
export async function resetUserPassword(
  userId: string,
  input: ResetPasswordInput,
  actor: Actor
): Promise<Result<null>> {
  if (!ObjectId.isValid(userId)) return fail("User not found.");

  const col = await usersCollection();
  const target = await col.findOne({ _id: new ObjectId(userId) });
  if (!target) return fail("User not found.");

  if (!canManageUser(actor, { id: target._id.toString(), role: target.role, managedBy: target.managedBy })) {
    return fail("Not authorized.");
  }

  const passwordHash = await hashPassword(input.newPassword);
  await col.updateOne({ _id: new ObjectId(userId) }, { $set: { passwordHash } });

  return ok(null);
}

/**
 * Deactivates a user account. Never deletes the document and never touches
 * createdBy on their historical quotations/customers — those must keep
 * resolving to a name and stay visible to whoever manages that user. A
 * deactivated user simply can't log in (see auth.ts's authorize check).
 */
export async function deactivateUser(userId: string, actor: Actor): Promise<Result<null>> {
  return setUserActive(userId, false, actor);
}

export async function reactivateUser(userId: string, actor: Actor): Promise<Result<null>> {
  return setUserActive(userId, true, actor);
}

async function setUserActive(userId: string, active: boolean, actor: Actor): Promise<Result<null>> {
  if (!ObjectId.isValid(userId)) return fail("User not found.");
  if (userId === actor.id) return fail("You cannot deactivate your own account.");

  const col = await usersCollection();
  const target = await col.findOne({ _id: new ObjectId(userId) });
  if (!target) return fail("User not found.");

  if (!canManageUser(actor, { id: target._id.toString(), role: target.role, managedBy: target.managedBy })) {
    return fail("Not authorized.");
  }

  await col.updateOne({ _id: new ObjectId(userId) }, { $set: { active } });
  return ok(null);
}
