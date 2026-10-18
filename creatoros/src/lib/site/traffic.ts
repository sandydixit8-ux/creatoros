import { all, run, newId, nowIso } from "@/lib/db/db";
import { hashVisitorId } from "@/lib/analytics/engine";
import { countryName } from "@/lib/analytics/reporting";
import { SITE_URL } from "@/lib/constants";

/**
 * First-party traffic for the product's OWN marketing site, shown only on the
 * platform admin dashboard.
 *
 * This is deliberately not `analytics_events`: that table is consent-gated
 * visitor tracking shown to a creator, and its `tenant_id` cascades when a
 * workspace is deleted. The platform's own pages have no tenant, and their
 * numbers must not leak into any customer's reports - the same split as
 * `funnel_events`.
 *
 * Privacy: no cookie and no client storage are involved. A "visitor" is a
 * daily-rotating salted hash of IP + user agent, so the same person on the same
 * day collapses to one entry and there is nothing durable to attach to a
 * person. That is why this needs no consent gate, unlike the tenant tracker.
 */

const MAX_PATH = 300;
const MAX_REF = 200;

export interface SiteVisitInput {
  path: string;
  country?: string;
  device?: string;
  ref?: string;
  ip?: string;
  userAgent?: string;
}

/** Absolute-path form, query and fragment stripped, length-capped. */
export function normalizePath(raw: string): string {
  let p = (raw || "").trim();
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  if (!p) return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  return p.length > MAX_PATH ? p.slice(0, MAX_PATH) : p;
}

/**
 * Referrer hostname, or "" for a direct hit or a same-site navigation, so the
 * referrers table shows where visitors actually came *from* and internal link
 * clicks do not masquerade as acquisition.
 */
export function referrerHost(raw: string): string {
  const r = (raw || "").trim();
  if (!r) return "";
  try {
    const host = new URL(r).hostname.toLowerCase();
    if (!host || host === selfHost()) return "";
    return host.slice(0, MAX_REF);
  } catch {
    return "";
  }
}

let selfHostCache: string | null = null;
function selfHost(): string {
  if (selfHostCache === null) {
    try {
      selfHostCache = new URL(SITE_URL).hostname.toLowerCase();
    } catch {
      selfHostCache = "";
    }
  }
  return selfHostCache;
}

/**
 * Record one marketing-site page view. Never throws: instrumentation that can
 * break the page it measures is worse than none, so failures are logged and
 * swallowed (matching `recordFunnelEvent`).
 */
export function recordSiteVisit(input: SiteVisitInput): void {
  try {
    const created = nowIso();
    const day = created.slice(0, 10);
    const ip = (input.ip || "").trim();
    const ua = (input.userAgent || "").trim();
    // Daily-rotating visitor id: the same person on a different day hashes to a
    // different value, so this cannot be used to track anyone across days.
    const visitorId = ip || ua ? hashVisitorId(`${ip}|${ua}|${day}`) : "";

    run(
      `INSERT INTO site_visits (id, path, country, device, ref, visitor_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("sv"),
      normalizePath(input.path),
      (input.country || "").toUpperCase().slice(0, 2),
      (input.device || "").slice(0, 20),
      referrerHost(input.ref || ""),
      visitorId,
      created
    );
  } catch (e) {
    console.error("[site-traffic] failed to record visit", input.path, e);
  }
}

export interface SiteTrafficCountry {
  country: string;
  name: string;
  visitors: number;
  views: number;
  share: number;
}

export interface SiteTrafficPage {
  path: string;
  views: number;
  visitors: number;
}

export interface SiteTrafficDay {
  date: string;
  views: number;
  visitors: number;
}

export interface SiteTraffic {
  days: number;
  visitors: number;
  pageViews: number;
  countries: SiteTrafficCountry[];
  pages: SiteTrafficPage[];
  daily: SiteTrafficDay[];
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function sinceIso(days: number): string {
  return new Date(Date.now() - Math.max(1, days) * 86_400_000).toISOString();
}

/**
 * Aggregate the marketing-site traffic over the last `days`.
 *
 * Country share is of all distinct visitors in the range (not the sum of the
 * rows), so a visitor seen in two countries cannot inflate the total; a blank
 * country (CDN header missing) is listed as "Unknown" rather than dropped.
 */
export function siteTrafficSummary(days = 30, opts?: { countryLimit?: number; pageLimit?: number }): SiteTraffic {
  const from = sinceIso(days);
  const countryLimit = Math.min(Math.max(opts?.countryLimit ?? 20, 1), 100);
  const pageLimit = Math.min(Math.max(opts?.pageLimit ?? 15, 1), 100);

  const totals = all<{ visitors: number; pageViews: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COUNT(*) AS pageViews
     FROM site_visits WHERE created_at >= ?`,
    from
  )[0];
  const visitors = num(totals?.visitors);
  const pageViews = num(totals?.pageViews);

  const countries = all<{ country: string; visitors: number; views: number }>(
    `SELECT country,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors,
            COUNT(*) AS views
     FROM site_visits WHERE created_at >= ?
     GROUP BY country
     ORDER BY visitors DESC, views DESC
     LIMIT ?`,
    from,
    countryLimit
  ).map((r) => {
    const country = String(r.country ?? "").toUpperCase();
    return {
      country,
      name: country ? countryName(country) : "Unknown",
      visitors: num(r.visitors),
      views: num(r.views),
      share: visitors > 0 ? Math.round((num(r.visitors) / visitors) * 1000) / 10 : 0,
    };
  });

  const pages = all<{ path: string; views: number; visitors: number }>(
    `SELECT path,
            COUNT(*) AS views,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors
     FROM site_visits WHERE created_at >= ?
     GROUP BY path
     ORDER BY views DESC, visitors DESC
     LIMIT ?`,
    from,
    pageLimit
  ).map((r) => ({ path: String(r.path ?? "/"), views: num(r.views), visitors: num(r.visitors) }));

  const daily = all<{ date: string; views: number; visitors: number }>(
    `SELECT substr(created_at, 1, 10) AS date,
            COUNT(*) AS views,
            COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS visitors
     FROM site_visits WHERE created_at >= ?
     GROUP BY date
     ORDER BY date ASC`,
    from
  ).map((r) => ({ date: String(r.date ?? ""), views: num(r.views), visitors: num(r.visitors) }));

  return { days, visitors, pageViews, countries, pages, daily };
}
