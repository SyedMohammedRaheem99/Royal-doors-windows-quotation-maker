import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Next.js 16 renamed middleware.ts -> proxy.ts (same mechanism, new name/export).
// Proxy defaults to the Node.js runtime now, so this could import the full
// auth.ts directly, but keeping the edge-safe authConfig split costs nothing
// and stays portable if that default changes again.
//
// `next build`'s static export check requires an actual function declaration
// named `proxy` — `export const { auth: proxy } = ...` works in `next dev` but
// fails that build-time shape check, so it's wrapped in a real function below.
const { auth } = NextAuth(authConfig);

// auth() is typed with a union of argument shapes covering both routers, which
// TS can't narrow from a (request, event) call — it resolves against the
// Pages-Router `[NextApiRequest, NextApiResponse]` member and errors. Narrowed
// once here to the App-Router middleware shape NextAuth documents.
type ProxyHandler = (
  request: NextRequest,
  event: NextFetchEvent
) => Promise<NextResponse | Response | undefined>;

const authMiddleware = auth as unknown as ProxyHandler;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  // Route groups like (app) don't appear in the URL, so match the real paths.
  // NOTE: /share/:token is deliberately absent — it is the one public,
  // unauthenticated route, guarded by the token itself (see lib/sharing.ts).
  // Every new authenticated area must be added here; the pages also check
  // individually, but relying on that alone is one forgotten check away from
  // a leak.
  matcher: [
    "/dashboard/:path*",
    "/quotations/:path*",
    "/invoices/:path*",
    "/customers/:path*",
    "/rates/:path*",
    "/settings/:path*",
  ],
};
