import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { isAdminTier, resolveActor } from "@/lib/authz";
import { ToastProvider } from "@/components/ui/Toast";
import { MobileNavDrawer } from "@/components/nav/MobileNavDrawer";
import { AppFooter } from "@/components/nav/AppFooter";
import { DesktopNav, UserMenu } from "@/components/nav/DesktopNav";
import { roleLabel } from "@/lib/roleLabels";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

// Invoicing exists (lib/invoices.ts, the invoice schema, the pages under
// app/(app)/invoices and app/(print)/invoices) but is hidden from the nav —
// see FUTURE-IDEAS.md's "Tax invoicing" entry for why and how to re-enable.
// Customer history (app/(app)/customers/*) is hidden the same way — see
// FUTURE-IDEAS.md's "Customer history" entry. Customer records are still
// created/updated on every quotation save (lib/customers.ts); only the UI
// that shows that history is hidden.
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotations", label: "Quotations" },
];

const ADMIN_NAV_LINKS = [
  { href: "/rates", label: "Rate Master" },
  { href: "/settings", label: "Settings" },
  { href: "/users", label: "Users" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const actor = await resolveActor(session);
  const isAdmin = isAdminTier(actor);

  return (
    <ToastProvider>
      {/* Column layout so AppFooter's mt-auto pins it to the bottom of the
          viewport on short pages instead of floating mid-screen. */}
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <header className="border-b border-neutral-200 bg-[#0f3d2e]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 md:gap-8">
              <MobileNavDrawer
                navLinks={NAV_LINKS}
                adminNavLinks={ADMIN_NAV_LINKS}
                isAdmin={isAdmin}
                userName={session?.user?.name ?? ""}
                userRole={roleLabel(session?.user?.role)}
                signOutAction={signOutAction}
              />
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
                <Image
                  src="/logo-mark.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-7 w-7 shrink-0 rounded border border-[#c9a227]/60 md:h-8 md:w-8"
                />
                <span className="truncate text-base font-semibold text-[#c9a227] md:text-lg">
                  Royal Doors &amp; Windows
                </span>
              </Link>
              <DesktopNav navLinks={NAV_LINKS} adminNavLinks={ADMIN_NAV_LINKS} isAdmin={isAdmin} />
            </div>
            <UserMenu
              userName={session?.user?.name ?? ""}
              roleLabel={roleLabel(session?.user?.role)}
              signOutAction={signOutAction}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">{children}</main>
        <AppFooter companyName="Royal Doors & Windows" />
      </div>
    </ToastProvider>
  );
}
