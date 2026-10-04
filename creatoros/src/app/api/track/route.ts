import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp, userAgentInfo, clientCountry } from "@/lib/http";
import { getPublicBioPage } from "@/lib/bio/page";
import { trackEvent, hashVisitorId, newVisitorId } from "@/lib/analytics/engine";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { row } from "@/lib/db/db";
import { getLimits } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";

const trackSchema = z.object({
  username: z.string().min(1).max(60),
  pageSlug: z.string().default(""),
  eventType: z.enum(["page_view", "link_click"]).default("page_view"),
  ref: z.string().max(500).default(""),
  utm_source: z.string().max(100).default(""),
  utm_campaign: z.string().max(100).default(""),
  visitorId: z.string().default(""),
  /**
   * Consent signal (D-5). The Cookie Policy promises consent before any
   * non-essential storage, so this endpoint refuses to record anything without
   * it. Gating in the browser alone would be theatre - this endpoint is
   * directly callable, so the check has to live here.
   */
  consent: z.object({ analytics: z.boolean() }).default({ analytics: false }),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  // No analytics consent, no analytics. Nothing below this line may read the
  // caller's IP, device or country into storage.
  if (!parsed.data.consent.analytics) {
    return ok({ tracked: false, consent: false });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("track", ip), 120);
  if (!rl.allowed) return err.rateLimited();

  const bio = getPublicBioPage(parsed.data.username, parsed.data.pageSlug);
  if (!bio) return err.notFound();

  const { device, ref } = userAgentInfo(req);
  const visitorId = parsed.data.visitorId ? hashVisitorId(parsed.data.visitorId) : newVisitorId();

  // Soft-enforce the monthly views quota: the page still renders, tracking just
  // stops counting once the plan limit is exceeded.
  if (parsed.data.eventType === "page_view") {
    const plan = (row("SELECT plan FROM organizations WHERE id = ?", bio.tenantId) as { plan?: string } | undefined)?.plan ?? "free";
    const limits = getLimits(plan);
    const usage = getUsage(bio.tenantId, "views");
    if (limits.viewsPerMonth !== -1 && usage >= limits.viewsPerMonth) {
      return ok({ visitorId: parsed.data.visitorId ? visitorId : undefined, tracked: false, quota: true });
    }
    bumpUsage(bio.tenantId, "views");
  }

  trackEvent({
    tenantId: bio.tenantId,
    pageId: bio.page.id,
    eventType: parsed.data.eventType,
    visitorId: parsed.data.visitorId ? visitorId : "",
    ref: parsed.data.ref || ref,
    utmSource: parsed.data.utm_source,
    utmCampaign: parsed.data.utm_campaign,
    device,
    country: clientCountry(req),
  });

  return ok({ visitorId: parsed.data.visitorId ? visitorId : undefined, tracked: true });
}