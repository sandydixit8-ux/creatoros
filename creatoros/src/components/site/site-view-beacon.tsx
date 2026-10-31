"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createViewGate } from "@/lib/site/view-gate";

// Mirrors the server-side filter in /api/site-view: the app/creator surface,
// short links and internal endpoints are not marketing traffic.
const IGNORED_PREFIXES = ["/app", "/u", "/api", "/l"];

// Anything that only a person does. A headless monitor loads the page and
// leaves; it does not scroll, tap or press a key.
const INTERACTION_EVENTS = ["scroll", "pointerdown", "keydown", "touchstart"] as const;

/**
 * Fires one anonymous page-view to /api/site-view per marketing-page navigation.
 *
 * The view is only counted after the visitor has stayed for a moment or
 * interacted (see `createViewGate`). Firing on load counted headless browsers as
 * visitors: on 2026-10-30 a monitoring service produced more than half of the
 * day's page views from nine Azure addresses with a normal desktop user agent.
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

    const send = () => {
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
    };

    const gate = createViewGate(send);
    const onInteraction = () => gate.trigger();
    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, onInteraction, { passive: true });
    }

    return () => {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, onInteraction);
      }
      gate.dispose();
    };
  }, [pathname]);

  return null;
}
