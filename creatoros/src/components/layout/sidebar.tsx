"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { APP_NAV, appNavActive } from "@/components/layout/app-nav";
import { BrandMark } from "@/components/brand/brand-mark";

export function Sidebar({ orgName, plan, isAdmin }: { orgName: string; plan: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin ? [...APP_NAV, { href: "/app/admin", label: "Admin", icon: ShieldCheck }] : APP_NAV;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-navy-100 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-navy-100 px-5 font-semibold text-navy-900">
        <BrandMark />
        <span>Creator<span className="text-brand-600">OS</span></span>
      </div>
      <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = appNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
    </aside>
  );
}