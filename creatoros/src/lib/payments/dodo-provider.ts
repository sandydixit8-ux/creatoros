import crypto from "node:crypto";
import type { CheckoutSessionResult, PaymentProvider, PaymentStatus, ProviderWebhookEvent, SubscriptionSessionResult } from "./types";

/**
 * Dodo Payments provider (Merchant of Record).
 *
 * The app's other gateways settle in the merchant's name: Cashfree India for
 * INR, Stripe elsewhere. Dodo is a MoR, so it takes on the tax/remittance
 * liability, which is the point of using it for US/UK sales from an Indian
 * entity. It differs from Stripe in two ways that shape this file:
 *
 *  - a checkout cannot carry an inline price. Every line must reference a
 *    product that already exists in the Dodo dashboard (`product_id`), so the
 *    plan/product -> DODO_PRODUCT_* mapping below is the whole integration.
 *  - webhooks follow the Standard Webhooks spec: the signature is an HMAC over
 *    `${webhook-id}.${webhook-timestamp}.${rawBody}` with a base64-decoded
 *    `whsec_` secret, not a body-level event id.
 *
 * Env:
 *   DODO_PAYMENTS_API_KEY      - API key (Developer -> API Keys)
 *   DODO_PAYMENTS_WEBHOOK_KEY  - webhook secret, `whsec_...` (Developer -> Webhooks)
 *   DODO_ENV                   - "test" (default) | "live"
 *   DODO_CURRENCIES            - currencies this account settles, default "usd,gbp,eur"
 *   DODO_PRODUCT_<PLANKEY>     - dashboard product id per plan, e.g. DODO_PRODUCT_CREATOR
 */

const TOLERANCE_SECONDS = 5 * 60;

/** Read lazily so a config change or a test does not need a module reload. */
function apiKey(): string {
  return process.env.DODO_PAYMENTS_API_KEY || "";
}

function webhookKey(): string {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY || "";
}

function live(): boolean {
  return (process.env.DODO_ENV || "test").toLowerCase() === "live";
}

function baseUrl(): string {
  return live() ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

function configured(): boolean {
  return apiKey().length > 0;
}

function currencies(): string[] {
  return (process.env.DODO_CURRENCIES || "usd,gbp,eur")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/** Map a plan/product key to its dashboard product id via env. */
export function dodoProductId(key: string): string {
  const envName = `DODO_PRODUCT_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[envName] || "";
}

/** Dodo wants a full international number; drop anything else rather than fail. */
function dodoPhone(raw?: string): string | undefined {
  const value = (raw || "").trim();
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : undefined;
}

interface DodoResponse {
  session_id?: string;
  checkout_url?: string | null;
  payment_id?: string;
  payment_status?: string;
  subscription_id?: string;
  status?: string;
  refund_id?: string;
  customer_id?: string;
  message?: string;
  detail?: string;
  error?: { message?: string } | string;
}

async function call<T extends DodoResponse>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown }
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await res.text();
  let data: DodoResponse = {};
  try {
    data = text ? (JSON.parse(text) as DodoResponse) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }

  if (!res.ok) {
    const reason =
      (typeof data.error === "string" ? data.error : data.error?.message) ||
      data.detail ||
      data.message ||
      `HTTP ${res.status}`;
    throw new Error(`Dodo error (${res.status}): ${reason}`);
  }
  return data as T;
}

/** Append the provider's redirect params without clobbering an existing query. */
function withParams(url: string, params: Record<string, string>): string {
  const sep = url.includes("?") ? "&" : "?";
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${url}${sep}${qs}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** The customer can arrive as an id string or a customer object. */
function customerRef(data: Record<string, unknown>): string {
  const c = data.customer;
  if (typeof c === "string") return c;
  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    return str(o.customer_id) || str(o.email);
  }
  return "";
}

/**
 * Map a Dodo event onto the provider-neutral event shapes the webhook route
 * already handles, so fulfilment logic stays gateway-agnostic.
 *
 * Subscription lifecycle is carried on `customer.subscription.*`; one-off
 * payment confirmation on `checkout.session.completed`. `subscription.failed`
 * is terminal and grants no access, so it maps to `deleted` (the same route as
 * an explicit cancel) rather than to an active update.
 */
export function mapDodoEvent(id: string, type: string, data: Record<string, unknown>): ProviderWebhookEvent {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  if (type === "payment.succeeded") {
    return {
      id,
      type: "checkout.session.completed",
      data: {
        id: str(data.payment_id),
        mode: "payment",
        subscription: str(data.subscription_id),
        customer: customerRef(data),
        metadata,
      },
    };
  }

  if (type === "payment.failed") {
    return { id, type: "checkout.session.expired", data: { id: str(data.payment_id), metadata } };
  }

  if (type.startsWith("subscription.")) {
    const base: Record<string, unknown> = {
      id: str(data.subscription_id),
      subscription: str(data.subscription_id),
      customer: customerRef(data),
      currentPeriodEnd: data.next_billing_date ?? null,
      currency: data.currency ? String(data.currency) : undefined,
      metadata,
    };

    const terminal = ["subscription.cancelled", "subscription.expired", "subscription.failed"];
    if (terminal.includes(type)) {
      return { id, type: "customer.subscription.deleted", data: { ...base, status: "canceled" } };
    }

    // past_due keeps access while the grace period runs; on_hold has lost it.
    // Both record a non-active status and let applySubscription decide access.
    const status = type === "subscription.on_hold" ? "past_due" : type === "subscription.past_due" ? "past_due" : "active";
    return { id, type: "customer.subscription.updated", data: { ...base, status } };
  }

  return { id, type: `dodo.${type || "unknown"}`, data };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const dodoProvider: PaymentProvider = {
  name: "dodo",

  isConfigured: configured,

  requiresCustomerPhone: false,

  supportsCurrency: (currency) => currencies().includes((currency || "").trim().toLowerCase()),

  async createCustomer({ email, name }) {
    const data = await call<DodoResponse>("/customers", {
      method: "POST",
      body: { email, name: name || undefined },
    });
    if (!data.customer_id) throw new Error("Dodo did not return a customer id");
    return { customerId: data.customer_id };
  },

  async createCheckoutSession({ lines, currency, successUrl, cancelUrl, customerEmail, customerPhone, metadata }): Promise<CheckoutSessionResult> {
    // A Dodo cart references dashboard products, so the caller supplies the
    // mapped product id. The store path has no per-product Dodo id yet, so a
    // missing mapping fails loudly instead of charging the wrong product.
    const productId = metadata.dodoProductId || (metadata.productKey ? dodoProductId(metadata.productKey) : "");
    if (!productId) {
      throw new Error("Dodo checkout requires a dashboard product id (metadata.dodoProductId, or DODO_PRODUCT_<key> with metadata.productKey)");
    }
    if (lines.length !== 1) {
      throw new Error("Dodo one-time checkout supports a single line; map each product to its own session");
    }

    const data = await call<DodoResponse>("/checkouts", {
      method: "POST",
      body: {
        product_cart: [{ product_id: productId, quantity: lines[0].quantity || 1 }],
        customer: { email: customerEmail, phone_number: dodoPhone(customerPhone) },
        billing_currency: currency.toUpperCase(),
        return_url: withParams(successUrl, { dodo: "1" }),
        cancel_url: cancelUrl,
        metadata,
      },
    });

    if (!data.session_id || !data.checkout_url) throw new Error("Dodo did not return a checkout URL");
    return { sessionId: data.session_id, url: data.checkout_url };
  },

  async createSubscriptionSession({ planKey, currency, successUrl, cancelUrl, customerEmail, customerName, customerPhone, metadata }): Promise<SubscriptionSessionResult> {
    const productId = dodoProductId(planKey);
    if (!productId) {
      throw new Error(`Dodo product id missing for plan "${planKey}" (set DODO_PRODUCT_${planKey.toUpperCase()})`);
    }

    const data = await call<DodoResponse>("/checkouts", {
      method: "POST",
      body: {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: customerEmail,
          name: customerName || undefined,
          phone_number: dodoPhone(customerPhone),
        },
        // Lock the currency explicitly: without it Dodo picks by IP and the
        // subscription keeps whichever it picked for its whole lifetime.
        billing_currency: currency.toUpperCase(),
        return_url: withParams(successUrl, { dodo: "1" }),
        cancel_url: cancelUrl,
        metadata,
      },
    });

    if (!data.session_id || !data.checkout_url) throw new Error("Dodo did not return a checkout URL");
    // The real subscription id arrives on `subscription.active`; before that the
    // session id is the only handle, matching how Stripe returns its session id.
    return { subscriptionId: data.session_id, sessionId: data.session_id, url: data.checkout_url };
  },

  async cancelSubscription(providerId) {
    await call<DodoResponse>(`/subscriptions/${encodeURIComponent(providerId)}`, {
      method: "PATCH",
      body: { status: "cancelled", cancel_reason: "cancelled_by_merchant" },
    });
    return { subscriptionId: providerId };
  },

  async verifyWebhook(rawBody, signature, timestamp, id): Promise<ProviderWebhookEvent | null> {
    const secret = webhookKey();
    if (!secret || !signature || !timestamp || !id) return null;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) {
      console.log(`[webhook.dodo] rejected: timestamp outside tolerance ts="${timestamp}"`);
      return null;
    }

    // Standard Webhooks: secret is `whsec_<base64>`; the raw bytes are the key.
    const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const expected = crypto.createHmac("sha256", keyBytes).update(`${id}.${timestamp}.${rawBody}`).digest("base64");

    // Header is a space-separated list of `v1,<sig>` tokens.
    const provided = signature
      .split(" ")
      .map((token) => (token.includes(",") ? token.slice(token.indexOf(",") + 1) : token))
      .filter(Boolean);

    if (!provided.some((sig) => safeEqual(sig, expected))) {
      console.log(`[webhook.dodo] sig mismatch id="${id}" ts="${timestamp}"`);
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const type = str(parsed.type);
    if (!type) return null;
    const data = (parsed.data || {}) as Record<string, unknown>;
    return mapDodoEvent(id, type, data);
  },

  async getCheckoutPaymentStatus(sessionId): Promise<PaymentStatus> {
    if (!configured()) return "unknown";
    try {
      const data = await call<DodoResponse>(`/checkouts/${encodeURIComponent(sessionId)}`, { method: "GET" });
      const status = String(data.payment_status || "").toLowerCase();
      if (status === "succeeded" || status === "paid") return "paid";
      if (status === "failed") return "unpaid";
      return "unknown";
    } catch {
      return "unknown";
    }
  },

  async refundPayment({ sessionId, amountCents }) {
    const body: Record<string, unknown> = { payment_id: sessionId };
    if (typeof amountCents === "number") body.amount = amountCents;
    const data = await call<DodoResponse>("/refunds", { method: "POST", body });
    return { refundId: data.refund_id || `rf_${sessionId}` };
  },
};
