import bcrypt from "bcryptjs";

/**
 * Shared password hashing, used at both user-creation (seed script, the new
 * Users UI) and login-verification sites. Salt-round cost fixed at 10,
 * matching the value previously hardcoded separately in scripts/seed.ts.
 */
const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
