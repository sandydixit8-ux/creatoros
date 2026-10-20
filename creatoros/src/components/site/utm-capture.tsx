"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { parseUtm, writeUtmCookie } from "@/lib/utm";

// Marketing-site surface: /app, /u and internal endpoints are not paid traffic.
const IGNORED_PREFIXES = ["/app", "/u", "/api", "/l"];

/**
 * Captures utm_* / gclid / fbclid on a landing page and stores them in a
 * first-party cookie, so a signup or purchase later in the visit still knows
 * which campaign brought the visitor. The cookie is read on signup (auth-form)
 * and forwarded with the request; nothing here identifies a person.
 *
 * useSearchParams needs a Suspense boundary when it is rendered from a server
 * component, and this runs inside the root layout, so the component is mounted
 * inside its own boundary in the layout via ThirdPartyTags' sibling slot.
 */
export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams.toString();
    if (!search) return;
    const data = parseUtm(`?${search}`);
    if (Object.keys(data).length === 0) return;

    const path = window.location.pathname;
    if (IGNORED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return;

    writeUtmCookie(data);
  }, [searchParams]);

  return null;
}
