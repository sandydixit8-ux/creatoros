import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { run, row, newId, nowIso } from "@/lib/db/db";
import { getPublicBioPage } from "@/lib/bio/page";
import { trackEvent, hashVisitorId } from "@/lib/analytics/engine";
import { getLimits } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const captureSchema = z.object({
  username: z.string().min(1).max(60),
  pageSlug: z.string().default(""),
  email: z.string().email(),
  name: z.string().max(120).default(""),
  consent: z.boolean(),
  source: z.string().max(60).default("bio"),
  utm_source: z.string().max(80).default(""),
  utm_campaign: z.string().max(80).default(""),
  visitorId: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("lead_capture", ip), 30);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = captureSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const { username, pageSlug, email, name, consent, source, utm_source, utm_campaign, visitorId } = parsed.data;
  if (!consent) return err.validation({ consent: "Consent is required to store contact data" });

  const bio = getPublicBioPage(username, pageSlug);
  if (!bio) return err.notFound();

  const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", bio.tenantId);
  const limits = getLimits(org?.plan ?? "free");
  const used = getUsage(bio.tenantId, "contacts");
  if (limits.contacts !== -1 && used >= limits.contacts) return err.conflict("This page has reached its contact limit");

  const existing = row<{ id: string }>("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", bio.tenantId, email.toLowerCase());
  const consentAt = nowIso();
  if (!existing) {
    const contactId = newId("con");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, consent_at, consent_source, source, page_id, utm_source, utm_campaign, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, 'bio_capture', ?, ?, ?, ?, '[]', ?, ?)",
      contactId,
      bio.tenantId,
      email.toLowerCase(),
      name,
      consentAt,
      source,
      bio.page.id,
      utm_source,
      utm_campaign,
      nowIso(),
      nowIso()
    );
    bumpUsage(bio.tenantId, "contacts");
  } else {
    run(
      "UPDATE contacts SET consent = 1, consent_at = ?, consent_source = 'bio_capture', source = ?, page_id = ?, utm_source = ?, utm_campaign = ?, updated_at = ? WHERE id = ?",
      consentAt,
      source,
      bio.page.id,
      utm_source,
      utm_campaign,
      nowIso(),
      existing.id
    );
  }

  trackEvent({
    tenantId: bio.tenantId,
    pageId: bio.page.id,
    eventType: "lead",
    visitorId: visitorId ? hashVisitorId(visitorId) : "",
    ref: "bio",
    utmSource: utm_source,
    utmCampaign: utm_campaign,
  });

  return ok({ message: "Subscribed! Check your inbox." });
}