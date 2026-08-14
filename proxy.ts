import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed middleware.ts -> proxy.ts (same mechanism, new name/export).
// Proxy defaults to the Node.js runtime now, so this could import the full
// auth.ts directly, but keeping the edge-safe authConfig split costs nothing
// and stays portable if that default changes again.
export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  // Route groups like (app) don't appear in the URL, so match the real paths.
  matcher: ["/dashboard/:path*", "/quotations/:path*", "/customers/:path*", "/rates/:path*", "/settings/:path*"],
};
