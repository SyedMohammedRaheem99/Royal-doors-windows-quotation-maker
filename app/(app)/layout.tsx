import Link from "next/link";
import { auth, signOut } from "@/auth";
import { ToastProvider } from "@/components/ui/Toast";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotations", label: "Quotations" },
  { href: "/customers", label: "Customers" },
];

const ADMIN_NAV_LINKS = [
  { href: "/rates", label: "Rate Master" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-neutral-200 bg-[#0f3d2e]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-8">
              <span className="text-lg font-semibold text-[#c9a227]">Royal Doors &amp; Windows</span>
              <nav className="flex gap-5 text-sm text-white/90">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="hover:text-[#c9a227]">
                    {link.label}
                  </Link>
                ))}
                {isAdmin &&
                  ADMIN_NAV_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} className="hover:text-[#c9a227]">
                      {link.label}
                    </Link>
                  ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <span>
                {session?.user?.name} <span className="text-white/50">({session?.user?.role})</span>
              </span>
              <form action={signOutAction}>
                <button type="submit" className="rounded border border-white/30 px-3 py-1 hover:bg-white/10">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
