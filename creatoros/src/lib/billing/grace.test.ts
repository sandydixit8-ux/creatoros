import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import { applySubscription, isEntitled, graceDays, activeSubscription } from "./subscriptions";

let dir: string;
const TENANT = "org_grace_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-grace-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Grace', 'grace-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM subscriptions WHERE tenant_id = ?", TENANT);
  run("DELETE FROM subscription_events WHERE tenant_id = ?", TENANT);
  run("UPDATE organizations SET plan = 'free' WHERE id = ?", TENANT);
  delete process.env.BILLING_GRACE_DAYS;
});

afterEach(() => {
  delete process.env.BILLING_GRACE_DAYS;
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function orgPlan(): string {
  return row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", TENANT)?.plan ?? "";
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/**
 * D-13, decided: a failed renewal must not instantly evict a paying customer.
 * The money did not arrive, but the customer has not left — the provider is still
 * retrying. Access is retained for `BILLING_GRACE_DAYS` (default 3) and then the
 * account drops to free.
 */
describe("past_due grace window", () => {
  it("keeps the paid plan while the failure is inside the grace window", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_1",
      status: "active",
      currentPeriodEnd: daysAgo(1),
      currency: "usd",
    });
    expect(orgPlan()).toBe("pro");

    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_1",
      status: "past_due",
      currentPeriodEnd: daysAgo(1),
      currency: "usd",
    });

    expect(orgPlan()).toBe("pro");
    expect(activeSubscription(TENANT)?.status).toBe("past_due");
  });

  it("drops the plan once the grace window has expired", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_2",
      status: "active",
      currentPeriodEnd: daysAgo(10),
      currency: "usd",
    });

    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_2",
      status: "past_due",
      currentPeriodEnd: daysAgo(10),
      currency: "usd",
    });

    expect(orgPlan()).toBe("free");
  });

  it("does not let a redelivered past_due extend the window", () => {
    // The anchor is the failed period, not the arrival time, so replaying the
    // same event five times must not keep the plan alive forever.
    for (let i = 0; i < 5; i++) {
      applySubscription({
        tenantId: TENANT,
        plan: "creator",
        provider: "dodo",
        providerId: "sub_grace_3",
        status: "past_due",
        currentPeriodEnd: daysAgo(5),
        currency: "usd",
      });
    }
    expect(orgPlan()).toBe("free");
  });

  it("honours a configured grace of zero days", () => {
    process.env.BILLING_GRACE_DAYS = "0";
    expect(graceDays()).toBe(0);
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "dodo",
      providerId: "sub_grace_4",
      status: "past_due",
      currentPeriodEnd: daysAgo(0),
      currency: "usd",
    });
    expect(orgPlan()).toBe("free");
  });

  it("clamps a nonsense grace setting instead of trusting it", () => {
    process.env.BILLING_GRACE_DAYS = "9999";
    expect(graceDays()).toBe(30);
    process.env.BILLING_GRACE_DAYS = "-4";
    expect(graceDays()).toBe(0);
    process.env.BILLING_GRACE_DAYS = "not-a-number";
    expect(graceDays()).toBe(3);
  });

  it("still downgrades immediately on cancellation", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_5",
      status: "active",
      currentPeriodEnd: daysAgo(1),
      currency: "usd",
    });
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_5",
      status: "canceled",
    });
    expect(orgPlan()).toBe("free");
  });

  it("keeps a second, better subscription alive when a graced one is unrelated", () => {
    // A tenant can hold more than one mandate. Letting the grace-period one
    // lapse must not evict the tenant from the other one.
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "stripe",
      providerId: "sub_grace_other",
      status: "active",
      currency: "usd",
    });
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_6",
      status: "past_due",
      currentPeriodEnd: daysAgo(10),
      currency: "usd",
    });
    expect(orgPlan()).toBe("starter");
  });

  it("records each real transition, but not repeated identical pings", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_events",
      status: "active",
      currency: "usd",
    });
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "dodo",
      providerId: "sub_grace_events",
      status: "active",
      currency: "usd",
    });
    const events = row<{ c: number }>(
      "SELECT COUNT(*) AS c FROM subscription_events WHERE tenant_id = ?",
      TENANT
    );
    expect(Number(events?.c)).toBe(1);
  });
});

describe("isEntitled", () => {
  it("treats active and trialing as entitled", () => {
    expect(isEntitled({ status: "active", current_period_end: null, updated_at: daysAgo(400) })).toBe(true);
    expect(isEntitled({ status: "trialing", current_period_end: null, updated_at: daysAgo(400) })).toBe(true);
  });

  it("treats canceled and pending as not entitled", () => {
    expect(isEntitled({ status: "canceled", current_period_end: nowIso(), updated_at: nowIso() })).toBe(false);
    expect(isEntitled({ status: "pending", current_period_end: nowIso(), updated_at: nowIso() })).toBe(false);
  });

  it("anchors grace to the failed period when one is known", () => {
    expect(isEntitled({ status: "past_due", current_period_end: daysAgo(2), updated_at: daysAgo(0) })).toBe(true);
    expect(isEntitled({ status: "past_due", current_period_end: daysAgo(4), updated_at: daysAgo(0) })).toBe(false);
  });

  it("falls back to updated_at only when no period was supplied", () => {
    expect(isEntitled({ status: "on_hold", current_period_end: null, updated_at: daysAgo(1) })).toBe(true);
    expect(isEntitled({ status: "on_hold", current_period_end: null, updated_at: daysAgo(9) })).toBe(false);
  });
});
