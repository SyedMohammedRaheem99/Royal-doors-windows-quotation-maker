import { getDb } from "./db";

/**
 * Basic brute-force guard on login, keyed by email. There's no self-service
 * password reset for super_admin (see auth login page comment), so an
 * unthrottled Credentials provider would let an attacker script unlimited
 * guesses against that one unrecoverable account. Backed by Mongo rather
 * than in-memory since Vercel's serverless functions don't share memory
 * across invocations.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

async function attemptsCollection() {
  const db = await getDb();
  return db.collection("loginAttempts");
}

/** True if this email is currently locked out from further attempts. */
export async function isLockedOut(email: string): Promise<boolean> {
  const col = await attemptsCollection();
  const doc = await col.findOne({ email });
  if (!doc) return false;
  if (Date.now() - doc.windowStart.getTime() > WINDOW_MS) return false;
  return doc.count >= MAX_ATTEMPTS;
}

/** Record a failed login attempt, starting a fresh window if the old one expired. */
export async function recordFailedAttempt(email: string): Promise<void> {
  const col = await attemptsCollection();
  const doc = await col.findOne({ email });
  const now = new Date();

  if (!doc || now.getTime() - doc.windowStart.getTime() > WINDOW_MS) {
    await col.updateOne({ email }, { $set: { email, windowStart: now, count: 1 } }, { upsert: true });
  } else {
    await col.updateOne({ email }, { $inc: { count: 1 } });
  }
}

/** Clear the counter on a successful login. */
export async function clearAttempts(email: string): Promise<void> {
  const col = await attemptsCollection();
  await col.deleteOne({ email });
}
