import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe-provider";
import { cashfreeProvider } from "./cashfree-provider";

export type {
  PaymentProvider,
  CheckoutLine,
  CheckoutSessionResult,
  SubscriptionSessionResult,
  ProviderWebhookEvent,
  PaymentStatus,
} from "./types";

/**
 * Resolve the active payment provider.
 * - PAYMENT_PROVIDER=cashfree + CASHFREE_* set  -> Cashfree
 * - PAYMENT_PROVIDER=stripe   + STRIPE_SECRET_KEY set -> Stripe
 * - PAYMENT_PROVIDER=mock                           -> dev mock
 * - otherwise -> unconfigured stub (checkout returns 503 until keys exist)
 */
export function getPaymentProvider(): PaymentProvider {
  const preferred = (process.env.PAYMENT_PROVIDER || "").toLowerCase();

  if (preferred === "cashfree" && cashfreeProvider.isConfigured()) return cashfreeProvider;
  if (preferred === "stripe" && stripeProvider.isConfigured()) return stripeProvider;

  const explicit = preferred === "mock";
  const dev = process.env.NODE_ENV !== "production";
  if (explicit || dev) return mockProvider;
  return unconfiguredProvider;
}

export function paymentConfigured(): boolean {
  return getPaymentProvider().isConfigured();
}

/**
 * Resolve the provider for a specific currency.
 *
 * The preferred provider (PAYMENT_PROVIDER) wins whenever it supports the
 * currency. Otherwise any other configured provider that supports it is used —
 * a live INR-only Cashfree account cannot settle USD, so USD orders go to
 * Stripe and INR orders stay on Cashfree.
 *
 * If nothing supports the currency this returns the `unconfigured` stub, NOT
 * the preferred provider. Handing back a provider that is known not to support
 * the currency is worse than admitting there is none: the caller would build a
 * real session in the wrong currency, and on the plan path it also forces the
 * customer through a 10-digit Indian mobile field that the gateway then either
 * rejects or settles in the wrong currency. Refusing here makes every caller
 * emit its existing, correct "not available yet" response instead.
 */
export function getPaymentProviderForCurrency(currency: string): PaymentProvider {
  const preferred = getPaymentProvider();
  if (preferred.isConfigured() && preferred.supportsCurrency(currency)) return preferred;

  for (const candidate of [cashfreeProvider, stripeProvider]) {
    if (candidate.isConfigured() && candidate.supportsCurrency(currency)) return candidate;
  }
  return unconfiguredProvider;
}

/** True when some configured provider can actually settle this currency. */
export function paymentConfiguredForCurrency(currency: string): boolean {
  return getPaymentProviderForCurrency(currency).isConfigured();
}

/** Provider recorded on an order/subscription, so refunds and status checks hit the right gateway. */
export function providerByName(name: string | null | undefined): PaymentProvider | null {
  const wanted = (name || "").trim().toLowerCase();
  if (!wanted) return null;
  if (wanted === "cashfree") return cashfreeProvider;
  if (wanted === "stripe") return stripeProvider;
  if (wanted === "mock") return mockProvider;
  return null;
}

/**
 * Every configured provider, for endpoints that must verify an inbound webhook
 * without knowing which gateway sent it. Cashfree signs with
 * `x-webhook-signature` + `x-webhook-timestamp`, Stripe with `stripe-signature`.
 */
export function webhookProviders(): PaymentProvider[] {
  const ordered: PaymentProvider[] = [];
  const preferred = getPaymentProvider();
  if (preferred.name !== "unconfigured") ordered.push(preferred);
  for (const candidate of [cashfreeProvider, stripeProvider]) {
    if (candidate.isConfigured() && !ordered.some((p) => p.name === candidate.name)) ordered.push(candidate);
  }
  return ordered;
}

/**
 * Cashfront mode for the browser SDK. It must mirror the server-side
 * environment or the hosted checkout will not resolve the session id.
 */
export function cashfreeSdkMode(): "sandbox" | "production" {
  return (process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "live" ? "production" : "sandbox";
}

/**
 * Currency for plan upgrades. Cashfree supports both USD and INR mandates, so
 * this is a merchant choice rather than a provider limitation: set
 * BILLING_CURRENCY=inr to bill in rupees, anything else (default) bills in USD.
 */
export function billingCurrency(): "usd" | "inr" {
  return (process.env.BILLING_CURRENCY || "usd").toLowerCase() === "inr" ? "inr" : "usd";
}

const unconfiguredProvider: PaymentProvider = {
  name: "unconfigured",
  isConfigured: () => false,

  requiresCustomerPhone: false,

  supportsCurrency: () => false,
  async createCustomer() {
    throw new Error("Payments are not configured");
  },
  async createCheckoutSession() {
    throw new Error("Payments are not configured");
  },
  async createSubscriptionSession() {
    throw new Error("Payments are not configured");
  },
  async cancelSubscription() {
    throw new Error("Payments are not configured");
  },
  async verifyWebhook() {
    return null;
  },
  async getCheckoutPaymentStatus() {
    return "unknown";
  },
  async refundPayment() {
    throw new Error("Payments are not configured");
  },
};
