import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, run, closeDb, nowIso } from "@/lib/db/db";
import { trackEvent } from "@/lib/analytics/engine";
import {
  countryTable,
  clickTable,
  deviceTable,
  overview,
  pair,
  presetRange,
  previousRange,
  realtime,
  resolveRange,
  trafficSeries,
  countryName,
} from "@/lib/analytics/reporting";

const TENANT = "org_report";
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-report-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  const now = nowIso();
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('u1','r@test.com','x','R',?,?)", now, now);
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?,'R','r-org','free',?,?)", TENANT, now, now);
  run("INSERT INTO profiles (id, tenant_id, user_id, username, created_at, updated_at) VALUES ('p1',?,'u1','r',?,?)", TENANT, now, now);
  run("INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, created_at, updated_at) VALUES ('pg1',?,'p1','','Home',?,?)", TENANT, now, now);

  // One session (s1) with two page views then a click, lead and engagement.
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "page_view", eventName: "", visitorId: "v1", sessionId: "s1", country: "US", device: "mobile" });
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "page_view", visitorId: "v1", sessionId: "s1", country: "US", device: "mobile" });
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "link_click", visitorId: "v1", sessionId: "s1", ref: "https://instagram.com/creator", country: "US" });
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "lead", visitorId: "v1", sessionId: "s1", country: "US" });
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "engagement", visitorId: "v1", sessionId: "s1", engagementMs: 30000 });
  // A second session with a single page view (a bounce).
  trackEvent({ tenantId: TENANT, pageId: "pg1", eventType: "page_view", visitorId: "v2", sessionId: "s2", country: "IN", device: "desktop" });
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("reporting overview", () => {
  it("counts visitors, views, sessions and clicks", () => {
    const o = overview(TENANT, presetRange("30d"));
    expect(o.current.visitors).toBe(2);
    expect(o.current.pageViews).toBe(3);
    expect(o.current.sessions).toBe(2);
    expect(o.current.clicks).toBe(1);
    expect(o.current.leads).toBe(1);
    expect(o.current.conversions).toBe(1);
  });

  it("derives CTR, conversion rate, bounce rate and engagement", () => {
    expect(overview(TENANT, presetRange("30d")).current.ctr).toBe(33.3);
    expect(overview(TENANT, presetRange("30d")).current.conversionRate).toBe(50);
    expect(overview(TENANT, presetRange("30d")).current.bounceRate).toBe(50);
    expect(overview(TENANT, presetRange("30d")).current.avgEngagementMs).toBe(15000);
  });

  it("compares against the previous equal-length window", () => {
    const prev = previousRange(presetRange("7d"));
    expect(Date.parse(prev.until)).toBe(Date.parse(presetRange("7d").since));
    const p = pair(10, 5);
    expect(p.changePct).toBe(100);
    expect(pair(10, 0).changePct).toBeNull();
    void overview;
    void countryTable;
  });
});

describe("analytics dimensions", () => {
  it("counts unique visitors and share per country", () => {
    const rows = countryTable(TENANT, presetRange("30d"));
    const us = rows.find((r) => r.country === "US");
    const ind = rows.find((r) => r.country === "IN");
    expect(us?.visitors).toBe(1);
    expect(ind?.visitors).toBe(1);
    expect(us?.share).toBe(50);
    expect(us?.pageViews).toBe(2);
  });

  it("labels clicked links by host and path", () => {
    const rows = clickTable(TENANT, presetRange("30d"));
    expect(rows[0]?.label).toBe("instagram.com/creator");
    expect(rows[0]?.clicks).toBe(1);
  });

  it("totals devices", () => {
    const rows = deviceTable(TENANT, presetRange("30d"));
    const map = Object.fromEntries(rows.map((r) => [r.device, r.visitors]));
    expect(map.mobile).toBe(1);
    expect(map.desktop).toBe(1);
  });

  it("buckets the time series so buckets sum to the totals", () => {
    const series = trafficSeries(TENANT, presetRange("30d"));
    expect(series.reduce((s, p) => s + p.pageViews, 0)).toBe(3);
    expect(series.reduce((s, p) => s + p.clicks, 0)).toBe(1);
  });

  it("reports recent visitors in realtime", () => {
    const rt = realtime(TENANT);
    expect(rt.activeVisitors).toBe(2);
    expect(rt.recent.length).toBeGreaterThan(0);
  });

  it("resolves ranges and country names", () => {
    expect(resolveRange("bogus").key).toBe("30d");
    expect(resolveRange("today").granularity).toBe("hour");
    expect(countryName("US")).toBe("United States");
  });
});
