import type { UserRole } from "@/models/schemas";

/**
 * Human-readable role names for the UI. The stored values are internal enum
 * strings ("super_admin"), and printing those raw — as the header did, in
 * parentheses next to the user's name — reads as a database field leaking into
 * the product. Display only; nothing keys off these.
 */
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Owner",
  admin: "Admin",
  worker: "Staff",
};

export function roleLabel(role: UserRole | string | undefined | null): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}
