import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { quotations as quotationsCollection, type StoredQuotation } from "./collections";
import type { Actor } from "./authz";
import { loadQuotationFor, type Result } from "./quotations";
import type { ShareLink } from "@/models/schemas";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
// (fail is unused here now that all failures come from loadQuotationFor)

export const SHARE_VALID_DAYS = 30;

/**
 * 32 bytes of CSPRNG entropy, base64url-encoded. The token IS the
 * credential for the public link — there is no other check — so it must be
 * long enough that guessing is infeasible and must come from a crypto RNG,
 * never Math.random().
 */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates (or replaces) the public share link for a quotation.
 *
 * Re-sharing mints a NEW token rather than reusing the old one, so
 * "share again" after a link has been sent to the wrong person doesn't keep
 * the old link alive.
 */
export async function createShareLink(id: string, actor: Actor): Promise<Result<ShareLink>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;

  const now = new Date();
  const share: ShareLink = {
    token: generateToken(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SHARE_VALID_DAYS * 86400000),
    createdBy: actor.id,
    viewCount: 0,
  };

  const col = await quotationsCollection();
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { share, updatedAt: now } });

  return ok(share);
}

/** Revokes the link immediately — the token stops working on the next request. */
export async function revokeShareLink(id: string, actor: Actor): Promise<Result<null>> {
  const loaded = await loadQuotationFor(id, actor);
  if (!loaded.ok) return loaded;

  const col = await quotationsCollection();
  await col.updateOne({ _id: new ObjectId(id) }, { $unset: { share: "" }, $set: { updatedAt: new Date() } });

  return ok(null);
}

/**
 * Resolves a public token to a quotation. Deliberately takes NO actor: this
 * is the one path in the app that serves data to an unauthenticated visitor,
 * which is exactly why it is narrow — it matches on the token only, checks
 * expiry, and returns nothing on any failure so a caller can't distinguish
 * "wrong token" from "expired" from "revoked".
 */
export async function resolveShareToken(token: string): Promise<StoredQuotation | null> {
  if (!token || token.length < 32) return null;

  const col = await quotationsCollection();
  const quotation = await col.findOne({ "share.token": token });
  if (!quotation?.share) return null;

  if (new Date(quotation.share.expiresAt).getTime() < Date.now()) return null;

  return quotation;
}

/** Records that the customer opened the link. Best-effort — a failure here must not block the page. */
export async function recordShareView(token: string): Promise<void> {
  try {
    const col = await quotationsCollection();
    await col.updateOne(
      { "share.token": token },
      { $inc: { "share.viewCount": 1 }, $set: { "share.lastViewedAt": new Date() } }
    );
  } catch {
    // Intentionally swallowed: view analytics are not worth failing a
    // customer-facing page over.
  }
}

// shareUrl() and whatsappUrl() live in lib/shareLinks.ts — they are used by
// a client component, and this module's MongoDB import must not follow them
// into the browser bundle. Re-exported here for server-side callers.
export { shareUrl, whatsappUrl } from "./shareLinks";
