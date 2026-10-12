import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, run, closeDb, nowIso } from "@/lib/db/db";
import { buildAnalyticsContext, buildAnalyticsPrompt } from "@/lib/analytics/assistant";
import { trackEvent } from "@/lib/analytics/engine";

const T1 = "org_assist_1";
const T2 = "org_assist_2";
let dir: string;

function seedTenant(id: string, user: string) {
  const now = nowIso();
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?,?, 'x','U',?,?)", user, `${user}@t.com`, now, now);
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?,?,?,'free',?,?)", id, id, id, now, now);
}

describe("analytics assistant context", () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "creatoros-assist-"));
    process.env.CREATOROS_DB_PATH = join(dir, "test.db");
    getDb();
    seedTenant(T1, "au1");
    seedTenant(T2, "au2");
    trackEvent({ tenantId: T1, eventType: "page_view", visitorId: "v1", country: "IN", device: "mobile", ref: "https://instagram.com" });
    trackEvent({ tenantId: T1, eventType: "page_view", visitorId: "v2", country: "IN", device: "desktop" });
    trackEvent({ tenantId: T1, eventType: "link_click", visitorId: "v1", ref: "https://youtube.com" });
    trackEvent({ tenantId: T2, eventType: "page_view", visitorId: "x1", country: "US" });
  });

  afterAll(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("builds a tenant-scoped, PII-free snapshot", () => {
    const ctx = buildAnalyticsContext(T1, "30d");
    expect(ctx.current.pageViews).toBe(2);
    expect(ctx.current.visitors).toBe(2);
    expect(ctx.current.clicks).toBe(1);
    expect(ctx.countries[0]).toMatchObject({ country: "India" });
    // The other tenant's US page view must never leak in.
    expect(ctx.countries.some((c) => c.country === "United States")).toBe(false);
    expect(ctx.clicks[0]).toMatchObject({ target: expect.stringContaining("youtube.com"), clicks: 1 });
  });

  it("scopes to the requested range key", () => {
    const ctx = buildAnalyticsContext(T1, "today");
    expect(ctx.range).toBe("today");
    expect(ctx.current.pageViews).toBe(2);
  });

  it("builds a prompt carrying the question and the data", () => {
    const ctx = buildAnalyticsContext(T1, "30d");
    const msgs = buildAnalyticsPrompt("Where do my visitors come from?", ctx);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain("Where do my visitors come from?");
    expect(msgs[1].content).toContain("\"pageViews\":2");
  });
});
