import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./lib/db";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const db = await getDb();
        const user = await db.collection("users").findOne({ email });
        if (!user) return null;

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role as "admin" | "sales",
        };
      },
    }),
  ],
});
