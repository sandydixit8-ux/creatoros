import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { trackEvent, pageBreakdown, breakdownBy, summary } from "./engine";

let dir: string;
const TENANT = "org_an_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-analytics-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  const now = nowIso();
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('u1', 'an@test.com', 'x', 'An', ?, ?)", now, now);
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'An', 'an-org', 'free', ?, ?)", TENANT, now, now);
  run("INSERT INTO profiles (id, tenant_id, user_id, username, created_at, updated_at) VALUES ('p1', ?, 'u1', 'an', ?, ?)", TENANT, now, now);
  run("INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, created_at, updated_at) VALUES ('pageA', ?, 'p1', '', 'Main Page', ?, ?)", TENANT, now, now);
  run("INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, created_at, updated_at) VALUES ('pageB', ?, 'p1', 'links', '', ?, ?)", TENANT, now, now);

  for (let i = 0; i < 3; i++) {
    trackEvent({ tenantId: TENANT, pageId: "pageA", eventType: "page_view", visitorId: `v${i}`, country: "US" });
  }
  trackEvent({ tenantId: TENANT, pageId: "pageA", eventType: "page_view", visitorId: "v3", country: "IN" });
  trackEvent({ tenantId: TENANT, pageId: "pageB", eventType: "page_view", visitorId: "v4" });
  trackEvent({ tenantId: TENANT, pageId: "pageA", eventType: "link_click", visitorId: "v0", country: "US" });
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("analytics breakdowns", () => {
  it("groups page views by bio page, title first then slug, excluding non-views", () => {
    expect(pageBreakdown(TENANT)).toEqual([
      { label: "Main Page", count: 4 },
      { label: "links", count: 1 },
    ]);
  });

  it("labels blank countries as Unknown and counts codes", () => {
    const map = Object.fromEntries(breakdownBy(TENANT, "country").map((c) => [c.label, c.count]));
    expect(map.US).toBe(4); // 3 US page views + 1 US link click
    expect(map.IN).toBe(1);
    expect(map.Unknown).toBe(1);
  });

  it("labels blank devices as unknown and blank refs as direct", () => {
    expect(breakdownBy(TENANT, "device").every((d) => d.label === "unknown")).toBe(true);
    expect(breakdownBy(TENANT, "ref").every((r) => r.label === "direct")).toBe(true);
  });

  it("counts distinct visitors, page views and link clicks", () => {
    const s = summary(TENANT);
    expect(s.pageViews).toBe(5);
    expect(s.visitors).toBe(5);
    expect(s.linkClicks).toBe(1);
  });

  it("returns no blended revenue figure at all", () => {
    // Regression guard. `summary()` once returned `revenueCents` (bookings plus
    // orders, currencies added) and two components printed it behind a hardcoded
    // "$", so a rupee amount was presented as dollars. The field was removed
    // rather than corrected because a blended total cannot be rendered honestly;
    // this test fails if anyone puts a number back.
    const s = summary(TENANT) as unknown as Record<string, unknown>;
    expect(s).not.toHaveProperty("revenueCents");
    expect(Object.keys(s).sort()).toEqual(
      ["bookings", "conversionRate", "conversions", "leads", "linkClicks", "pageViews", "visitors"].sort()
    );
  });
});
