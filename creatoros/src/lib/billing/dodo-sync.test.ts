import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import {
  applySubscription,
  subscriptionsFor,
  syncPendingDodoSubscription,
  trackPendingSubscription,
} from "./subscriptions";

let dir: string;
const TENANT = "org_dodo_sync_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-dodo-sync-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_ENV = "test";
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Dodo', 'dodo-sync-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM subscriptions WHERE tenant_id = ?", TENANT);
  run("DELETE FROM subscription_events WHERE tenant_id = ?", TENANT);
  run("UPDATE organizations SET plan = 'free' WHERE id = ?", TENANT);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function orgPlan(): string {
  return row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", TENANT)?.plan ?? "";
}

/** Minimal Dodo API double: /checkouts/<id> then /subscriptions/<id>. */
function stubDodo(opts: {
  subscriptionId?: string | null;
  status?: string;
  nextBillingDate?: string | null;
  currency?: string;
}) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("/checkouts/")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            session_id: "chk_1",
            subscription_id: opts.subscriptionId === undefined ? "sub_1" : opts.subscriptionId,
          }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          subscription_id: opts.subscriptionId === undefined ? "sub_1" : opts.subscriptionId,
          status: opts.status ?? "active",
          next_billing_date: opts.nextBillingDate ?? null,
          currency: opts.currency ?? "usd",
        }),
    };
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

describe("Dodo checkout reconciliation", () => {
  it("promotes a paid session and rebinds the placeholder to the real subscription id", async () => {
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "creator", currency: "usd" });
    expect(subscriptionsFor(TENANT)).toHaveLength(1);
    expect(subscriptionsFor(TENANT)[0].provider_id).toBe("chk_1");

    stubDodo({ status: "active", nextBillingDate: "2026-11-30T00:00:00.000Z" });
    await syncPendingDodoSubscription(TENANT, { force: true });

    expect(orgPlan()).toBe("creator");
    const subs = subscriptionsFor(TENANT);
    expect(subs).toHaveLength(1);
    expect(subs[0].provider_id).toBe("sub_1");
    expect(subs[0].status).toBe("active");
  });

  it("grants nothing while the session has no subscription yet", async () => {
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "pro", currency: "usd" });
    stubDodo({ subscriptionId: null });
    await syncPendingDodoSubscription(TENANT, { force: true });

    expect(orgPlan()).toBe("free");
    expect(subscriptionsFor(TENANT)[0].status).toBe("pending");
  });

  it("closes a cancelled mandate and downgrades", async () => {
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "pro", currency: "usd" });
    stubDodo({ status: "cancelled" });
    await syncPendingDodoSubscription(TENANT, { force: true });

    expect(orgPlan()).toBe("free");
    expect(subscriptionsFor(TENANT)[0].status).toBe("canceled");
  });

  it("keeps the plan through an on_hold renewal that is inside the grace window", async () => {
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "pro", currency: "usd" });
    stubDodo({ status: "on_hold", nextBillingDate: new Date(Date.now() - 86400000).toISOString() });
    await syncPendingDodoSubscription(TENANT, { force: true });

    expect(orgPlan()).toBe("pro");
    expect(subscriptionsFor(TENANT)[0].status).toBe("past_due");
  });

  it("closes the placeholder instead of duplicating a row the webhook already created", async () => {
    // The webhook arrived first and owns `sub_1`.
    applySubscription({
      tenantId: TENANT,
      plan: "creator",
      provider: "dodo",
      providerId: "sub_1",
      status: "active",
      currency: "usd",
    });
    // The checkout placeholder is still sitting there.
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "creator", currency: "usd" });
    expect(subscriptionsFor(TENANT)).toHaveLength(2);

    stubDodo({ status: "active", nextBillingDate: "2026-11-30T00:00:00.000Z" });
    await syncPendingDodoSubscription(TENANT, { force: true });

    const subs = subscriptionsFor(TENANT);
    expect(subs).toHaveLength(2);
    const placeholder = subs.find((s) => s.id !== subs.find((x) => x.provider_id === "sub_1")?.id);
    expect(placeholder?.status).toBe("canceled");
    // The real row is untouched and there is still exactly one live mandate.
    expect(subs.filter((s) => s.status === "active")).toHaveLength(1);
    expect(orgPlan()).toBe("creator");
  });

  it("stays pending when the API call fails", async () => {
    trackPendingSubscription({ tenantId: TENANT, provider: "dodo", providerId: "chk_1", plan: "pro", currency: "usd" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 500, text: async () => JSON.stringify({ message: "boom" }) }))
    );
    await syncPendingDodoSubscription(TENANT, { force: true });

    expect(orgPlan()).toBe("free");
    expect(subscriptionsFor(TENANT)[0].status).toBe("pending");
  });
});
