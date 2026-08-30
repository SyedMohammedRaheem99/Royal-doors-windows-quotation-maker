import { notFound } from "next/navigation";

/**
 * Hard gate on every /dev/* QA harness.
 *
 * These pages exist to check UI without a database or credentials, and they
 * are deliberately not behind auth (proxy.ts's matcher doesn't cover /dev).
 * That is fine locally and a real leak in production: /dev/rates renders the
 * whole RATE_CARD_SEED — Royal's product list and pricing — and /dev/print
 * renders the full document template. Neither should ever be reachable on a
 * public deployment.
 *
 * A server-component layout is the right place for this: it wraps all four
 * harnesses (two of which are "use client", so they can't guard themselves at
 * module scope), and notFound() here makes the whole segment a genuine 404 in
 * production rather than merely unlinked.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
