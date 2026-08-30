import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/models/schemas";

/**
 * Edge-safe config, used by middleware.ts for route protection. No
 * Credentials provider or bcrypt/Mongo here — both are Node-only and are
 * added separately in auth.ts, which only ever runs on the Node runtime
 * (API routes, server actions).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  // Auth.js only auto-trusts the request host on recognised platforms (Vercel
  // sets this for you). Without it, any other production host — a self-hosted
  // box, or `next start` on a laptop for an offline demo — rejects its own
  // callback URL with UntrustedHost and login silently fails.
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // populated in auth.ts
};
