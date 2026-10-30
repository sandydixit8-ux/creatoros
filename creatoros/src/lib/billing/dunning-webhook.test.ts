import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, all, row, nowIso } from "@/lib/db/db";

const RAW_SECRET = "dodo_dunning_test_secret";
const SECRET = `whsec_${Buffer.from(RAW_SECRET).toString("base64")}`;
const TENANT = "org_dunning_test";

let dir: string;
let POST: typeof import("@/app/api/webhooks/stripe/route").POST;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-dunning-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = SECRET;
  process.env.DODO_ENV = "test";
  process.env.PAYMENT_PROVIDER = "dodo";
  getDb();
  ({ POST } = await import("@/app/api/webhooks/stripe/route"));

  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Dunning', 'dunning-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('u_owner', 'owner@example.com', 'x', 'Owner Name', ?, ?)",
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('m_owner', ?, 'u_owner', 'owner', ?)",
    TENANT,
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM subscriptions WHERE tenant_id = ?", TENANT);
  run("DELETE FROM subscription_events WHERE tenant_id = ?", TENANT);
  run("DELETE FROM email_jobs");
  run("DELETE FROM webhook_events");
  run("UPDATE organizations SET plan = 'free' WHERE id = ?", TENANT);
});

afterEach(() => {
  delete process.env.PAYMENT_PROVIDER;
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function sign(payload: string, id: string, timestamp: number): string {
  const sig = createHmac("sha256", RAW_SECRET).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return `v1,${sig}`;
}

function body(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({ business_id: "bus_test", type, timestamp: new Date().toISOString(), data });
}

let deliveryCounter = 0;
async function deliver(payload: string, id = `msg_dunning_${++deliveryCounter}`) {
  const ts = Math.floor(Date.now() / 1000);
  const req = new NextRequest("https://usecreatoros.co/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(payload, id, ts),
    },
  });
  const res = await POST(req);
  return { status: res.status, json: await res.json() };
}

function emailJobs(): Array<{ template: string; status: string }> {
  return all<{ template: string; status: string }>("SELECT template, status FROM email_jobs ORDER BY created_at");
}

function orgPlan(): string {
  return row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", TENANT)?.plan ?? "";
}

describe("subscription lifecycle emails from the webhook", () => {
  it("queues exactly one dunning email for a failed renewal", async () => {
    const payload = body("subscription.on_hold", {
      subscription_id: "sub_dun_1",
      status: "on_hold",
      next_billing_date: new Date(Date.now() - 86400000).toISOString(),
      currency: "usd",
      metadata: { tenantId: TENANT, plan: "creator" },
      customer: { customer_id: "cus_1", email: "owner@example.com" },
    });

    const first = await deliver(payload);
    expect(first.status).toBe(200);
    expect(emailJobs()).toHaveLength(1);
    expect(emailJobs()[0].template).toBe("subscription_payment_failed");
    // Grace keeps the plan.
    expect(orgPlan()).toBe("creator");
  });

  it("does not send a second reminder when the gateway redelivers the event", async () => {
    const payload = body("subscription.on_hold", {
      subscription_id: "sub_dun_2",
      status: "on_hold",
      next_billing_date: new Date(Date.now() - 86400000).toISOString(),
      currency: "usd",
      metadata: { tenantId: TENANT, plan: "creator" },
      customer: { customer_id: "cus_1", email: "owner@example.com" },
    });

    await deliver(payload, "msg_replay_1");
    const replay = await deliver(payload, "msg_replay_1");
    expect(replay.json.data).toMatchObject({ duplicate: true });

    // A different delivery id for the same failure is still the same message.
    await deliver(payload, "msg_replay_2");
    expect(emailJobs()).toHaveLength(1);
  });

  it("confirms a recovery instead of a dunning email when the card works again", async () => {
    const failed = body("subscription.on_hold", {
      subscription_id: "sub_dun_3",
      status: "on_hold",
      next_billing_date: new Date(Date.now() - 86400000).toISOString(),
      currency: "usd",
      metadata: { tenantId: TENANT, plan: "pro" },
      customer: { customer_id: "cus_1" },
    });
    await deliver(failed);

    const recovered = body("subscription.active", {
      subscription_id: "sub_dun_3",
      status: "active",
      next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: "usd",
      metadata: { tenantId: TENANT, plan: "pro" },
      customer: { customer_id: "cus_1" },
    });
    await deliver(recovered);

    const templates = emailJobs().map((j) => j.template);
    expect(templates).toEqual(["subscription_payment_failed", "subscription_payment_recovered"]);
    expect(orgPlan()).toBe("pro");
  });

  it("confirms a cancellation once", async () => {
    const payload = body("subscription.cancelled", {
      subscription_id: "sub_dun_4",
      status: "cancelled",
      metadata: { tenantId: TENANT },
    });
    await deliver(payload);
    await deliver(payload);

    expect(emailJobs()).toHaveLength(1);
    expect(emailJobs()[0].template).toBe("subscription_canceled");
    expect(orgPlan()).toBe("free");
  });
});
