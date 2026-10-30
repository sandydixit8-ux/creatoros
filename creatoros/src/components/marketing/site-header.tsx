"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

const DEFAULT_NAV = [
  { label: "Features", href: "/#features" },
  { label: "Product", href: "/#product" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function SiteHeader({ nav = DEFAULT_NAV }: { nav?: Array<{ label: string; href: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink" aria-label="CreatorOS home">
          <BrandMark />
          <span className="text-base tracking-tight">
            Creator<span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">OS</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link key={item.label} href={item.href} className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/auth/login" className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink">
            Sign in
          </Link>
          <Link href="/auth/register" className="btn-primary">
            Start for Free
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-nav-mobile"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="site-nav-mobile" className="border-t border-white/10 bg-night-900 px-4 pb-6 pt-3 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-ink-secondary transition-colors hover:bg-white/5 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-4">
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="btn-secondary justify-center"
              >
                Sign in
              </Link>
              <Link href="/auth/register" onClick={() => setOpen(false)} className="btn-primary justify-center">
                Start for Free
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}