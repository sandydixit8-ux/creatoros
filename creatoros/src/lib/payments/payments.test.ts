import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { mockProvider } from "./mock";
import { getPaymentProvider, getPaymentProviderForCurrency, paymentConfiguredForCurrency, providerByName, webhookProviders, cashfreeSdkMode, billingCurrency } from "./index";
import { cashfreeProvider } from "./cashfree-provider";
import { planIdFor, subscriptionIdFor, createSubscription, normalisePhone as cfPhone } from "./cashfree-subscriptions";

const CF_TEST_SECRET = "cf_secret_for_tests";
const CF_TS = "1617695238078";

describe("payment provider abstraction", () => {
  it("mock provider creates a checkout session carrying the session id", async () => {
    const session = await mockProvider.createCheckoutSession({
      lines: [{ title: "Test", amountCents: 1000, quantity: 1 }],
      currency: "usd",
      successUrl: "http://localhost:3000/api/store/checkout/success?order=ord_1",
      cancelUrl: "http://localhost:3000/",
      metadata: { orderId: "ord_1" },
    });
    expect(session.sessionId.startsWith("cs_mock_")).toBe(true);
    expect(session.url).toContain("session_id=" + session.sessionId);
    expect(await mockProvider.getCheckoutPaymentStatus(session.sessionId)).toBe("paid");
  });

  it("mock webhook parser accepts valid events and rejects garbage", async () => {
    const good = await mockProvider.verifyWebhook(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { id: "cs_x" } }),
      ""
    );
    expect(good?.id).toBe("evt_1");

    expect(await mockProvider.verifyWebhook("not-json", "")).toBeNull();
    expect(await mockProvider.verifyWebhook(JSON.stringify({ foo: 1 }), "")).toBeNull();
  });

  it("factory falls back to mock outside production when stripe is unconfigured", () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    const prevProvider = process.env.PAYMENT_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYMENT_PROVIDER;
    try {
      const provider = getPaymentProvider();
      expect(provider.name).toBe("mock");
      expect(provider.isConfigured()).toBe(true);
    } finally {
      if (prevKey !== undefined) process.env.STRIPE_SECRET_KEY = prevKey;
      if (prevProvider !== undefined) process.env.PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("factory picks cashfree when PAYMENT_PROVIDER=cashfree and keys exist", () => {
    const prev = {
      provider: process.env.PAYMENT_PROVIDER,
      id: process.env.CASHFREE_CLIENT_ID,
      secret: process.env.CASHFREE_SECRET_KEY,
    };
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
    try {
      expect(getPaymentProvider().name).toBe("cashfree");
    } finally {
      restoreEnv("PAYMENT_PROVIDER", prev.provider);
      restoreEnv("CASHFREE_CLIENT_ID", prev.id);
      restoreEnv("CASHFREE_SECRET_KEY", prev.secret);
    }
  });
});

describe("currency-based provider routing", () => {
  const keys = [
    "PAYMENT_PROVIDER",
    "CASHFREE_CLIENT_ID",
    "CASHFREE_SECRET_KEY",
    "CASHFREE_CURRENCIES",
    "STRIPE_SECRET_KEY",
    "STRIPE_CURRENCIES",
  ];
  const saved = new Map(keys.map((k) => [k, process.env[k]]));

  beforeEach(() => {
    for (const k of keys) delete process.env[k];
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
  });

  afterEach(() => {
    for (const k of keys) restoreEnv(k, saved.get(k));
  });

  it("keeps INR on Cashfree, its default settlement currency", () => {
    expect(getPaymentProviderForCurrency("inr").name).toBe("cashfree");
  });

  it("sends USD to Stripe when only Cashfree is configured", () => {
    // An INR-only Cashfree account rejects USD with
    // "order Currency not enabled for this merchant account".
    expect(cashfreeProvider.supportsCurrency("usd")).toBe(false);

    // With no Stripe key there is genuinely no USD gateway, so this must refuse
    // rather than hand back Cashfree. Returning Cashfree here once looked like a
    // safe fallback "so the route can report it", but it defeated that: the
    // billing route only checks that the returned provider is configured, so it
    // built a real Cashfree session for a USD amount and demanded a 10-digit
    // Indian mobile from the customer before the charge failed. Refusing makes
    // the route report its real, fixable problem instead.
    expect(getPaymentProviderForCurrency("usd").isConfigured()).toBe(false);
    expect(getPaymentProviderForCurrency("usd").name).toBe("unconfigured");

    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(getPaymentProviderForCurrency("usd").name).toBe("stripe");
    expect(getPaymentProviderForCurrency("INR").name).toBe("cashfree");
  });

  it("honours an explicit currency allowlist once Cashfree international is enabled", () => {
    process.env.CASHFREE_CURRENCIES = "inr,usd";
    expect(cashfreeProvider.supportsCurrency("usd")).toBe(true);
    expect(getPaymentProviderForCurrency("usd").name).toBe("cashfree");
  });

  it("resolves the provider recorded on an order for refunds and status checks", () => {
    expect(providerByName("cashfree")?.name).toBe("cashfree");
    expect(providerByName("stripe")?.name).toBe("stripe");
    expect(providerByName("")).toBeNull();
    expect(providerByName("nope")).toBeNull();
  });

  it("offers every configured gateway to the webhook endpoint", () => {
    expect(webhookProviders().map((p) => p.name)).toEqual(["cashfree"]);
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(webhookProviders().map((p) => p.name)).toEqual(["cashfree", "stripe"]);
  });
});


describe("cashfree webhook signature verification", () => {
  function sign(rawBody: string, timestamp: string): string {
    return createHmac("sha256", CF_TEST_SECRET).update(timestamp + rawBody).digest("base64");
  }

  it("accepts a correctly signed PAYMENT_SUCCESS event", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_SUCCESS",
      event_id: "evt_123",
      event_data: { order: { order_id: "ord_abc123", order_status: "PAID" } },
    });
    const ts = CF_TS;
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(body, sign(body, ts), ts));
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.id).toBe("evt_123");
    expect(event?.data.id).toBe("ord_abc123");
  });

  it("rejects a tampered body", async () => {
    const original = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_1", event_data: {} });
    const tampered = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_2", event_data: {} });
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(tampered, sign(original, CF_TS), CF_TS));
    expect(event).toBeNull();
  });

  it("rejects a wrong signature, wrong timestamp and missing headers", async () => {
    const body = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_3", event_data: {} });
    const out = await withSecret(async () => ({
      badSig: await cashfreeProvider.verifyWebhook(body, "not-a-signature", CF_TS),
      badTs: await cashfreeProvider.verifyWebhook(body, sign(body, CF_TS), "999"),
      missing: await cashfreeProvider.verifyWebhook(body, "", ""),
    }));
    expect(out.badSig).toBeNull();
    expect(out.badTs).toBeNull();
    expect(out.missing).toBeNull();
  });

  it("maps failed payments to the expired event so pending orders are closed", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_FAILED",
      event_id: "evt_4",
      event_data: { order: { order_id: "ord_fail", order_status: "FAILED" } },
    });
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(body, sign(body, CF_TS), CF_TS));
    expect(event?.type).toBe("checkout.session.expired");
  });
});

/**
 * Cashfree has a second, unrelated product called Payment Forms. It posts
 * `data.form` / `data.order` with no `event` and no `event_id` to the same
 * dashboard. Those payloads used to collapse onto a degenerate idempotency
 * key, so every later unidentifiable event looked like a duplicate and real
 * payments could be dropped silently.
 */
describe("cashfree Payment Forms payloads", () => {
  function post(raw: Record<string, unknown>) {
    const body = JSON.stringify(raw);
    const sig = createHmac("sha256", CF_TEST_SECRET).update(CF_TS + body).digest("base64");
    return withSecret(() => cashfreeProvider.verifyWebhook(body, sig, CF_TS));
  }

  const formsPayload = {
    data: {
      form: { form_id: "my-form-1", cf_form_id: 2011640, form_currency: "INR" },
      order: {
        order_amount: 22,
        order_id: "CFPay_U1mgll3c0e9g_ehdcjjbtckf",
        order_status: "PAID",
      },
    },
    event_time: "2021-04-16T14:10:36+05:30",
    type: "PAYMENT_FORM_ORDER_WEBHOOK",
  };

  it("rejects a Payment Forms payload instead of inventing an event id", async () => {
    expect(await post(formsPayload)).toBeNull();
  });

  it("rejects any payload that is not a Payment Gateway event", async () => {
    expect(await post({ type: "SOMETHING_ELSE", data: {} })).toBeNull();
    expect(await post({ event: "" })).toBeNull();
  });

  it("still accepts real Payment Gateway events", async () => {
    const event = await post({
      event: "PAYMENT_SUCCESS",
      event_id: "pg_ok_1",
      event_data: { order: { order_id: "ord_1", order_status: "PAID" } },
    });
    expect(event?.id).toBe("pg_ok_1");
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.data.id).toBe("ord_1");
  });
});

describe("cashfree subscription webhooks", () => {
  function subEvent(subscription: Record<string, unknown>, eventId: string, event = "SUBSCRIPTION_STATUS_CHANGED") {

    const body = JSON.stringify({ event, event_id: eventId, event_data: { subscription } });
    const sig = createHmac("sha256", CF_TEST_SECRET).update(CF_TS + body).digest("base64");
    return { body, sig, ts: CF_TS };
  }

  function verify(subscription: Record<string, unknown>, eventId: string, event?: string) {
    const s = subEvent(subscription, eventId, event);
    return withSecret(() => cashfreeProvider.verifyWebhook(s.body, s.sig, s.ts));
  }

  it("carries subscription_tags through as metadata so tenants can be mapped", async () => {
    const event = await verify(
      {
        subscription_id: "sub_org1_creator_abc",
        subscription_status: "ACTIVE",
        next_schedule_date: "2026-10-30T09:00:00+05:30",
        customer_details: { customer_email: "buyer@example.com" },
        subscription_tags: { tenantId: "org1", plan: "creator" },
      },
      "sub_evt_1"
    );
    expect(event?.type).toBe("customer.subscription.updated");
    expect(event?.data.status).toBe("active");
    expect(event?.data.metadata).toEqual({ tenantId: "org1", plan: "creator" });
    expect(event?.data.subscription).toBe("sub_org1_creator_abc");
    expect(event?.data.currentPeriodEnd).toBe("2026-10-30T09:00:00+05:30");
  });

  it.each([
    ["CANCELLED", "customer.subscription.deleted", "canceled"],
    ["CUSTOMER_CANCELLED", "customer.subscription.deleted", "canceled"],
    ["EXPIRED", "customer.subscription.deleted", "canceled"],
    ["COMPLETED", "customer.subscription.deleted", "canceled"],
    ["LINK_EXPIRED", "customer.subscription.deleted", "canceled"],
    ["ON_HOLD", "customer.subscription.updated", "past_due"],
    ["ACTIVE", "customer.subscription.updated", "active"],
  ])("maps subscription status %s to %s/%s", async (cfStatus, expectedType, expectedStatus) => {
    const event = await verify(
      { subscription_id: "sub_x", subscription_status: cfStatus, subscription_tags: { tenantId: "t", plan: "pro" } },
      `sub_evt_${cfStatus}`
    );
    expect(event?.type).toBe(expectedType);
    expect(event?.data.status).toBe(expectedStatus);
  });

  it("flags a failed recurring charge as past_due instead of active", async () => {
    const event = await verify(
      { subscription_id: "sub_y", subscription_status: "ACTIVE", subscription_tags: { tenantId: "t", plan: "pro" } },
      "sub_evt_fail",
      "SUBSCRIPTION_PAYMENT_FAILED"
    );
    expect(event?.type).toBe("customer.subscription.updated");
    expect(event?.data.status).toBe("past_due");
  });

  it("never treats a subscription event as an order fulfilment", async () => {
    const event = await verify({ subscription_id: "sub_z", subscription_status: "ACTIVE" }, "sub_evt_guard");
    expect(event?.type).not.toBe("checkout.session.completed");
  });

  it("passes through subscription_tags even when empty", async () => {
    const event = await verify({ subscription_id: "sub_q", subscription_status: "ACTIVE" }, "sub_evt_empty");
    expect(event?.data.metadata).toEqual({});
  });
});

describe("cashfree subscription helpers", () => {
  it("builds plan ids that satisfy the Cashfree charset and length limit", () => {
    expect(planIdFor("creator")).toBe("creatoros_creator_inr");
    expect(planIdFor("Weird Plan!!")).toBe("creatoros_weirdplan_inr");
    expect(planIdFor("x".repeat(80)).length).toBeLessThanOrEqual(40);
  });

  /**
   * Cashfree plans are permanently priced in the currency they were created
   * with, so the id has to encode the currency. Otherwise a USD checkout
   * silently reuses the existing INR plan and charges the wrong amount.
   */
  it("encodes the currency in the plan id", () => {
    expect(planIdFor("creator", "USD")).toBe("creatoros_creator_usd");
    expect(planIdFor("creator", "inr")).toBe("creatoros_creator_inr");
    expect(planIdFor("creator", "USD")).not.toBe(planIdFor("creator", "INR"));
  });

  it("builds unique subscription ids that carry tenant and plan", () => {
    const a = subscriptionIdFor("org1", "pro");
    const b = subscriptionIdFor("org1", "pro");
    expect(a).not.toBe(b);
    expect(a.startsWith("sub_org1_pro_")).toBe(true);
  });

  it("keeps long or unsafe tenant ids inside the documented 250 char limit", () => {
    const id = subscriptionIdFor("org with spaces and a very long name ".repeat(5), "pro");
    expect(id.length).toBeLessThanOrEqual(250);
    expect(id.startsWith("sub_")).toBe(true);
  });

  it("normalises Indian phone numbers and rejects unusable ones", () => {
    expect(cfPhone("9876543210")).toBe("9876543210");
    expect(cfPhone("+91 98765 43210")).toBe("9876543210");
    expect(cfPhone("09876543210")).toBe("9876543210");
    expect(cfPhone("12345")).toBeUndefined();
    expect(cfPhone(undefined)).toBeUndefined();
  });
});

/**
 * Cashfree returns no authorisation URL: mandate checkout is started in the
 * browser with `subscriptionsCheckout({ subsSessionId })`, so the API layer
 * must surface `subscription_session_id` and nothing else.
 */
describe("cashfree createSubscription", () => {
  const baseArgs = {
    subscriptionId: "sub_org1_creator_abc",
    planId: "creatoros_creator",
    customerEmail: "buyer@example.com",
    returnUrl: "https://usecreatoros.co/app/billing?upgraded=creator",
    tags: { tenantId: "org1", plan: "creator" },
  };

  async function withFetch<T>(
    response: unknown,
    fn: (call: { path: string; body: Record<string, unknown> }) => Promise<T>
  ): Promise<{ call: { path: string; body: Record<string, unknown> }; result: T }> {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        path: String(input),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const result = await fn(calls[0]!);
      return { call: calls[0]!, result };
    } finally {
      globalThis.fetch = original;
    }
  }

  it("returns the subscription_session_id for client-side authorisation", async () => {
    const { result } = await withFetch(
      {
        subscription_id: "sub_org1_creator_abc",
        subscription_session_id: "sub_session_abc123payment",
        subscription_status: "INITIALIZED",
      },
      () =>
        createSubscription({
          ...baseArgs,
          customerPhone: "+91 98765 43210",
        })
    );

    expect(result).toEqual({
      subscriptionId: "sub_org1_creator_abc",
      sessionId: "sub_session_abc123payment",
      status: "INITIALIZED",
    });
  });

  it("sends only the plan id and a normalised phone so the mandate matches the plan", async () => {
    const { call } = await withFetch(
      { subscription_id: "sub_org1_creator_abc", subscription_session_id: "sub_session_xpayment", subscription_status: "INITIALIZED" },
      () => createSubscription({ ...baseArgs, customerPhone: "+91 98765 43210" })
    );

    expect(call.path).toContain("/subscriptions");
    const details = call.body.customer_details as Record<string, unknown>;
    expect(details.customer_phone).toBe("9876543210");
    expect(call.body.plan_details).toEqual({ plan_id: "creatoros_creator", plan_type: "PERIODIC" });
    // No invented redirect target: Cashfree has no hosted URL for mandates.
    expect(call.body.auth_link).toBeUndefined();
  });

  /**
   * Cashfree answers HTTP 400 "customer_details.customer_name : should be a
   * person name" when the name is an email, which broke every checkout whose
   * account had no display name.
   */
  it("never sends an email address as the customer name", async () => {
    const withName = await withFetch(
      { subscription_id: "sub_org1_creator_abc", subscription_session_id: "sub_session_xpayment", subscription_status: "INITIALIZED" },
      () => createSubscription({ ...baseArgs, customerName: "Asha Rao" })
    );
    expect((withName.call.body.customer_details as Record<string, unknown>).customer_name).toBe("Asha Rao");

    // No name supplied: the email must not be backfilled into customer_name.
    const noName = await withFetch(
      { subscription_id: "sub_org1_creator_abc", subscription_session_id: "sub_session_xpayment", subscription_status: "INITIALIZED" },
      () => createSubscription(baseArgs)
    );
    const details = noName.call.body.customer_details as Record<string, unknown>;
    expect(details.customer_name).toBeUndefined();
    expect(details.customer_email).toBe("buyer@example.com");
  });

  it("fails loudly when Cashfree returns no session id", async () => {
    await expect(
      withFetch({ subscription_id: "sub_org1_creator_abc", subscription_status: "INITIALIZED" }, () =>
        createSubscription(baseArgs)
      )
    ).rejects.toThrow(/subscription_session_id/);

  });
});

describe("cashfree sdk mode", () => {
  it("mirrors the server environment for the browser SDK", () => {
    const prev = process.env.CASHFREE_ENV;
    try {
      process.env.CASHFREE_ENV = "live";
      expect(cashfreeSdkMode()).toBe("production");
      process.env.CASHFREE_ENV = "sandbox";
      expect(cashfreeSdkMode()).toBe("sandbox");
      delete process.env.CASHFREE_ENV;
      expect(cashfreeSdkMode()).toBe("sandbox");
    } finally {
      restoreEnv("CASHFREE_ENV", prev);
    }
  });
});

describe("billing currency", () => {
  it("defaults to USD and honours BILLING_CURRENCY", () => {
    const prev = process.env.BILLING_CURRENCY;
    try {
      delete process.env.BILLING_CURRENCY;
      expect(billingCurrency()).toBe("usd");
      process.env.BILLING_CURRENCY = "inr";
      expect(billingCurrency()).toBe("inr");
      process.env.BILLING_CURRENCY = "INR";
      expect(billingCurrency()).toBe("inr");
      process.env.BILLING_CURRENCY = "usd";
      expect(billingCurrency()).toBe("usd");
      // Unknown values must not silently become rupees.
      process.env.BILLING_CURRENCY = "eur";
      expect(billingCurrency()).toBe("usd");
    } finally {
      restoreEnv("BILLING_CURRENCY", prev);
    }
  });
});

describe("currency routing guard", () => {
  /**
   * USD billed with no USD-capable gateway: BILLING_CURRENCY=usd,
   * PAYMENT_PROVIDER=cashfree, Stripe unconfigured, Cashfree at its default
   * INR-only currency list. This used to resolve to Cashfree, which put a
   * 10-digit Indian mobile field in front of a US customer and then failed the
   * charge. It must refuse instead.
   *
   * Production went the other way (BILLING_CURRENCY set to inr) because this
   * account rejects USD plans; the refusal path still has to hold for the day a
   * second currency is turned on without a gateway behind it.
   */
  it("refuses to route USD to an INR-only Cashfree when Stripe is absent", () => {
    const prev = {
      provider: process.env.PAYMENT_PROVIDER,
      cfId: process.env.CASHFREE_CLIENT_ID,
      cfSecret: process.env.CASHFREE_SECRET_KEY,
      cfCurrencies: process.env.CASHFREE_CURRENCIES,
      stripeKey: process.env.STRIPE_SECRET_KEY,
    };
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
    delete process.env.CASHFREE_CURRENCIES;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const provider = getPaymentProviderForCurrency("usd");
      expect(provider.isConfigured()).toBe(false);
      expect(provider.supportsCurrency("usd")).toBe(false);
      expect(provider.requiresCustomerPhone).toBe(false);
      expect(paymentConfiguredForCurrency("usd")).toBe(false);
    } finally {
      restoreEnv("PAYMENT_PROVIDER", prev.provider);
      restoreEnv("CASHFREE_CLIENT_ID", prev.cfId);
      restoreEnv("CASHFREE_SECRET_KEY", prev.cfSecret);
      restoreEnv("CASHFREE_CURRENCIES", prev.cfCurrencies);
      restoreEnv("STRIPE_SECRET_KEY", prev.stripeKey);
    }
  });

  it("never returns a provider that cannot settle the requested currency", () => {
    const prev = {
      provider: process.env.PAYMENT_PROVIDER,
      cfId: process.env.CASHFREE_CLIENT_ID,
      cfSecret: process.env.CASHFREE_SECRET_KEY,
      cfCurrencies: process.env.CASHFREE_CURRENCIES,
      stripeKey: process.env.STRIPE_SECRET_KEY,
    };
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
    process.env.CASHFREE_CURRENCIES = "inr";
    delete process.env.STRIPE_SECRET_KEY;
    try {
      for (const currency of ["usd", "gbp", "eur"]) {
        expect(getPaymentProviderForCurrency(currency).supportsCurrency(currency)).toBe(false);
      }
      // INR is genuinely supported, so it must still route to Cashfree.
      expect(getPaymentProviderForCurrency("inr").name).toBe("cashfree");
    } finally {
      restoreEnv("PAYMENT_PROVIDER", prev.provider);
      restoreEnv("CASHFREE_CLIENT_ID", prev.cfId);
      restoreEnv("CASHFREE_SECRET_KEY", prev.cfSecret);
      restoreEnv("CASHFREE_CURRENCIES", prev.cfCurrencies);
      restoreEnv("STRIPE_SECRET_KEY", prev.stripeKey);
    }
  });

  it("routes USD to Stripe when Stripe is configured and Cashfree is INR-only", () => {
    const prev = {
      provider: process.env.PAYMENT_PROVIDER,
      cfId: process.env.CASHFREE_CLIENT_ID,
      cfSecret: process.env.CASHFREE_SECRET_KEY,
      cfCurrencies: process.env.CASHFREE_CURRENCIES,
      stripeKey: process.env.STRIPE_SECRET_KEY,
    };
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
    process.env.CASHFREE_CURRENCIES = "inr";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    try {
      expect(getPaymentProviderForCurrency("usd").name).toBe("stripe");
      expect(getPaymentProviderForCurrency("inr").name).toBe("cashfree");
      expect(paymentConfiguredForCurrency("usd")).toBe(true);
    } finally {
      restoreEnv("PAYMENT_PROVIDER", prev.provider);
      restoreEnv("CASHFREE_CLIENT_ID", prev.cfId);
      restoreEnv("CASHFREE_SECRET_KEY", prev.cfSecret);
      restoreEnv("CASHFREE_CURRENCIES", prev.cfCurrencies);
      restoreEnv("STRIPE_SECRET_KEY", prev.stripeKey);
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {

  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CASHFREE_SECRET_KEY;
  process.env.CASHFREE_SECRET_KEY = CF_TEST_SECRET;
  try {
    return await fn();
  } finally {
    restoreEnv("CASHFREE_SECRET_KEY", prev);
  }
}
