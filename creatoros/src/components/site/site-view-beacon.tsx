"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Mirrors the server-side filter in /api/site-view: the app/creator surface,
// short links and internal endpoints are not marketing traffic.
const IGNORED_PREFIXES = ["/app", "/u", "/api", "/l"];

/**
 * Fires one anonymous page-view to /api/site-view per marketing-page navigation.
 *
 * Client-only and dependency-free: no cookie, no stored id. The server derives a
 * daily-rotating salted visitor hash, so this cannot identify anyone. Skipped
 * inside the app so a signed-in user browsing /app does not generate noise.
 */
export function SiteViewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (IGNORED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    const body = JSON.stringify({ path: pathname, ref: document.referrer || "" });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/site-view", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/site-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      // A dropped beacon must never surface to the visitor.
    }
  }, [pathname]);

  return null;
}
