import { all, run, newId, nowIso, type SQLParam } from "@/lib/db/db";
import { createHash, randomBytes } from "node:crypto";

const VISITOR_SALT = process.env.VISITOR_SALT || "creatoros-visitor";

export type EventType =
  | "page_view"
  | "lead"
  | "booking"
  | "link_click"
  | "checkout_started"
  | "purchase"
  | "course_started"
  | "course_completed";

export interface TrackEventInput {
  tenantId: string;
  pageId?: string;
  eventType: EventType;
  visitorId?: string;
  ref?: string;
  utmSource?: string;
  utmCampaign?: string;
  device?: string;
  country?: string;
}

export function trackEvent(input: TrackEventInput): void {
  run(
    "INSERT INTO analytics_events (id, tenant_id, page_id, event_type, visitor_id, ref, utm_source, utm_campaign, device, country, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId("evt"),
    input.tenantId,
    input.pageId ?? null,
    input.eventType,
    input.visitorId ?? "",
    input.ref ?? "",
    input.utmSource ?? "",
    input.utmCampaign ?? "",
    input.device ?? "",
    input.country ?? "",
    nowIso()
  );
}

/** Generate a privacy-safe visitor id from raw identifier + tenant secret. */
export function hashVisitorId(raw: string): string {
  const salted = `${raw}:${VISITOR_SALT}`;
  return createHash("sha256").update(salted).digest("hex").slice(0, 32);
}

export function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

export interface AnalyticsSummary {
  visitors: number;
  pageViews: number;
  leads: number;
  bookings: number;
  conversions: number;
  conversionRate: number;
  linkClicks: number;
}

/**
 * There is deliberately no `revenueCents` here.
 *
 * This function used to return bookings plus orders as one number, and two call
 * sites printed it behind a hardcoded `$`. That added rupee amounts to dollar
 * amounts and labelled the result "dollars" - the same fabrication as the
 * `RATE = 84` bug, one layer over. Removing the field is the point: a blended
 * total is not a value that can be rendered correctly, so it should not be
 * available to render. Callers that need revenue use `revenueSnapshot()`, which
 * returns per-currency amounts.
 */

export function summary(tenantId: string, days = 30): AnalyticsSummary {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const q = (sql: string, ...p: SQLParam[]): number => Number(all<{ c: number | string }>(sql, ...p)[0]?.c ?? 0);

  const visitors = Number(q("SELECT COUNT(DISTINCT visitor_id) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND visitor_id != ''", tenantId, since));
  const pageViews = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'page_view'", tenantId, since));
  const leads = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'lead'", tenantId, since));
  const bookingsCount = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'booking'", tenantId, since));
  const linkClicks = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'link_click'", tenantId, since));

  return {
    visitors,
    pageViews,
    leads,
    bookings: bookingsCount,
    conversions: leads + bookingsCount,
    conversionRate: pageViews > 0 ? Math.round(((leads + bookingsCount) / pageViews) * 1000) / 10 : 0,
    linkClicks,
  };
}

export interface SeriesPoint {
  date: string;
  views: number;
  leads: number;
}

export function timeSeries(tenantId: string, days = 30): SeriesPoint[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = all<{ day: string; event_type: string; c: number }>(
    `SELECT substr(created_at, 1, 10) AS day, event_type, COUNT(*) AS c
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY substr(created_at, 1, 10), event_type
     ORDER BY day ASC`,
    tenantId,
    since
  );
  const map = new Map<string, SeriesPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    map.set(d, { date: d, views: 0, leads: 0 });
  }
  for (const r of rows) {
    const p = map.get(r.day);
    if (!p) continue;
    if (r.event_type === "page_view") p.views = Number(r.c);
    if (r.event_type === "lead") p.leads = Number(r.c);
  }
  return [...map.values()];
}

export function breakdownBy(tenantId: string, column: "ref" | "utm_source" | "device" | "country", days = 30): { label: string; count: number }[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const allowed: Record<string, { col: string; fallback: string }> = {
    ref: { col: "ref", fallback: "direct" },
    utm_source: { col: "utm_source", fallback: "direct" },
    device: { col: "device", fallback: "unknown" },
    country: { col: "country", fallback: "Unknown" },
  };
  const spec = allowed[column];
  if (!spec) return [];
  return all<{ label: string; count: number }>(
    `SELECT COALESCE(NULLIF(TRIM(${spec.col}), ''), '${spec.fallback}') AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY label ORDER BY count DESC LIMIT 10`,
    tenantId,
    since
  );
}

/** Page views grouped by bio page, most-viewed first. */
export function pageBreakdown(tenantId: string, days = 30): { label: string; count: number }[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return all<{ label: string; count: number }>(
    `SELECT COALESCE(NULLIF(TRIM(p.title), ''), NULLIF(TRIM(p.slug), ''), 'Home') AS label,
            COUNT(*) AS count
     FROM analytics_events e
     JOIN bio_pages p ON p.id = e.page_id
     WHERE e.tenant_id = ? AND e.created_at >= ? AND e.event_type = 'page_view'
     GROUP BY e.page_id
     ORDER BY count DESC LIMIT 10`,
    tenantId,
    since
  );
}