import { beforeAll, afterAll, describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, run, closeDb } from "@/lib/db/db";
import {
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listAlertRules,
  evaluateRule,
  evaluateAllAlerts,
  fireAlert,
  listAlertEvents,
  markAllAlertsRead,
  unreadAlertCount,
} from "@/lib/analytics/alerts";

const TENANT = "org_alerts";
const DAY = 86_400_000;

describe("analytics alerts", () => {
  let dir: string;

  function insertEvent(type: string, createdAt: string) {
    run(
      "INSERT INTO analytics_events (id, tenant_id, event_type, created_at) VALUES (?,?,?,?)",
      crypto.randomUUID(),
      TENANT,
      type,
      createdAt
    );
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "creatoros-alerts-"));
    process.env.CREATOROS_DB_PATH = join(dir, "test.db");
    getDb();
    const now = new Date().toISOString();
    run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?,'t','t','free',?,?)", TENANT, now, now);
    run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('u_owner','owner@example.com','x','Owner',?,?)", now, now);
    run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('mem_owner',?, 'u_owner','owner',?)", TENANT, now);
  });

  afterAll(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    run("DELETE FROM alert_events");
    run("DELETE FROM alert_rules");
    run("DELETE FROM analytics_events");
  });

  it("validates and stores a rule, rejecting bad input", () => {
    expect(createAlertRule(TENANT, { name: "", metric: "page_views", comparator: "gt", threshold: 1 }).ok).toBe(false);
    expect(createAlertRule(TENANT, { name: "x", metric: "nope" as never, comparator: "gt", threshold: 1 }).ok).toBe(false);

    const good = createAlertRule(TENANT, {
      name: "Traffic spike",
      metric: "page_views",
      comparator: "gt",
      threshold: 100,
      windowDays: 7,
      channel: "inapp",
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.data.windowDays).toBe(7);
    expect(listAlertRules(TENANT)).toHaveLength(1);
  });

  it("evaluates gt and lt against a rolling window", () => {
    const rule = createAlertRule(TENANT, { name: "Views", metric: "page_views", comparator: "gt", threshold: 3, windowDays: 1, channel: "inapp" });
    if (!rule.ok) throw new Error("setup");
    for (let i = 0; i < 4; i++) insertEvent("page_view", new Date().toISOString());
    const ev = evaluateRule(rule.data);
    expect(ev.value).toBe(4);
    expect(ev.triggered).toBe(true);

    const lt = createAlertRule(TENANT, { name: "Cliff", metric: "page_views", comparator: "lt", threshold: 10, windowDays: 1, channel: "inapp" });
    if (!lt.ok) throw new Error("setup");
    expect(evaluateRule(lt.data).triggered).toBe(true);
  });

  it("evaluates percent-change comparators against the previous window", () => {
    const rule = createAlertRule(TENANT, { name: "Up", metric: "page_views", comparator: "pct_up", threshold: 20, windowDays: 1, channel: "inapp" });
    if (!rule.ok) throw new Error("setup");
    const now = Date.now();
    insertEvent("page_view", new Date(now - 1.5 * DAY).toISOString()); // previous window
    for (let i = 0; i < 3; i++) insertEvent("page_view", new Date(now - 3_600_000).toISOString()); // current window
    const ev = evaluateRule(rule.data);
    expect(ev.baseline).toBe(1);
    expect(ev.value).toBe(3);
    expect(ev.changePct).toBeCloseTo(200, 0);
    expect(ev.triggered).toBe(true);
  });

  it("respects cooldown across repeated evaluation runs", async () => {
    const rule = createAlertRule(TENANT, { name: "Any", metric: "page_views", comparator: "gt", threshold: 0, windowDays: 1, channel: "inapp" });
    if (!rule.ok) throw new Error("setup");
    insertEvent("page_view", new Date().toISOString());

    const first = await evaluateAllAlerts(new Date());
    expect(first.fired).toBe(1);
    const second = await evaluateAllAlerts(new Date());
    expect(second.fired).toBe(0);
    expect(second.skipped).toBe(1);
    expect(listAlertEvents(TENANT)).toHaveLength(1);
  });

  it("skips email delivery when no owner email exists, and reports failures", async () => {
    run("DELETE FROM memberships");
    const rule = createAlertRule(TENANT, { name: "Email", metric: "page_views", comparator: "gt", threshold: 0, windowDays: 1, channel: "email" });
    if (!rule.ok) throw new Error("setup");
    insertEvent("page_view", new Date().toISOString());
    const ev = evaluateRule(rule.data);
    const fired = await fireAlert(rule.data, ev);
    expect(fired.emailed).toBe(false);
    expect(fired.event.delivery).toBe("skipped");

    // Owner present, but a misconfigured provider must fail loudly, not silently.
    run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('mem2',?, 'u_owner','owner',?)", TENANT, new Date().toISOString());
    const prev = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    try {
      const fired2 = await fireAlert(rule.data, ev);
      expect(fired2.event.delivery).toBe("failed");
      expect(fired2.event.deliveryError).toContain("RESEND_API_KEY");
    } finally {
      if (prev === undefined) delete process.env.EMAIL_PROVIDER;
      else process.env.EMAIL_PROVIDER = prev;
    }
  });

  it("supports update, delete and read-tracking", async () => {
    const rule = createAlertRule(TENANT, { name: "R", metric: "leads", comparator: "gt", threshold: 0, windowDays: 1, channel: "inapp" });
    if (!rule.ok) throw new Error("setup");
    const upd = updateAlertRule(TENANT, rule.data.id, { active: false, threshold: 5 });
    expect(upd.ok).toBe(true);
    if (upd.ok) {
      expect(upd.data.active).toBe(false);
      expect(upd.data.threshold).toBe(5);
    }

    insertEvent("lead", new Date().toISOString());
    const reactivated = updateAlertRule(TENANT, rule.data.id, { active: true });
    if (!reactivated.ok) throw new Error("setup");
    await fireAlert(reactivated.data, evaluateRule(reactivated.data));
    expect(listAlertEvents(TENANT)).toHaveLength(1);
    expect(unreadAlertCount(TENANT)).toBe(1);
    expect(markAllAlertsRead(TENANT)).toBe(1);
    expect(unreadAlertCount(TENANT)).toBe(0);

    expect(deleteAlertRule(TENANT, rule.data.id)).toBe(true);
    expect(listAlertRules(TENANT)).toHaveLength(0);
  });
});
