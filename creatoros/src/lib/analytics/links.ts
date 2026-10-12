import { all, run, row, newId, nowIso } from "@/lib/db/db";
import { isHttpUrl } from "@/lib/url-safety";
import { trackEvent } from "@/lib/analytics/engine";
import type { Range } from "@/lib/analytics/reporting";

/**
 * Campaign + tracked-link registry.
 *
 * A creator groups links under a campaign (a UTM set) and shares the short
 * `/l/<slug>` URL. Hitting that URL records a consent-gated `link_click` in the
 * same `analytics_events` table the rest of the dashboard reads, then redirects
 * to the destination with the campaign's UTM parameters appended. Attribution
 * therefore needs no second event table: the click is an ordinary link_click
 * carrying `properties.linkId`, and the UTM columns are already populated.
 *
 * The slug is globally unique because the redirect resolves from the slug alone.
 * A random suffix is appended to auto-generated slugs so a popular label cannot
 * be squatted or guessed, while an explicitly chosen slug is honoured as long as
 * it is free and not a reserved application route.
 */

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedLink {
  id: string;
  tenantId: string;
  campaignId: string | null;
  label: string;
  slug: string;
  destination: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedLinkWithCampaign extends TrackedLink {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export type WriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "invalid" | "conflict" | "not_found"; message: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED = new Set([
  "api", "app", "auth", "l", "u", "store", "login", "logout", "signup", "signin",
  "register", "pricing", "admin", "www", "assets", "static", "_next", "favicon",
  "robots", "sitemap", "manifest", "health", "webhooks",
]);

function mapCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    name: String(r.name ?? ""),
    utmSource: String(r.utm_source ?? ""),
    utmMedium: String(r.utm_medium ?? ""),
    utmCampaign: String(r.utm_campaign ?? ""),
    active: Number(r.active ?? 0) === 1,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

function mapLink(r: Record<string, unknown>): TrackedLink {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    campaignId: r.campaign_id == null ? null : String(r.campaign_id),
    label: String(r.label ?? ""),
    slug: String(r.slug ?? ""),
    destination: String(r.destination ?? ""),
    active: Number(r.active ?? 0) === 1,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const CAMPAIGN_COLS =
  "id, tenant_id, name, utm_source, utm_medium, utm_campaign, active, created_at, updated_at";
const LINK_COLS =
  "id, tenant_id, campaign_id, label, slug, destination, active, created_at, updated_at";

export function listCampaigns(tenantId: string): Campaign[] {
  return all<Record<string, unknown>>(
    `SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC`,
    tenantId
  ).map(mapCampaign);
}

export function createCampaign(
  tenantId: string,
  input: { name: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; active?: boolean }
): WriteResult<Campaign> {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, code: "invalid", message: "Name is required" };
  const dupe = row<{ id: string }>("SELECT id FROM campaigns WHERE tenant_id = ? AND name = ?", tenantId, name);
  if (dupe) return { ok: false, code: "conflict", message: "A campaign with that name already exists" };

  const id = newId("cmp");
  const now = nowIso();
  const utmCampaign = (input.utmCampaign?.trim() || name).slice(0, 100);
  run(
    `INSERT INTO campaigns (id, tenant_id, name, utm_source, utm_medium, utm_campaign, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    name,
    (input.utmSource ?? "").trim().slice(0, 100),
    (input.utmMedium ?? "").trim().slice(0, 100),
    utmCampaign,
    input.active === false ? 0 : 1,
    now,
    now
  );
  return { ok: true, data: mapCampaign(row<Record<string, unknown>>(`SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE id = ?`, id)!) };
}

export function updateCampaign(
  tenantId: string,
  id: string,
  patch: { name?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; active?: boolean }
): WriteResult<Campaign> {
  const existing = row<Record<string, unknown>>(`SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE id = ? AND tenant_id = ?`, id, tenantId);
  if (!existing) return { ok: false, code: "not_found", message: "Campaign not found" };

  const current = mapCampaign(existing);
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 80);
    if (!name) return { ok: false, code: "invalid", message: "Name is required" };
    const dupe = row<{ id: string }>("SELECT id FROM campaigns WHERE tenant_id = ? AND name = ? AND id != ?", tenantId, name, id);
    if (dupe) return { ok: false, code: "conflict", message: "A campaign with that name already exists" };
    sets.push("name = ?");
    params.push(name);
  }
  if (patch.utmSource !== undefined) {
    sets.push("utm_source = ?");
    params.push(patch.utmSource.trim().slice(0, 100));
  }
  if (patch.utmMedium !== undefined) {
    sets.push("utm_medium = ?");
    params.push(patch.utmMedium.trim().slice(0, 100));
  }
  if (patch.utmCampaign !== undefined) {
    sets.push("utm_campaign = ?");
    params.push(patch.utmCampaign.trim().slice(0, 100));
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    params.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return { ok: true, data: current };

  sets.push("updated_at = ?");
  params.push(nowIso());
  run(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, ...params, id, tenantId);
  return { ok: true, data: mapCampaign(row<Record<string, unknown>>(`SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE id = ?`, id)!) };
}

export function deleteCampaign(tenantId: string, id: string): boolean {
  return run("DELETE FROM campaigns WHERE id = ? AND tenant_id = ?", id, tenantId).changes > 0;
}

export function listTrackedLinks(tenantId: string): TrackedLink[] {
  return all<Record<string, unknown>>(
    `SELECT ${LINK_COLS} FROM tracked_links WHERE tenant_id = ? ORDER BY created_at DESC`,
    tenantId
  ).map(mapLink);
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

export function createTrackedLink(
  tenantId: string,
  input: { label?: string; slug?: string; destination: string; campaignId?: string | null; active?: boolean }
): WriteResult<TrackedLink> {
  if (!isHttpUrl(input.destination)) {
    return { ok: false, code: "invalid", message: "Destination must be a valid http(s) URL" };
  }

  if (input.campaignId) {
    const campaign = row<{ id: string }>("SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?", input.campaignId, tenantId);
    if (!campaign) return { ok: false, code: "invalid", message: "Unknown campaign" };
  }

  let slug: string;
  if (input.slug !== undefined && input.slug.trim() !== "") {
    slug = normalizeSlug(input.slug);
    if (!SLUG_RE.test(slug)) return { ok: false, code: "invalid", message: "Slug must be 2-64 letters, numbers or dashes" };
    if (RESERVED.has(slug)) return { ok: false, code: "invalid", message: "That slug is reserved" };
    if (row<{ id: string }>("SELECT id FROM tracked_links WHERE slug = ?", slug)) {
      return { ok: false, code: "conflict", message: "That slug is already taken" };
    }
  } else {
    const base = normalizeSlug(input.label || "") || "link";
    slug = `${base}-${randomSuffix()}`;
    let guard = 0;
    while (row<{ id: string }>("SELECT id FROM tracked_links WHERE slug = ?", slug) && guard++ < 5) {
      slug = `${base}-${randomSuffix()}`;
    }
  }

  const id = newId("lnk");
  const now = nowIso();
  run(
    `INSERT INTO tracked_links (id, tenant_id, campaign_id, label, slug, destination, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    input.campaignId ?? null,
    input.label?.trim().slice(0, 120) ?? "",
    slug,
    input.destination.trim(),
    input.active === false ? 0 : 1,
    now,
    now
  );
  return { ok: true, data: mapLink(row<Record<string, unknown>>(`SELECT ${LINK_COLS} FROM tracked_links WHERE id = ?`, id)!) };
}

export function updateTrackedLink(
  tenantId: string,
  id: string,
  patch: { label?: string; slug?: string; destination?: string; campaignId?: string | null; active?: boolean }
): WriteResult<TrackedLink> {
  const existing = row<Record<string, unknown>>(`SELECT ${LINK_COLS} FROM tracked_links WHERE id = ? AND tenant_id = ?`, id, tenantId);
  if (!existing) return { ok: false, code: "not_found", message: "Link not found" };

  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.label !== undefined) {
    sets.push("label = ?");
    params.push(patch.label.trim().slice(0, 120));
  }
  if (patch.destination !== undefined) {
    if (!isHttpUrl(patch.destination)) return { ok: false, code: "invalid", message: "Destination must be a valid http(s) URL" };
    sets.push("destination = ?");
    params.push(patch.destination.trim());
  }
  if (patch.campaignId !== undefined) {
    if (patch.campaignId) {
      const c = row<{ id: string }>("SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?", patch.campaignId, tenantId);
      if (!c) return { ok: false, code: "invalid", message: "Unknown campaign" };
    }
    sets.push("campaign_id = ?");
    params.push(patch.campaignId ?? null);
  }
  if (patch.slug !== undefined) {
    const slug = normalizeSlug(patch.slug);
    if (!SLUG_RE.test(slug)) return { ok: false, code: "invalid", message: "Slug must be 2-64 letters, numbers or dashes" };
    if (RESERVED.has(slug)) return { ok: false, code: "invalid", message: "That slug is reserved" };
    const dupe = row<{ id: string }>("SELECT id FROM tracked_links WHERE slug = ? AND id != ?", slug, id);
    if (dupe) return { ok: false, code: "conflict", message: "That slug is already taken" };
    sets.push("slug = ?");
    params.push(slug);
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    params.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return { ok: true, data: mapLink(existing) };

  sets.push("updated_at = ?");
  params.push(nowIso());
  run(`UPDATE tracked_links SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, ...params, id, tenantId);
  return { ok: true, data: mapLink(row<Record<string, unknown>>(`SELECT ${LINK_COLS} FROM tracked_links WHERE id = ?`, id)!) };
}

export function deleteTrackedLink(tenantId: string, id: string): boolean {
  return run("DELETE FROM tracked_links WHERE id = ? AND tenant_id = ?", id, tenantId).changes > 0;
}

/** Resolve a public short link, joining its campaign's UTM fields (if any). */
export function resolveTrackedLink(slug: string): TrackedLinkWithCampaign | null {
  const r = row<Record<string, unknown>>(
    `SELECT l.${LINK_COLS.split(", ").join(", l.")},
            COALESCE(c.utm_source, '') AS utm_source,
            COALESCE(c.utm_medium, '') AS utm_medium,
            COALESCE(c.utm_campaign, '') AS utm_campaign
     FROM tracked_links l
     LEFT JOIN campaigns c ON c.id = l.campaign_id
     WHERE l.slug = ?`,
    slug
  );
  if (!r) return null;
  const link = mapLink(r);
  return {
    ...link,
    utmSource: String(r.utm_source ?? ""),
    utmMedium: String(r.utm_medium ?? ""),
    utmCampaign: String(r.utm_campaign ?? ""),
  };
}

/**
 * Record a click on a tracked link. Callers must have already established that
 * the visitor consented (see `/l/[slug]`), matching the `/api/track` gate.
 */
export function recordTrackedLinkClick(
  link: TrackedLinkWithCampaign,
  ctx: { pageId?: string; visitorId?: string; sessionId?: string; device?: string; country?: string; ref?: string }
): void {
  trackEvent({
    tenantId: link.tenantId,
    pageId: ctx.pageId,
    eventType: "link_click",
    eventName: "tracked_link",
    visitorId: ctx.visitorId,
    sessionId: ctx.sessionId,
    ref: link.destination,
    utmSource: link.utmSource,
    utmCampaign: link.utmCampaign,
    device: ctx.device,
    country: ctx.country,
    properties: { linkId: link.id, slug: link.slug },
  });
}

/** Append the campaign's UTM parameters to the destination, without clobbering
 *  values the destination already carries, and tag the click for attribution. */
export function destinationWithAttribution(link: TrackedLinkWithCampaign): string {
  let url: URL;
  try {
    url = new URL(link.destination);
  } catch {
    return link.destination;
  }
  const setIfAbsent = (key: string, value: string) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  setIfAbsent("utm_source", link.utmSource);
  setIfAbsent("utm_medium", link.utmMedium);
  setIfAbsent("utm_campaign", link.utmCampaign);
  if (!url.searchParams.has("crl")) url.searchParams.set("crl", link.id);
  return url.toString();
}

export interface LinkPerformance {
  linkId: string;
  slug: string;
  label: string;
  destination: string;
  clicks: number;
  visitors: number;
}

/** Per-link click totals for a range, from the link_click events keyed by
 *  `properties.linkId`. Links with no clicks still appear (LEFT JOIN). */
export function linkPerformance(tenantId: string, range: Range): LinkPerformance[] {
  return all<Record<string, unknown>>(
    `SELECT l.id AS linkId, l.slug AS slug, l.label AS label, l.destination AS destination,
            COUNT(e.id) AS clicks,
            COUNT(DISTINCT CASE WHEN e.visitor_id != '' THEN e.visitor_id END) AS visitors
     FROM tracked_links l
     LEFT JOIN analytics_events e
       ON e.tenant_id = l.tenant_id
      AND e.event_type = 'link_click'
      AND json_extract(e.properties, '$.linkId') = l.id
      AND e.created_at >= ? AND e.created_at < ?
     WHERE l.tenant_id = ?
     GROUP BY l.id
     ORDER BY clicks DESC, l.created_at DESC`,
    range.since,
    range.until,
    tenantId
  ).map((r) => ({
    linkId: String(r.linkId),
    slug: String(r.slug ?? ""),
    label: String(r.label ?? ""),
    destination: String(r.destination ?? ""),
    clicks: Number(r.clicks ?? 0),
    visitors: Number(r.visitors ?? 0),
  }));
}
