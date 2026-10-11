"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, X } from "lucide-react";
import { APP_NAV, appNavActive } from "@/components/layout/app-nav";

export function AppMobileNav({
  orgName,
  plan,
  isAdmin,
}: {
  orgName: string;
  plan: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const nav = isAdmin ? [...APP_NAV, { href: "/app/admin", label: "Admin", icon: ShieldCheck }] : APP_NAV;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="app-mobile-nav"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-navy-500 ring-1 ring-navy-200 transition-colors hover:bg-navy-50 hover:text-navy-900 lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          id="app-mobile-nav"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard menu"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-navy-950/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-navy-100 px-4">
              <Link href="/app" onClick={() => setOpen(false)} className="flex items-center gap-2 font-semibold text-navy-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">C</span>
                <span>Creator<span className="text-brand-600">OS</span></span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-navy-500 ring-1 ring-navy-200 hover:bg-navy-50 hover:text-navy-900"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto p-3">
              {nav.map((item) => {
                const active = appNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-brand-50 text-brand-700" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-navy-100 p-4">
              <div className="rounded-xl bg-navy-900 p-3 text-white">
                <div className="truncate text-sm font-medium">{orgName}</div>
                <div className="mt-0.5 text-xs capitalize text-white/70">{plan} plan</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}