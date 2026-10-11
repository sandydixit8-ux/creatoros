"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/notifications");
        const json = await res.json();
        if (json.ok && alive) setUnread(json.data.unread);
      } catch {
        // ignore transient fetch errors
      }
    };
    const onVisibility = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <Link
      href="/app/notifications"
      aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-navy-500 ring-1 ring-navy-200 transition-colors hover:bg-navy-50 hover:text-navy-900"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}