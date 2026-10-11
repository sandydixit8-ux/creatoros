"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";

export function TopNav({
  userName,
  orgName,
  plan,
  isAdmin,
}: {
  userName: string;
  orgName: string;
  plan: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-navy-100 bg-white/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <AppMobileNav orgName={orgName} plan={plan} isAdmin={isAdmin} />
        <div className="truncate text-sm font-medium text-navy-500">
          Welcome back, <span className="font-semibold text-navy-900">{userName}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <NotificationBell />
        <button type="button" onClick={logout} className="btn-secondary !px-3 !py-1.5 text-xs">
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>
    </header>
  );
}