import { beforeAll, afterAll, describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, run, row, closeDb } from "@/lib/db/db";
import { pruneAnalyticsEvents, analyticsRetentionDays } from "@/lib/analytics/retention";

const TENANT = "org_retention";

function insertEvent(id: string, createdAt: string) {
  run("INSERT INTO analytics_events (id, tenant_id, event_type, created_at) VALUES (?,?,?,?)", id, TENANT, "page_view", createdAt);
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function count(): number {
  return row<{ c: number }>("SELECT COUNT(*) AS c FROM analytics_events")?.c ?? 0;
}

describe("analytics retention", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "creatoros-retention-"));
    process.env.CREATOROS_DB_PATH = join(dir, "test.db");
    getDb();
    run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?,'t','t','free',?,?)", TENANT, daysAgo(0), daysAgo(0));
  });

  afterAll(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    run("DELETE FROM analytics_events");
  });

  it("defaults to 400 days when the env override is absent or invalid", () => {
    delete process.env.ANALYTICS_RETENTION_DAYS;
    expect(analyticsRetentionDays()).toBe(400);
    process.env.ANALYTICS_RETENTION_DAYS = "-5";
    expect(analyticsRetentionDays()).toBe(400);
    process.env.ANALYTICS_RETENTION_DAYS = "90";
    expect(analyticsRetentionDays()).toBe(90);
    delete process.env.ANALYTICS_RETENTION_DAYS;
  });

  it("deletes only events older than the window and keeps recent ones", () => {
    insertEvent("old1", daysAgo(50));
    insertEvent("old2", daysAgo(31));
    insertEvent("fresh1", daysAgo(10));
    insertEvent("fresh2", daysAgo(0));

    const result = pruneAnalyticsEvents({ days: 30 });

    expect(result.deleted).toBe(2);
    expect(result.retentionDays).toBe(30);
    expect(count()).toBe(2);
    expect(row("SELECT id FROM analytics_events WHERE id = 'fresh1'")).toBeTruthy();
    expect(row("SELECT id FROM analytics_events WHERE id = 'old1'")).toBeUndefined();
  });

  it("prunes in bounded batches without leaving a backlog", () => {
    for (let i = 0; i < 23; i++) insertEvent(`e${i}`, daysAgo(200));

    const result = pruneAnalyticsEvents({ days: 30, batchSize: 5 });

    expect(result.deleted).toBe(23);
    expect(count()).toBe(0);
  });

  it("is a no-op when nothing is expired", () => {
    insertEvent("recent", daysAgo(1));
    const result = pruneAnalyticsEvents({ days: 30 });
    expect(result.deleted).toBe(0);
    expect(count()).toBe(1);
  });
});
