import Stripe from "stripe";
import type { CheckoutSessionResult, PaymentProvider, PaymentStatus, ProviderWebhookEvent, SubscriptionSessionResult } from "./types";

let _stripe: Stripe | null = null;

/** Currencies this deployment bills Stripe in (default: USD). Read lazily. */
function stripeCurrencies(): string[] {
  return (process.env.STRIPE_CURRENCIES || "usd")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function client(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return null;
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return _stripe;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  isConfigured: () => client() !== null,

  requiresCustomerPhone: false,

  supportsCurrency: (currency) => stripeCurrencies().includes((currency || "").trim().toLowerCase()),

  async createCustomer({ email, name }) {
    const stripe = client();
    if (!stripe) throw new Error("Stripe is not configured");
    const customer = await stripe.customers.create({ email, name: name || undefined });
    return { customerId: customer.id };
  },

  async createCheckoutSession({ lines, currency, successUrl, cancelUrl, customerEmail, metadata }): Promise<CheckoutSessionResult> {
    const stripe = client();
    if (!stripe) throw new Error("Stripe is not configured");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency,
          unit_amount: l.amountCents,
          product_data: { name: l.title },
        },
      })),
      success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  },

  async createSubscriptionSession({ planName, amountCents, currency, successUrl, cancelUrl, customerEmail, metadata }): Promise<SubscriptionSessionResult> {
    const stripe = client();
    if (!stripe) throw new Error("Stripe is not configured");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            recurring: { interval: "month" },
            product_data: { name: planName },
          },
        },
      ],
      success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata,
      subscription_data: { metadata },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { subscriptionId: session.id, sessionId: session.id, url: session.url };
  },

  async cancelSubscription(providerId: string): Promise<{ subscriptionId: string }> {
    const stripe = client();
    if (!stripe) throw new Error("Stripe is not configured");
    const sub = await stripe.subscriptions.update(providerId, { cancel_at_period_end: true });
    return { subscriptionId: sub.id };
  },

  async verifyWebhook(rawBody, signature): Promise<ProviderWebhookEvent | null> {
    const stripe = client();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) return null;
    try {
      const event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
      return { id: event.id, type: event.type, data: event.data.object as unknown as Record<string, unknown> };
    } catch {
      return null;
    }
  },

  async getCheckoutPaymentStatus(sessionId): Promise<PaymentStatus> {
    const stripe = client();
    if (!stripe) return "unknown";
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") return "paid";
      if (session.payment_status === "unpaid") return "unpaid";
      return "unknown";
    } catch {
      return "unknown";
    }
  },

  async refundPayment({ sessionId, amountCents }) {
    const stripe = client();
    if (!stripe) throw new Error("Stripe is not configured");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const chargeId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!chargeId) throw new Error("No payment to refund");
    const refund = await stripe.refunds.create({ payment_intent: chargeId, amount: amountCents });
    return { refundId: refund.id };
  },
};
