import Image from "next/image";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { PasswordField } from "@/components/auth/PasswordField";

/**
 * Deliberately no "forgot password" link on this page. super_admin
 * credentials are set once via the seed script and are never self-reset —
 * if lost, only direct DB/script access can rotate them. admin and worker
 * accounts get their password reset FOR them by whoever manages them, from
 * the Users screen (lib/users.ts's resetUserPassword) — there is no email
 * infrastructure in this app, so there is no self-service reset for anyone.
 * Do not add a forgot-password flow here without re-reading that decision.
 */

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f3d2e] px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <Image
            src="/Logo.jpg"
            alt="Royal Doors and Windows"
            width={765}
            height={676}
            priority
            className="mx-auto mb-4 h-28 w-auto rounded"
          />
          <p className="text-sm text-neutral-500">Quotation Maker</p>
        </div>

        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid email or password.
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <div className="mt-1">
              <PasswordField id="password" name="password" required />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-[#0f3d2e] py-2 text-sm font-semibold text-[#c9a227] transition hover:bg-[#0c3125]"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
