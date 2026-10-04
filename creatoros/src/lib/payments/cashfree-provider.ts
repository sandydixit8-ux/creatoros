import crypto from "node:crypto";
import type { PaymentProvider, CheckoutSessionResult, PaymentStatus, ProviderWebhookEvent } from "./types";
import {
  subscriptionsConfigured,
  ensurePlan,
  createSubscription,
  cancelSubscriptionRemote,
  subscriptionIdFor,
  normalisePhone,
} from "./cashfree-subscriptions";

/**
 * Cashfree Payments (PG) provider.
 *
 * Cashfree differs from Stripe in three ways that matter here:
 *  - amounts are in MAJOR units (rupees), not cents
 *  - a checkout is an "order" whose id doubles as our provider session id
 *  - webhooks are HMAC-SHA256 over `x-webhook-timestamp + rawBody`
 *
 * Env:
 *   CASHFREE_CLIENT_ID     - app id (Credentials → API Keys)
 *   CASHFREE_SECRET_KEY    - secret key (server only, never expose)
 *   CASHFREE_ENV           - "sandbox" (default) | "live"
 *   CASHFREE_API_VERSION   - defaults to 2025-01-01
 *   CASHFREE_PAYMENT_METHODS - defaults to "cc,dc,upi,nb"
 *   CASHFREE_CURRENCIES - currencies this merchant account can settle,
 *                          defaults to "inr" (India-domestic accounts are
 *                          INR-only; add "usd" once international is enabled)
 */

const API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";
const PAYMENT_METHODS = process.env.CASHFREE_PAYMENT_METHODS || "cc,dc,upi,nb";

/** Read lazily so a config change (or a test) does not need a module reload. */
function currencies(): string[] {
  return (process.env.CASHFREE_CURRENCIES || "inr")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function sandbox(): boolean {
  return (process.env.CASHFREE_ENV || "sandbox").toLowerCase() !== "live";
}

function baseUrl(): string {
  return sandbox() ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
}

function clientId(): string {
  return process.env.CASHFREE_CLIENT_ID || "";
}

function secretKey(): string {
  return process.env.CASHFREE_SECRET_KEY || "";
}

function configured(): boolean {
  return clientId().length > 0 && secretKey().length > 0;
}

interface CfResponse {
  order_id?: string;
  order_status?: string;
  order_amount?: number;
  order_currency?: string;
  payment_session_id?: string;
  payment_url?: string;
  refund_id?: string;
  message?: string;
  error?: { message?: string };
}

async function call<T extends CfResponse>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId(),
      "x-client-secret": secretKey(),
      "x-api-version": API_VERSION,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await res.text();
  let data: CfResponse = {};
  try {
    data = text ? (JSON.parse(text) as CfResponse) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }

  if (!res.ok) {
    const reason = data.error?.message || data.message || `HTTP ${res.status}`;
    throw new Error(`Cashfree error (${res.status}): ${reason}`);
  }
  return data as T;
}

/** Cashfree wants major units; the rest of the app stores cents. */
function toMajorUnits(amountCents: number): number {
  return Math.round((amountCents / 100) * 100) / 100;
}

/**
 * Cashfree requires `customer_name` to be a person name and answers HTTP 400
 * with "should be a person name" when given an email address. So drop anything
 * that is not name-like instead of sending a value that will be rejected.
 */
function cashfreePersonName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const name = raw.trim().slice(0, 100);
  if (!name || name.includes("@")) return undefined;
  return name;
}

function toIso(currency: string): string {
  return currency.toLowerCase() === "inr" ? "INR" : currency.toUpperCase();
}

/** order_id must be 3-45 chars of [A-Za-z0-9_-]. */
function safeOrderId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 45);
  return cleaned.length >= 3 ? cleaned : `cf_${Date.now().toString(36)}`;
}

/**
 * Cashfree rejects `customer_details.customer_id` with HTTP 400
 * `customer_details.customer_id_invalid` unless it is alphanumeric and may
 * contain only underscores or hyphens, so an email address cannot be sent as
 * the id. Strip the disallowed characters and fall back to a stable hash when
 * nothing usable is left, keeping the value the same for the same email.
 */
export function cashfreeCustomerId(email?: string): string {
  const source = (email || "").trim().toLowerCase();
  if (!source) return "guest";
  const cleaned = source.replace(/[^a-z0-9_-]/g, "").slice(0, 100);
  return cleaned.length >= 3 ? cleaned : `cust_${crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

/**
 * Cashfree's create-order response has no `payment_url`: it returns
 * `payment_session_id`, and the hosted checkout link is assembled from it
 * (`payments.cashfree.com` live, `payments-test.cashfree.com` sandbox).
 */
export function cashfreeCheckoutUrl(paymentSessionId: string, orderId: string): string {
  const host = sandbox() ? "https://payments-test.cashfree.com" : "https://payments.cashfree.com";
  return `${host}/checkout?payment_session_id=${encodeURIComponent(paymentSessionId)}&order_id=${encodeURIComponent(orderId)}`;
}

interface CreateOrderArgs {
  orderId: string;
  amountCents: number;
  currency: string;
  title: string;
  successUrl: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata: Record<string, string>;
}

async function createOrder(args: CreateOrderArgs): Promise<CheckoutSessionResult> {
  const orderId = safeOrderId(args.orderId);

  const returnUrl = args.successUrl.includes("{order_id}")
    ? args.successUrl
    : `${args.successUrl}${args.successUrl.includes("?") ? "&" : "?"}cf_order_id={order_id}`;

  const data = await call<CfResponse>("/orders", {
    method: "POST",
    body: {
      order_id: orderId,
      order_amount: toMajorUnits(args.amountCents),
      order_currency: toIso(args.currency),
      order_note: args.title.slice(0, 200),
      customer_details: {
        customer_id: cashfreeCustomerId(args.customerEmail),
        customer_email: args.customerEmail || undefined,
        customer_phone: args.customerPhone,
      },
      order_meta: {
        return_url: returnUrl,
        payment_methods: PAYMENT_METHODS,
      },
    },
  });

  const paymentUrl =
    data.payment_url ||
    (data.payment_session_id ? cashfreeCheckoutUrl(data.payment_session_id, data.order_id || orderId) : "");
  if (!paymentUrl) {
    throw new Error("Cashfree did not return a payment URL");
  }

  // order_id doubles as the provider session id so the webhook can fulfil by session.
  return { sessionId: data.order_id || orderId, url: paymentUrl };
}

export const cashfreeProvider: PaymentProvider = {
  name: "cashfree",

  isConfigured: configured,

  requiresCustomerPhone: true,

  supportsCurrency: (currency) => currencies().includes((currency || "").trim().toLowerCase()),

  async createCustomer({ email }) {
    // Cashfree has no customer-create endpoint; customer_details.customer_id
    // carries our own identifier, and Cashfree only accepts an alphanumeric
    // (plus `_`/`-`) value there, so the email is normalised by
    // cashfreeCustomerId rather than sent verbatim.
    return { customerId: cashfreeCustomerId(email) };
  },

  async createCheckoutSession({ lines, currency, successUrl, customerEmail, customerPhone, metadata }) {
    const amountCents = lines.reduce((sum, l) => sum + l.amountCents * l.quantity, 0);
    const title = lines.map((l) => l.title).join(", ");
    return createOrder({
      orderId: metadata.orderId || `cf_${Date.now().toString(36)}`,
      amountCents,
      currency,
      title,
      successUrl,
      customerEmail,
      customerPhone: normalisePhone(customerPhone),
      metadata,
    });
  },

  async createSubscriptionSession({ planKey, planName, amountCents, currency, successUrl, customerEmail, customerName, customerPhone, metadata }) {
    if (!subscriptionsConfigured()) throw new Error("Cashfree credentials are missing");

    // Plans are merchant-level objects, so create-on-demand and reuse afterwards.
    const { planId } = await ensurePlan({ planKey, planName, amountCents, currency });

    const tenantId = metadata.tenantId || "unknown";
    const subscriptionId = subscriptionIdFor(tenantId, planKey);

    // Cashfree rejects an email in `customer_name` (400 "should be a person
    // name"), so a missing name is passed through as undefined rather than
    // being backfilled with the email address.
    const created = await createSubscription({
      subscriptionId,
      planId,
      customerEmail: customerEmail || "",
      customerName: cashfreePersonName(customerName),
      customerPhone: normalisePhone(customerPhone),
      returnUrl: successUrl,
      tags: { tenantId, plan: planKey },
    });

    return {
      subscriptionId: created.subscriptionId,
      sessionId: created.sessionId,
    };
  },

  async cancelSubscription(providerId) {
    if (!subscriptionsConfigured()) throw new Error("Cashfree credentials are missing");
    await cancelSubscriptionRemote(providerId);
    return { subscriptionId: providerId };
  },

  async verifyWebhook(rawBody, signature, timestamp) {
    const secret = secretKey();
    if (!secret || !signature || !timestamp) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(timestamp + rawBody)
      .digest("base64");

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    // Map Cashfree's envelope onto the shape the webhook route already handles.
    const eventData = (parsed.event_data || {}) as Record<string, unknown>;
    const order = (eventData.order || {}) as Record<string, unknown>;
    const payment = (eventData.payment || {}) as Record<string, unknown>;
    const subscription = (eventData.subscription || {}) as Record<string, unknown>;
    const cashfreeEvent = String(parsed.event || "");

    // Only Payment Gateway webhooks carry `event`; Payment Forms posts a
    // different envelope (data.form / data.order, no event id) to the same
    // dashboard. Those cannot be mapped onto an order or subscription, so
    // reject them instead of guessing an id.
    if (!cashfreeEvent) return null;

    // Cashfree always sends event_id. If it is somehow absent, derive a stable
    // id from the payload hash rather than building a degenerate key that would
    // collide with other unidentifiable events and cause a real payment to be
    // silently dropped as a duplicate.
    const eventId = String(
      parsed.event_id ||
        `cf_derived_${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`
    );

    // Subscription webhooks arrive on the same endpoint; route them separately.
    if (cashfreeEvent.startsWith("SUBSCRIPTION_")) {
      return mapSubscriptionEvent(cashfreeEvent, eventId, subscription, eventData);
    }

    // The webhook route fulfils orders by `event.data.id`, which must be the
    // order id (our provider_session_id). The event id is used for idempotency.
    const base = {
      id: String(order.order_id ?? payment.payment_id ?? eventId),
      order_id: order.order_id,
      order_status: order.order_status,
      payment_status: payment.payment_status,
    };

    switch (cashfreeEvent) {
      case "PAYMENT_SUCCESS":
      case "ORDER_PAID":
        return {
          id: eventId,
          type: "checkout.session.completed",
          data: { ...base, mode: "payment", metadata: {} },
        };
      case "PAYMENT_FAILED":
      case "ORDER_FAILED":
        return {
          id: eventId,
          type: "checkout.session.expired",
          data: { ...base, metadata: {} },
        };
      default:
        return { id: eventId, type: `cashfree.${cashfreeEvent || "unknown"}`, data: base };
    }
  },

  async getCheckoutPaymentStatus(sessionId): Promise<PaymentStatus> {
    if (!configured()) return "unknown";
    try {
      const data = await call<CfResponse>(`/orders/${encodeURIComponent(sessionId)}`, { method: "GET" });
      if (data.order_status === "PAID") return "paid";
      if (data.order_status === "FAILED") return "unpaid";
      return "unknown";
    } catch {
      return "unknown";
    }
  },

  async refundPayment({ sessionId, amountCents }) {
    const body: Record<string, unknown> = { order_id: sessionId };
    if (typeof amountCents === "number") body.refund_amount = toMajorUnits(amountCents);

    const data = await call<{ refund_id?: string }>("/refunds", { method: "POST", body });
    return { refundId: data.refund_id || `rf_${sessionId}` };
  },
};

/**
 * Cashfree subscription lifecycle -> provider-neutral subscription events.
 * Docs list these terminal states: CANCELLED, CUSTOMER_CANCELLED, EXPIRED,
 * COMPLETED, CARD_EXPIRED. ON_HOLD / BANK_APPROVAL_PENDING mean the mandate
 * exists but is not collecting, so the plan must not stay fully active.
 */
function mapSubscriptionEvent(
  cashfreeEvent: string,
  eventId: string,
  subscription: Record<string, unknown>,
  eventData: Record<string, unknown>
): ProviderWebhookEvent {
  const authDetails = (eventData.authorization_details || {}) as Record<string, unknown>;
  const cfStatus = String(
    subscription.subscription_status || authDetails.authorization_status || ""
  ).toUpperCase();

  const data: Record<string, unknown> = {
    id: String(subscription.subscription_id || subscription.cf_subscription_id || eventId),
    subscription: String(subscription.subscription_id || ""),
    status: cfStatus || "unknown",
    customer: String(
      (subscription.customer_details as Record<string, unknown> | undefined)?.customer_email || ""
    ),
    currentPeriodEnd: subscription.next_schedule_date || null,
    cf_status: cfStatus,
    // Tags are how we map a Cashfree mandate back to a tenant + plan.
    metadata: (subscription.subscription_tags as Record<string, unknown> | undefined) || {},
  };

  const deleted = ["CANCELLED", "CUSTOMER_CANCELLED", "EXPIRED", "COMPLETED", "CARD_EXPIRED"];
  const active = ["ACTIVE", "INITIALIZED", "BANK_APPROVAL_PENDING", "PAUSED"];

  if (cashfreeEvent === "SUBSCRIPTION_PAYMENT_FAILED") {
    data.status = "past_due";
    return { id: eventId, type: "customer.subscription.updated", data };
  }
  if (cashfreeEvent === "SUBSCRIPTION_REFUND_STATUS") {
    return { id: eventId, type: `cashfree.${cashfreeEvent.toLowerCase()}`, data };
  }
  if (cfStatus && deleted.includes(cfStatus)) {
    data.status = "canceled";
    return { id: eventId, type: "customer.subscription.deleted", data };
  }
  if (cfStatus === "ON_HOLD") {
    data.status = "past_due";
    return { id: eventId, type: "customer.subscription.updated", data };
  }
  if (cfStatus === "LINK_EXPIRED") {
    data.status = "canceled";
    return { id: eventId, type: "customer.subscription.deleted", data };
  }
  if (active.includes(cfStatus)) {
    data.status = cfStatus === "ACTIVE" ? "active" : cfStatus.toLowerCase();
    return { id: eventId, type: "customer.subscription.updated", data };
  }

  return { id: eventId, type: `cashfree.${cashfreeEvent.toLowerCase()}`, data };
}
