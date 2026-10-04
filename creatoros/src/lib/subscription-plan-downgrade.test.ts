import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
import { applySubscription, subscriptionsFor } from "@/lib/billing/subscriptions";

/**
 * D-12: a subscription webhook could silently downgrade a paying tenant to `free`.
 *
 * Both halves of the path read an absent plan as the literal plan `free`:
 *
 *   route       `str(metadata.plan) || "free"`
 *   module      wrote that value to `subscriptions.plan`, then — because the
 *               status was `active` — ran `UPDATE organizations SET plan='free'`
 *
 * Gateways routinely omit metadata on update and renewal events. So the first
 * `customer.subscription.updated` that arrived without a `plan` key took a tenant
 * from `pro` to `free` while the customer was still being charged. No error, no
 * alert: the tenant simply lost the features they were paying for, and the
 * downgrade looked like ordinary billing state.
 *
 * The fix is to treat absence as "the gateway did not say", and only move a plan
 * when something authoritative says so.
 */

let dir: string;
const TENANT = "org_d12";

function orgPlan(): string {
  return String(row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", TENANT)?.plan ?? "");
}

function subPlan(providerId: string): string {
  return String(row<{ plan: string }>("SELECT plan FROM subscriptions WHERE tenant_id = ? AND provider_id = ?", TENANT, providerId)?.plan ?? "");
}

function post(body: unknown): Promise<Response> {
  return webhook(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(body),
    })
  ) as Promise<Response>;
}

/** A subscription lifecycle event; metadata is built from only what is passed. */
function subscriptionEvent(type: string, id: string, metadata: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return post({ id: `evt_${id}_${Math.random().toString(36).slice(2, 8)}`, type, data: { id, metadata, status: "active", ...extra } });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-d12-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "d12-secret-with-enough-entropy-1234";
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'D12', 'd12-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM subscriptions WHERE tenant_id = ?", TENANT);
  run("DELETE FROM webhook_events");
  run("UPDATE organizations SET plan = 'free' WHERE id = ?", TENANT);
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("D-12: absent metadata.plan is not the plan 'free'", () => {
  it("does not downgrade a paying tenant when an update event omits the plan", async () => {
    // Tenant is on pro, with a subscription row that records it.
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_a", status: "active" });
    expect(orgPlan()).toBe("pro");

    // The renewal arrives with tenantId but no plan - the common gateway shape.
    const res = await subscriptionEvent("customer.subscription.updated", "sub_d12_a", { tenantId: TENANT });
    expect(res.status).toBe(200);

    expect(orgPlan()).toBe("pro");
    expect(subPlan("sub_d12_a")).toBe("pro");
  });

  it("keeps the recorded plan when a plan-less event reports a non-active status", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_d", status: "active" });

    await subscriptionEvent("customer.subscription.updated", "sub_d12_d", { tenantId: TENANT }, { status: "past_due" });

    // The D-12 concern is only that absence of metadata must not rewrite the row.
    // What a `past_due` tenant is *entitled* to - grace period, dunning, recovery
    // email - is deliberately untouched here and is D-13's subject.
    expect(subPlan("sub_d12_d")).toBe("pro");
  });

  it("does not downgrade on the first event it has ever seen for that subscription", async () => {
    run("UPDATE organizations SET plan = 'pro' WHERE id = ?", TENANT);

    await subscriptionEvent("customer.subscription.updated", "sub_d12_never_seen", { tenantId: TENANT });

    expect(orgPlan()).toBe("pro");
  });

  it("still grants a plan when the gateway does send one", async () => {
    const res = await subscriptionEvent("customer.subscription.created", "sub_d12_b", { tenantId: TENANT, plan: "starter" });
    expect(res.status).toBe(200);
    expect(orgPlan()).toBe("starter");
    expect(subPlan("sub_d12_b")).toBe("starter");
  });

  it("converges once a later event carries the plan", async () => {
    // A plan-less event records nothing authoritative...
    await subscriptionEvent("customer.subscription.created", "sub_d12_c", { tenantId: TENANT });
    expect(orgPlan()).toBe("free");

    // ...and a later one with metadata applies normally, no repair needed.
    await subscriptionEvent("customer.subscription.updated", "sub_d12_c", { tenantId: TENANT, plan: "pro" });
    expect(orgPlan()).toBe("pro");
    expect(subPlan("sub_d12_c")).toBe("pro");
    expect(subscriptionsFor(TENANT)).toHaveLength(1);
  });

  it("keeps the recorded plan on the row when a cancellation omits the plan", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_e", status: "active" });

    await subscriptionEvent("customer.subscription.deleted", "sub_d12_e", { tenantId: TENANT });

    // Cancelled: the org loses access, which is correct...
    expect(orgPlan()).toBe("free");
    // ...but the historical record of what they were on survives the rewrite.
    expect(subPlan("sub_d12_e")).toBe("pro");
  });

  it("does not evict the tenant when another subscription is still active", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_f", status: "active" });
    applySubscription({ tenantId: TENANT, plan: "starter", provider: "stripe", providerId: "sub_d12_g", status: "active" });

    applySubscription({ tenantId: TENANT, plan: "starter", provider: "stripe", providerId: "sub_d12_g", status: "canceled" });

    // One of two subs is gone; the tenant still has a live one.
    expect(orgPlan()).toBe("pro");
    expect(subscriptionsFor(TENANT).filter((s) => s.status === "active")).toHaveLength(1);
  });

  it("downgrades once the last active subscription is gone", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_h", status: "active" });
    applySubscription({ tenantId: TENANT, plan: "starter", provider: "stripe", providerId: "sub_d12_i", status: "active" });

    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_h", status: "canceled" });
    // sub_h is the pro one and it is the one that just ended, so the tenant falls
    // back to the only live subscription rather than to free.
    expect(orgPlan()).toBe("starter");

    applySubscription({ tenantId: TENANT, plan: "starter", provider: "stripe", providerId: "sub_d12_i", status: "canceled" });
    expect(orgPlan()).toBe("free");
  });

  it("keeps the recorded plan when a plan-less event reports an uncollected status", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_j", status: "active" });

    applySubscription({ tenantId: TENANT, plan: null, provider: "stripe", providerId: "sub_d12_j", status: "incomplete" });

    // `incomplete` means never collected, so withholding access is right - but
    // that is D-13's policy question, not this fix. What D-12 owns is that the
    // absence of a plan did not overwrite what the row already knew.
    expect(subPlan("sub_d12_j")).toBe("pro");
  });

  it("does not let a plan-less event rewrite a subscription it does not own", async () => {
    applySubscription({ tenantId: TENANT, plan: "pro", provider: "stripe", providerId: "sub_d12_k", status: "active" });

    // Different subscription id, no plan: creates its own row, leaves the first alone.
    await subscriptionEvent("customer.subscription.created", "sub_d12_other", { tenantId: TENANT });

    expect(subPlan("sub_d12_k")).toBe("pro");
    expect(orgPlan()).toBe("pro");
    expect(subscriptionsFor(TENANT)).toHaveLength(2);
  });
});