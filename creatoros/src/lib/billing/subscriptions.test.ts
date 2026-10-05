import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import { applySubscription, activeSubscription, cancelSubscriptionTracking, subscriptionsFor } from "./subscriptions";

let dir: string;
const TENANT = "org_sub_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-sub-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Sub Test', 'test-sub-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM subscriptions WHERE tenant_id = ?", TENANT);
  run("UPDATE organizations SET plan = 'free' WHERE id = ?", TENANT);
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function orgPlan(): string {
  return row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", TENANT)?.plan ?? "";
}

describe("billing subscriptions", () => {
  it("applies an active subscription and upgrades the org plan idempotently", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "creator",
      provider: "stripe",
      providerId: "sub_test_1",
      customerId: "cus_test_1",
      status: "active",
      currentPeriodEnd: nowIso(),
    });

    expect(orgPlan()).toBe("creator");
    const sub = activeSubscription(TENANT);
    expect(sub?.provider_id).toBe("sub_test_1");
    expect(sub?.status).toBe("active");
    expect(subscriptionsFor(TENANT)).toHaveLength(1);

    // Re-delivering the same webhook upserts, does not inflate rows.
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "stripe",
      providerId: "sub_test_1",
      customerId: "cus_test_1",
      status: "active",
    });
    expect(orgPlan()).toBe("pro");
    expect(subscriptionsFor(TENANT)).toHaveLength(1);
  });

  it("records the mandate currency and does not let a later event relabel it", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "stripe",
      providerId: "sub_ccy_1",
      status: "active",
      currency: "inr",
    });
    expect(activeSubscription(TENANT)?.currency).toBe("inr");

    // A follow-up event with no currency must keep the known value rather than
    // resetting the INR mandate to the deployment's default currency.
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "stripe",
      providerId: "sub_ccy_1",
      status: "active",
    });
    expect(activeSubscription(TENANT)?.currency).toBe("inr");
  });

  it("falls back to the deployment billing currency when none is known", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "stripe",
      providerId: "sub_ccy_2",
      status: "active",
    });
    expect(activeSubscription(TENANT)?.currency).toBe("usd");
  });

  it("downgrades the org to free when a subscription is canceled via webhook", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "stripe",
      providerId: "sub_test_2",
      status: "active",
    });
    expect(orgPlan()).toBe("pro");

    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "stripe",
      providerId: "sub_test_2",
      status: "canceled",
    });
    expect(orgPlan()).toBe("free");
    expect(activeSubscription(TENANT)).toBeUndefined();
  });

  it("keeps an active subscription after explicit cancel tracking removes it from active view", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "starter",
      provider: "stripe",
      providerId: "sub_test_3",
      customerId: "cus_test_3",
      status: "active",
    });

    cancelSubscriptionTracking(TENANT, "sub_test_3");
    const rowInDb = row<{ status: string }>("SELECT status FROM subscriptions WHERE provider_id = 'sub_test_3'");
    expect(rowInDb?.status).toBe("canceled");
    // Cancel endpoint keeps the org on its plan until period end (Stripe behavior),
    // so org plan is NOT force-downgraded here.
    expect(orgPlan()).toBe("starter");
    expect(activeSubscription(TENANT)).toBeUndefined();
  });

  it("returns nothing when there is no active subscription", () => {
    expect(activeSubscription("org_nope")).toBeUndefined();
  });

  it("cancels a mock subscription even with no provider id", () => {
    applySubscription({
      tenantId: TENANT,
      plan: "pro",
      provider: "mock",
      status: "active",
    });
    expect(activeSubscription(TENANT)).toBeDefined();

    cancelSubscriptionTracking(TENANT);
    expect(activeSubscription(TENANT)).toBeUndefined();
    const s = row<{ status: string }>("SELECT status FROM subscriptions WHERE tenant_id = ?", TENANT);
    expect(s?.status).toBe("canceled");
  });
});