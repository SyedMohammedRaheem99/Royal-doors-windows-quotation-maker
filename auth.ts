import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./lib/db";
import { verifyPassword } from "./lib/password";
import { isLockedOut, recordFailedAttempt, clearAttempts } from "./lib/loginThrottle";
import type { UserRole } from "./models/schemas";

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

        if (await isLockedOut(email)) return null;

        const db = await getDb();
        const user = await db.collection("users").findOne({ email });
        if (!user) {
          await recordFailedAttempt(email);
          return null;
        }

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) {
          await recordFailedAttempt(email);
          return null;
        }

        if (user.active === false) return null;

        await clearAttempts(email);

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        };
      },
    }),
  ],
});
