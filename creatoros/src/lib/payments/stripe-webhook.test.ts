import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { stripeProvider } from "./stripe-provider";

/**
 * The Stripe signature path had no coverage at all: every webhook test in the
 * repo ran through mockProvider, so "Stripe webhook verification works" was an
 * assumption inherited from the SDK. These build real HMAC-SHA256 signatures so
 * the verification is exercised rather than trusted.
 */

const SECRET = "whsec_test_signing_secret";
const KEY = "sk_test_placeholder_key";
const NOW = Math.floor(Date.now() / 1000);

function sign(payload: string, timestamp: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

const EVENT_BODY = JSON.stringify({
  id: "evt_test_123",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_abc", object: "checkout.session" } },
});

describe("stripe webhook signature verification", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = KEY;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed event and surfaces id, type and data", async () => {
    const event = await stripeProvider.verifyWebhook(EVENT_BODY, sign(EVENT_BODY, NOW));
    expect(event).not.toBeNull();
    expect(event?.id).toBe("evt_test_123");
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.data.id).toBe("cs_test_abc");
  });

  it("rejects a signature produced with a different secret", async () => {
    const forged = await stripeProvider.verifyWebhook(EVENT_BODY, sign(EVENT_BODY, NOW, "whsec_wrong_secret"));
    expect(forged).toBeNull();
  });

  it("rejects a body that was not the one signed", async () => {
    const signature = sign(EVENT_BODY, NOW);
    const tampered = EVENT_BODY.replace("cs_test_abc", "cs_test_attacker");
    const event = await stripeProvider.verifyWebhook(tampered, signature);
    expect(event).toBeNull();
  });

  it("rejects a replayed signature outside the 300s tolerance", async () => {
    const stale = sign(EVENT_BODY, NOW - 1000);
    expect(await stripeProvider.verifyWebhook(EVENT_BODY, stale)).toBeNull();
  });

  it("rejects a signature with no timestamp or no v1 component", async () => {
    expect(await stripeProvider.verifyWebhook(EVENT_BODY, `v1=${"0".repeat(64)}`)).toBeNull();
    expect(await stripeProvider.verifyWebhook(EVENT_BODY, `t=${NOW}`)).toBeNull();
    expect(await stripeProvider.verifyWebhook(EVENT_BODY, "")).toBeNull();
  });

  it("accepts when one of several v1 signatures matches, as during key rotation", async () => {
    const good = createHmac("sha256", SECRET).update(`${NOW}.${EVENT_BODY}`).digest("hex");
    const rotated = createHmac("sha256", "whsec_previous").update(`${NOW}.${EVENT_BODY}`).digest("hex");
    const event = await stripeProvider.verifyWebhook(EVENT_BODY, `t=${NOW},v1=${rotated},v1=${good}`);
    expect(event?.id).toBe("evt_test_123");
  });

  it("returns null when the signing secret is missing rather than accepting anything", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const event = await stripeProvider.verifyWebhook(EVENT_BODY, sign(EVENT_BODY, NOW));
    expect(event).toBeNull();
  });

  it("returns null when the API key is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const event = await stripeProvider.verifyWebhook(EVENT_BODY, sign(EVENT_BODY, NOW));
    expect(event).toBeNull();
  });
});

describe("stripe currency support", () => {
  afterEach(() => {
    delete process.env.STRIPE_CURRENCIES;
  });

  it("defaults to USD only", () => {
    delete process.env.STRIPE_CURRENCIES;
    expect(stripeProvider.supportsCurrency("usd")).toBe(true);
    expect(stripeProvider.supportsCurrency("USD")).toBe(true);
    expect(stripeProvider.supportsCurrency("inr")).toBe(false);
  });

  it("honours an explicit STRIPE_CURRENCIES list", () => {
    process.env.STRIPE_CURRENCIES = "usd,gbp";
    expect(stripeProvider.supportsCurrency("gbp")).toBe(true);
    expect(stripeProvider.supportsCurrency("inr")).toBe(false);
  });
});