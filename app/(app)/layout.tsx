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
// see docs/archive/FUTURE-IDEAS.md's "Tax invoicing" entry for why and how to re-enable.
// Customer history (app/(app)/customers/*) is hidden the same way — see
// docs/archive/FUTURE-IDEAS.md's "Customer history" entry. Customer records are still
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
        <header className="border-b-2 border-[#c9a227]/70 bg-[#0f3d2e]">
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
              {/* Matches the printed letterhead: ROYAL UPVC as the name a
                  customer recognises, with the trade line beneath it, set in the
                  same serif. The app previously said "Royal Doors & Windows" in
                  flat sans, so the software and the document it produces did not
                  read as the same brand. */}
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
                <Image
                  src="/logo-mark.png"
                  alt=""
                  width={36}
                  height={36}
                  className="h-8 w-8 shrink-0 rounded-sm border border-[#c9a227]/60 md:h-9 md:w-9"
                />
                <span className="min-w-0 leading-none">
                  <span className="block truncate font-serif text-[15px] font-bold tracking-wide text-[#c9a227] md:text-[17px]">
                    ROYAL UPVC
                  </span>
                  <span className="mt-[3px] block truncate text-[8px] font-medium tracking-[0.22em] text-[#a9c2b1] md:text-[9px]">
                    DOORS AND WINDOWS
                  </span>
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
        <AppFooter companyName="Royal Doors and Windows" />
      </div>
    </ToastProvider>
  );
}
