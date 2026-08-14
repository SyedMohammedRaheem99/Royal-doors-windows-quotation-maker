import type { NextAuthConfig } from "next-auth";

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
        session.user.role = token.role as "admin" | "sales";
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // populated in auth.ts
};
