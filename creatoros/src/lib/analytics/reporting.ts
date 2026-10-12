import { all } from "@/lib/db/db";

/**
 * Reporting layer for the traffic / click / country dashboard.
 *
 * Everything here reads the one consent-gated `analytics_events` table and only
 * returns tenant-scoped aggregates. Country names and referrer hosts are derived
 * for display; no raw IP, raw visitor id or raw session id leaves the database -
 * those columns already hold salted hashes.
 */

export type RangeKey = "today" | "7d" | "30d" | "90d";
export const RANGE_KEYS: RangeKey[] = ["today", "7d", "30d", "90d"];
export type Granularity = "hour" | "day";

export interface Range {
  key: RangeKey;
  since: string;
  until: string;
  granularity: Granularity;
}

const DAY_MS = 86_400_000;
const round1 = (n: number): number => Math.round(n * 10) / 10;
const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function presetRange(key: RangeKey): Range {
  const now = new Date();
  const until = now.toISOString();
  if (key === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { key, since: start.toISOString(), until, granularity: "hour" };
  }
  const days = key === "7d" ? 7 : key === "90d" ? 90 : 30;
  return { key, since: new Date(now.getTime() - days * DAY_MS).toISOString(), until, granularity: "day" };
}

export function resolveRange(key?: string | null): Range {
  return presetRange((RANGE_KEYS as string[]).includes(key ?? "") ? (key as RangeKey) : "30d");
}

/** The equal-length window immediately before `range`, for period comparison. */
export function previousRange(range: Range): Range {
  const sinceMs = Date.parse(range.since);
  const untilMs = Date.parse(range.until);
  const span = Math.max(1, untilMs - sinceMs);
  return { ...range, since: new Date(sinceMs - span).toISOString(), until: range.since };
}

export interface OverviewMetrics {
  visitors: number;
  pageViews: number;
  sessions: number;
  clicks: number;
  leads: number;
  bookings: number;
  purchases: number;
  checkouts: number;
  conversions: number;
  conversionRate: number;
  ctr: number;
  bounceRate: number;
  avgEngagementMs: number;
}

export interface MetricPair {
  value: number;
  previous: number;
  /** Percentage change vs the previous period; null when there is no baseline. */
  changePct: number | null;
}

export interface Overview {
  current: OverviewMetrics;
  previous: OverviewMetrics;
}

function metricsFor(tenantId: string, range: Range): OverviewMetrics {
  const r = all<Record<string, unknown>>(
    `SELECT
       COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
       COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews,
       COUNT(DISTINCT CASE WHEN session_id != '' THEN session_id END) AS sessions,
       COALESCE(SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END), 0) AS clicks,
       COALESCE(SUM(CASE WHEN event_type = 'lead' THEN 1 ELSE 0 END), 0) AS leads,
       COALESCE(SUM(CASE WHEN event_type = 'booking' THEN 1 ELSE 0 END), 0) AS bookings,
       COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END), 0) AS purchases,
       COALESCE(SUM(CASE WHEN event_type = 'checkout_started' THEN 1 ELSE 0 END), 0) AS checkouts,
       COALESCE(SUM(engagement_ms), 0) AS engagementMs
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
    tenantId,
    range.since,
    range.until
  )[0];

  const visitors = num(r?.visitors);
  const pageViews = num(r?.pageViews);
  const sessions = num(r?.sessions);
  const clicks = num(r?.clicks);
  const leads = num(r?.leads);
  const bookings = num(r?.bookings);
  const purchases = num(r?.purchases);
  const checkouts = num(r?.checkouts);
  const engagementMs = num(r?.engagementMs);

  const conversions = leads + bookings + purchases;
  const denom = sessions > 0 ? sessions : visitors;

  return {
    visitors,
    pageViews,
    sessions,
    clicks,
    leads,
    bookings,
    purchases,
    checkouts,
    conversions,
    conversionRate: denom > 0 ? round1((conversions / denom) * 100) : 0,
    ctr: pageViews > 0 ? round1((clicks / pageViews) * 100) : 0,
    bounceRate: bounceRate(tenantId, range),
    avgEngagementMs: sessions > 0 ? Math.round(engagementMs / sessions) : 0,
  };
}

/** Sessions that viewed only a single page, as a percentage of all sessions. */
function bounceRate(tenantId: string, range: Range): number {
  const r = all<Record<string, unknown>>(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(CASE WHEN pv <= 1 THEN 1 ELSE 0 END), 0) AS bounced
     FROM (
       SELECT session_id, SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS pv
       FROM analytics_events
       WHERE tenant_id = ? AND session_id != '' AND created_at >= ? AND created_at < ?
       GROUP BY session_id
     )`,
    tenantId,
    range.since,
    range.until
  )[0];
  const sessions = num(r?.sessions);
  return sessions > 0 ? round1((num(r?.bounced) / sessions) * 100) : 0;
}

export function overview(tenantId: string, range: Range): Overview {
  return {
    current: metricsFor(tenantId, range),
    previous: metricsFor(tenantId, previousRange(range)),
  };
}

export function pair(value: number, previous: number): MetricPair {
  let changePct: number | null = null;
  if (previous > 0) changePct = round1(((value - previous) / previous) * 100);
  return { value, previous, changePct };
}

export interface CountryRow {
  country: string;
  name: string;
  visitors: number;
  pageViews: number;
  leads: number;
  clicks: number;
  share: number;
}

export function countryTable(tenantId: string, range: Range, limit = 50): CountryRow[] {
  // Only events that recorded a country (from the CDN header) are attributed;
  // an event with no country (e.g. an engagement sample) would otherwise create
  // a large, meaningless "unknown" bucket.
  const rows = all<Record<string, unknown>>(
    `SELECT country,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews,
            COALESCE(SUM(CASE WHEN event_type = 'lead' THEN 1 ELSE 0 END), 0) AS leads,
            COALESCE(SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END), 0) AS clicks
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND country != ''
     GROUP BY country
     ORDER BY visitors DESC, pageViews DESC
     LIMIT ?`,
    tenantId,
    range.since,
    range.until,
    limit
  );
  // Share is of all distinct visitors in the range, not the sum of the rows, so
  // a visitor seen in two countries cannot inflate the total.
  const overall = num(
    all<Record<string, unknown>>(
      `SELECT COUNT(DISTINCT visitor_id) AS c FROM analytics_events
       WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND visitor_id != ''`,
      tenantId,
      range.since,
      range.until
    )[0]?.c
  );
  return rows.map((r) => {
    const country = String(r.country ?? "");
    return {
      country,
      name: countryName(country),
      visitors: num(r.visitors),
      pageViews: num(r.pageViews),
      leads: num(r.leads),
      clicks: num(r.clicks),
      share: overall > 0 ? round1((num(r.visitors) / overall) * 100) : 0,
    };
  });
}

export interface DeviceRow {
  device: string;
  visitors: number;
  pageViews: number;
  share: number;
}

export function deviceTable(tenantId: string, range: Range): DeviceRow[] {
  const rows = all<Record<string, unknown>>(
    `SELECT COALESCE(NULLIF(TRIM(device), ''), 'unknown') AS device,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY device ORDER BY visitors DESC LIMIT 12`,
    tenantId,
    range.since,
    range.until
  );
  const total = rows.reduce((s, r) => s + num(r.visitors), 0);
  return rows.map((r) => ({
    device: String(r.device ?? "unknown"),
    visitors: num(r.visitors),
    pageViews: num(r.pageViews),
    share: total > 0 ? round1((num(r.visitors) / total) * 100) : 0,
  }));
}

export type SourceColumn = "ref" | "utm_source" | "utm_campaign";
const SOURCE_COLUMNS: Record<string, string> = { ref: "ref", utm_source: "utm_source", utm_campaign: "utm_campaign" };

export interface SourceRow {
  source: string;
  visitors: number;
  pageViews: number;
  conversions: number;
  share: number;
}

export function sourceTable(tenantId: string, range: Range, column: "ref" | "utm_source" | "utm_campaign"): SourceRow[] {
  const col = SOURCE_COLUMNS[column];
  if (!col) return [];
  const rows = all<Record<string, unknown>>(
    `SELECT "${col}" AS raw,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews,
            COALESCE(SUM(CASE WHEN event_type IN ('lead','booking','purchase') THEN 1 ELSE 0 END), 0) AS conversions
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY raw`,
    tenantId,
    range.since,
    range.until
  );

  const merged = new Map<string, SourceRow>();
  for (const r of rows) {
    const raw = String(r.raw ?? "");
    const label = column === "ref" ? refLabel(raw) : raw.trim() || "(not set)";
    const cur = merged.get(label) ?? { source: label, visitors: 0, pageViews: 0, conversions: 0, share: 0 };
    cur.visitors += num(r.visitors);
    cur.pageViews += num(r.pageViews);
    cur.conversions += num(r.conversions);
    merged.set(label, cur);
  }
  const list = [...merged.values()].sort((a, b) => b.visitors - a.visitors || b.pageViews - a.pageViews).slice(0, 50);
  const total = list.reduce((s, r) => s + r.visitors, 0);
  return list.map((r) => ({ ...r, share: total > 0 ? round1((r.visitors / total) * 100) : 0 }));
}

/** Turns a raw referrer or link value into a readable source / target label. */
export function refLabel(raw: string): string {
  const value = raw.trim();
  if (!value) return "Direct";
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "") || "Direct";
  } catch {
    return value.slice(0, 80);
  }
}

function linkLabel(raw: string): string {
  const value = raw.trim();
  if (!value) return "Unknown";
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname.replace(/^www\./, "")}${path}`.slice(0, 90);
  } catch {
    return value.slice(0, 90);
  }
}

export interface LinkRow {
  target: string;
  label: string;
  clicks: number;
  visitors: number;
  share: number;
}

export function clickTable(tenantId: string, range: Range, limit = 50): LinkRow[] {
  const rows = all<Record<string, unknown>>(
    `SELECT ref AS target,
            COUNT(*) AS clicks,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors
     FROM analytics_events
     WHERE tenant_id = ? AND event_type = 'link_click' AND created_at >= ? AND created_at < ?
     GROUP BY ref ORDER BY clicks DESC LIMIT ?`,
    tenantId,
    range.since,
    range.until,
    limit
  );
  const total = rows.reduce((s, r) => s + num(r.clicks), 0);
  return rows.map((r) => ({
    target: String(r.target ?? ""),
    label: linkLabel(String(r.target ?? "")),
    clicks: num(r.clicks),
    visitors: num(r.visitors),
    share: total > 0 ? round1((num(r.clicks) / total) * 100) : 0,
  }));
}

export interface SeriesPoint {
  bucket: string;
  visitors: number;
  pageViews: number;
  clicks: number;
  conversions: number;
}

export function trafficSeries(tenantId: string, range: Range): SeriesPoint[] {
  const rows = all<Record<string, unknown>>(
    `SELECT substr(created_at, 1, ${range.granularity === "hour" ? 13 : 10}) AS bucket,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews,
            COALESCE(SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END), 0) AS clicks,
            COALESCE(SUM(CASE WHEN event_type IN ('lead','booking','purchase') THEN 1 ELSE 0 END), 0) AS conversions
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY substr(created_at, 1, ${range.granularity === "hour" ? 13 : 10}) ORDER BY 1`,
    tenantId,
    range.since,
    range.until
  );
  const byBucket = new Map<string, { visitors: number; pageViews: number; clicks: number; conversions: number }>();
  for (const r of rows) {
    const b = String(r.bucket ?? "");
    const cur = byBucket.get(b) ?? { visitors: 0, pageViews: 0, clicks: 0, conversions: 0 };
    cur.visitors += num(r.visitors);
    cur.pageViews += num(r.pageViews);
    cur.clicks += num(r.clicks);
    cur.conversions += num(r.conversions);
    byBucket.set(b, cur);
  }
  const out: SeriesPoint[] = [];
  for (const bucket of bucketKeys(range)) {
    const v = byBucket.get(bucket) ?? { visitors: 0, pageViews: 0, clicks: 0, conversions: 0 };
    out.push({ bucket, ...v });
  }
  return out;
}

function bucketKeys(range: Range): string[] {
  const keys: string[] = [];
  if (range.granularity === "hour") {
    const start = new Date(range.since);
    for (let i = 0; i < 24; i++) {
      const d = new Date(start.getTime() + i * 3_600_000);
      keys.push(d.toISOString().slice(0, 13));
    }
    return keys;
  }
  const startMs = Date.parse(range.since);
  const endMs = Date.parse(range.until);
  // Inclusive of the bucket that contains `until`, so an event recorded "now"
  // is always represented.
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    keys.push(new Date(ms).toISOString().slice(0, 10));
  }
  return keys;
}

export interface PageRow {
  label: string;
  slug: string;
  pageViews: number;
  visitors: number;
  clicks: number;
}

export function topPages(tenantId: string, range: Range, limit = 20): PageRow[] {
  return all<Record<string, unknown>>(
    `SELECT COALESCE(NULLIF(TRIM(p.title), ''), NULLIF(TRIM(p.slug), ''), 'Home') AS label,
            COALESCE(p.slug, '') AS slug,
            COALESCE(SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pageViews,
            COUNT(DISTINCT CASE WHEN e.visitor_id != '' THEN e.visitor_id END) AS visitors,
            COALESCE(SUM(CASE WHEN e.event_type = 'link_click' THEN 1 ELSE 0 END), 0) AS clicks
     FROM analytics_events e
     LEFT JOIN bio_pages p ON p.id = e.page_id
     WHERE e.tenant_id = ? AND e.created_at >= ? AND e.created_at < ?
     GROUP BY e.page_id ORDER BY pageViews DESC LIMIT ?`,
    tenantId,
    range.since,
    range.until,
    limit
  ).map((r) => ({
    label: String(r.label ?? "Home"),
    slug: String(r.slug ?? ""),
    pageViews: num(r.pageViews),
    visitors: num(r.visitors),
    clicks: num(r.clicks),
  }));
}

export interface RecentEvent {
  at: string;
  type: string;
  country: string;
  device: string;
  ref: string;
}

export interface Realtime {
  /** Distinct visitors seen in the last five minutes. */
  activeVisitors: number;
  recent: RecentEvent[];
}

export function realtime(tenantId: string, windowMinutes = 30): Realtime {
  const activeVisitors = num(
    all<Record<string, unknown>>(
      `SELECT COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS c
       FROM analytics_events WHERE tenant_id = ? AND created_at >= ?`,
      tenantId,
      new Date(Date.now() - 5 * 60_000).toISOString()
    )[0]?.c
  );
  const recent = all<Record<string, unknown>>(
    `SELECT created_at AS at, event_type AS type,
            COALESCE(NULLIF(TRIM(country), ''), '') AS country,
            COALESCE(NULLIF(TRIM(device), ''), '') AS device,
            ref
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ?
     ORDER BY created_at DESC LIMIT 25`,
    tenantId,
    new Date(Date.now() - windowMinutes * 60_000).toISOString()
  ).map((r) => ({
    at: String(r.at ?? ""),
    type: String(r.type ?? ""),
    country: String(r.country ?? ""),
    device: String(r.device ?? ""),
    ref: refLabel(String(r.ref ?? "")),
  }));
  return { activeVisitors, recent };
}

let displayNames: Intl.DisplayNames | null | undefined;
export function countryName(code: string): string {
  const c = code.trim().toUpperCase();
  if (c.length !== 2) return code || "Unknown";
  try {
    if (displayNames === undefined) {
      displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    }
    return displayNames?.of(c) ?? c;
  } catch {
    return c;
  }
}
