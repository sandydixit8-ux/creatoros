import { NextRequest, NextResponse } from "next/server";
import { resolveTrackedLink, recordTrackedLinkClick, destinationWithAttribution } from "@/lib/analytics/links";
import { analyticsGranted } from "@/lib/consent-receipt";
import { getClientIp, userAgentInfo, clientCountry, isLikelyBot } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Public short-link redirect.
 *
 * Always redirects; recording is best-effort and, per D-5, only happens when the
 * caller already holds a signed consent receipt (the same rule `/api/track`
 * enforces) and is not a crawler. Because the visitor arrives on a bare short
 * URL there is no bio-page visitor id to attach, so the click is recorded with
 * country/device/referrer but no visitor identity - it counts toward click
 * totals, not unique-visitor figures.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = resolveTrackedLink(slug);

  if (!link || !link.active) {
    // A mistyped or retired short link degrades to the home page rather than a
    // bare error, and never leaks whether a slug exists but is merely inactive.
    return NextResponse.redirect(`${SITE_URL}/`, 302);
  }

  try {
    if (analyticsGranted(req.headers.get("cookie")) && !isLikelyBot(req)) {
      const rl = rateLimit(rateKey("tracked-link", getClientIp(req)), 120);
      if (rl.allowed) {
        const { device, ref } = userAgentInfo(req);
        recordTrackedLinkClick(link, {
          device,
          country: clientCountry(req),
          ref,
        });
      }
    }
  } catch {
    // Telemetry is best-effort; a failure here must never block the redirect.
  }

  return NextResponse.redirect(destinationWithAttribution(link), 302);
}
