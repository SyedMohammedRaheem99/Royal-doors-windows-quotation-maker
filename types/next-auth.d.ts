import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "admin" | "sales";
  }

  interface Session {
    user: {
      role: "admin" | "sales";
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "sales";
    id: string;
  }
}
