"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavLink {
  href: string;
  label: string;
}

/**
 * Desktop navigation. Two things the previous flat row of links didn't do:
 * show which page you're on, and separate day-to-day work (Dashboard,
 * Quotations) from admin tooling (Rate Master, Settings, Users) — five equal
 * peers read as clutter and gave the admin screens the same prominence as the
 * work everyone does every day.
 */
export function DesktopNav({
  navLinks,
  adminNavLinks,
  isAdmin,
}: {
  navLinks: NavLink[];
  adminNavLinks: NavLink[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    [
      "relative rounded px-2.5 py-1.5 text-sm transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f3d2e]",
      isActive(href)
        ? "font-semibold text-[#c9a227] after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#c9a227]"
        : "text-white/85 hover:bg-white/10 hover:text-white",
    ].join(" ");

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {navLinks.map((link) => (
        <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={linkClass(link.href)}>
          {link.label}
        </Link>
      ))}
      {isAdmin && (
        <>
          <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-white/20" />
          {adminNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </>
      )}
    </nav>
  );
}

/**
 * Avatar + dropdown replacing the old "Name (super_admin)" text and a bordered
 * Sign out box sitting permanently in the header.
 */
export function UserMenu({
  userName,
  roleLabel,
  signOutAction,
}: {
  userName: string;
  roleLabel: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f3d2e]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c9a227] text-xs font-bold text-[#0f3d2e]">
          {initials}
        </span>
        <span className="max-w-[10rem] truncate">{userName}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
            <p className="text-xs text-neutral-500">{roleLabel}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 01-2-2V7a2 2 0 012-2h6" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
