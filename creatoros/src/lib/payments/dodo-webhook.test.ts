import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { dodoProvider, mapDodoEvent, dodoProductId } from "./dodo-provider";

/**
 * Dodo signs webhooks with the Standard Webhooks scheme: an HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${rawBody}` keyed by the base64-decoded
 * `whsec_` secret. These tests build real signatures so the verification and
 * the event mapping are exercised rather than assumed.
 */

const RAW_SECRET = "dodo_test_signing_secret";
const SECRET = `whsec_${Buffer.from(RAW_SECRET).toString("base64")}`;
const KEY = "dodo_test_api_key";
const DELIVERY_ID = "msg_test_123";
const NOW = Math.floor(Date.now() / 1000);

function sign(payload: string, id = DELIVERY_ID, timestamp = NOW, raw = RAW_SECRET): string {
  const sig = createHmac("sha256", raw).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return `v1,${sig}`;
}

const PAYMENT_BODY = JSON.stringify({
  business_id: "bus_test",
  type: "payment.succeeded",
  timestamp: "2026-10-11T00:00:00Z",
  data: {
    payment_id: "pay_abc",
    subscription_id: null,
    metadata: { orderId: "ord_1", tenantId: "t1" },
    customer: { customer_id: "cus_1", email: "buyer@example.com" },
  },
});

const SUB_BODY = JSON.stringify({
  business_id: "bus_test",
  type: "subscription.active",
  timestamp: "2026-10-11T00:00:00Z",
  data: {
    subscription_id: "sub_abc",
    status: "active",
    next_billing_date: "2026-11-11T00:00:00Z",
    currency: "USD",
    metadata: { tenantId: "t1", plan: "creator" },
    customer: { customer_id: "cus_1", email: "buyer@example.com" },
  },
});

describe("dodo webhook signature verification", () => {
  beforeEach(() => {
    process.env.DODO_PAYMENTS_API_KEY = KEY;
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = SECRET;
  });

  afterEach(() => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  });

  it("accepts a correctly signed event and surfaces id, type and data", async () => {
    const event = await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY), String(NOW), DELIVERY_ID);
    expect(event).not.toBeNull();
    expect(event?.id).toBe(DELIVERY_ID);
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.data.mode).toBe("payment");
    expect((event?.data.metadata as Record<string, unknown>).orderId).toBe("ord_1");
  });

  it("rejects a signature produced with a different secret", async () => {
    const forged = await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY, undefined, undefined, "wrong_secret"), String(NOW), DELIVERY_ID);
    expect(forged).toBeNull();
  });

  it("rejects a body that was not the one signed", async () => {
    const signature = sign(PAYMENT_BODY);
    const tampered = PAYMENT_BODY.replace("ord_1", "ord_attacker");
    expect(await dodoProvider.verifyWebhook(tampered, signature, String(NOW), DELIVERY_ID)).toBeNull();
  });

  it("rejects a replayed signature outside the tolerance window", async () => {
    const stale = sign(PAYMENT_BODY, DELIVERY_ID, NOW - 1000);
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, stale, String(NOW - 1000), DELIVERY_ID)).toBeNull();
  });

  it("rejects a signature if the delivery id differs from the one signed", async () => {
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY), String(NOW), "msg_other")).toBeNull();
  });

  it("accepts when one of several signatures matches, as during rotation", async () => {
    const good = createHmac("sha256", RAW_SECRET).update(`${DELIVERY_ID}.${NOW}.${PAYMENT_BODY}`).digest("base64");
    const rotated = createHmac("sha256", "previous_secret").update(`${DELIVERY_ID}.${NOW}.${PAYMENT_BODY}`).digest("base64");
    const event = await dodoProvider.verifyWebhook(PAYMENT_BODY, `v1,${rotated} v1,${good}`, String(NOW), DELIVERY_ID);
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("returns null when the signing secret is missing rather than accepting anything", async () => {
    delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY), String(NOW), DELIVERY_ID)).toBeNull();
  });

  it("returns null when the delivery id, signature or timestamp is absent", async () => {
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY), String(NOW), "")).toBeNull();
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, "", String(NOW), DELIVERY_ID)).toBeNull();
    expect(await dodoProvider.verifyWebhook(PAYMENT_BODY, sign(PAYMENT_BODY), "", DELIVERY_ID)).toBeNull();
  });
});

describe("dodo event mapping", () => {
  it("maps subscription.active to an active subscription update", () => {
    const event = mapDodoEvent("msg_1", "subscription.active", JSON.parse(SUB_BODY).data);
    expect(event.type).toBe("customer.subscription.updated");
    expect(event.data.id).toBe("sub_abc");
    expect(event.data.status).toBe("active");
    expect(event.data.currentPeriodEnd).toBe("2026-11-11T00:00:00Z");
    expect((event.data.metadata as Record<string, unknown>).plan).toBe("creator");
  });

  it("maps subscription.cancelled to a deleted subscription", () => {
    const event = mapDodoEvent("msg_2", "subscription.cancelled", { subscription_id: "sub_abc", metadata: {} });
    expect(event.type).toBe("customer.subscription.deleted");
    expect(event.data.status).toBe("canceled");
  });

  it("maps subscription.on_hold to a past_due update, keeping access recoverable", () => {
    const event = mapDodoEvent("msg_3", "subscription.on_hold", { subscription_id: "sub_abc", metadata: {} });
    expect(event.type).toBe("customer.subscription.updated");
    expect(event.data.status).toBe("past_due");
  });

  it("maps subscription.failed to a terminal deleted (no access on failed mandate)", () => {
    const event = mapDodoEvent("msg_4", "subscription.failed", { subscription_id: "sub_abc", metadata: {} });
    expect(event.type).toBe("customer.subscription.deleted");
  });

  it("maps payment.failed to an expired checkout so the pending order is closed", () => {
    const event = mapDodoEvent("msg_5", "payment.failed", { payment_id: "pay_x", metadata: { orderId: "ord_9" } });
    expect(event.type).toBe("checkout.session.expired");
    expect(event.data.id).toBe("pay_x");
  });

  it("passes unknown events through namespaced rather than guessing", () => {
    const event = mapDodoEvent("msg_6", "dispute.opened", { foo: "bar" });
    expect(event.type).toBe("dodo.dispute.opened");
  });
});

describe("dodo provider configuration", () => {
  afterEach(() => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    delete process.env.DODO_CURRENCIES;
    delete process.env.DODO_PRODUCT_CREATOR;
  });

  it("is unconfigured without an API key", () => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    expect(dodoProvider.isConfigured()).toBe(false);
  });

  it("defaults to usd, gbp and eur", () => {
    delete process.env.DODO_CURRENCIES;
    expect(dodoProvider.supportsCurrency("usd")).toBe(true);
    expect(dodoProvider.supportsCurrency("GBP")).toBe(true);
    expect(dodoProvider.supportsCurrency("eur")).toBe(true);
    expect(dodoProvider.supportsCurrency("inr")).toBe(false);
  });

  it("honours an explicit DODO_CURRENCIES list", () => {
    process.env.DODO_CURRENCIES = "usd";
    expect(dodoProvider.supportsCurrency("gbp")).toBe(false);
    expect(dodoProvider.supportsCurrency("usd")).toBe(true);
  });

  it("resolves a plan product id from DODO_PRODUCT_<PLANKEY>", () => {
    process.env.DODO_PRODUCT_CREATOR = "pdt_creator_123";
    expect(dodoProductId("creator")).toBe("pdt_creator_123");
    expect(dodoProductId("starter")).toBe("");
  });
});
