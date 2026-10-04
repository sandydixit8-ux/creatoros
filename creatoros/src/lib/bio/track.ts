import { cookies } from "next/headers";

import { trackEvent, newVisitorId } from "@/lib/analytics/engine";
import { analyticsGranted, CONSENT_COOKIE_NAME } from "@/lib/consent-receipt";

import type { PublicBioPage } from "@/lib/bio/page";

/**
 * First-party server-side page-view tracking.
 * No third-party pixels; visitor id hashed and not stored long-term.
 *
 * Gated on the same signed consent receipt as the client beacon. This runs while
 * rendering a public page, so without the check it would record a view for every
 * visitor regardless of consent - the beacon gate alone did not cover it.
 */
export async function trackPublicView(bio: PublicBioPage): Promise<void> {
  try {
    const token = (await cookies()).get(CONSENT_COOKIE_NAME)?.value;
    if (!token) return;
    // analyticsGranted parses a cookie *header*, so the name has to be rebuilt
    // here; handing it the bare value silently fails verification.
    if (!analyticsGranted(`${CONSENT_COOKIE_NAME}=${token}`)) return;
    trackEvent({
      tenantId: bio.tenantId,
      pageId: bio.page.id,
      eventType: "page_view",
      visitorId: newVisitorId(),
      device: "server",
    });
  } catch {
    // tracking must never break the page render
  }
}

export function trackLinkClick(bio: PublicBioPage, url: string): void {
  try {
    trackEvent({
      tenantId: bio.tenantId,
      pageId: bio.page.id,
      eventType: "link_click",
      ref: url.slice(0, 500),
    });
  } catch {
    // non-fatal
  }
}