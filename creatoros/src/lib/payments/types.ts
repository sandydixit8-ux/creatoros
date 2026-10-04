export interface CheckoutLine {
  title: string;
  amountCents: number;
  quantity: number;
}

/** Recurring (monthly) subscription checkout for a plan upgrade. */
export interface SubscriptionSessionInput {
  planKey: string;
  planName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Cashfree rejects an email in `customer_name`; it requires a person name. */
  customerName?: string;
  /** Required by Cashfree for domestic mandates; ignored by Stripe. */
  customerPhone?: string;
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Result of starting a recurring checkout.
 *
 * Stripe hands back a hosted URL to redirect to. Cashfree does not: the API
 * only returns a `subscription_session_id`, and mandate authorisation is
 * started in the browser with Cashfront's `subscriptionsCheckout()`. Callers
 * must branch on `provider`, using `url` for Stripe and `sessionId` for
 * Cashfree.
 */
export interface SubscriptionSessionResult {
  subscriptionId: string;
  sessionId: string;
  /** Hosted checkout URL, for providers that return one. */
  url?: string;
}

export interface ProviderWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export type PaymentStatus = "paid" | "unpaid" | "unknown";

/**
 * Payment provider abstraction (spec §9). All billing/checkout code depends
 * only on this interface; Stripe and the dev mock implement it.
 */
export interface PaymentProvider {
  readonly name: string;
  /** False when the provider cannot create sessions (missing credentials). */
  isConfigured(): boolean;
  /**
   * True when the provider rejects a checkout that has no `customer_phone`
   * (Cashfree requires it). Callers must validate the phone before creating an
   * order so the buyer gets a field error instead of a failed payment.
   */
  readonly requiresCustomerPhone: boolean;
  /**
   * False when the merchant account cannot settle `currency` (Cashfree rejects
   * a live INR-only account with `order Currency not enabled for this merchant
   * account`). Callers route by currency so a USD order goes to the provider
   * that actually supports USD.
   */
  supportsCurrency(currency: string): boolean;
  createCustomer(input: { email: string; name?: string }): Promise<{ customerId: string }>;
  createCheckoutSession(input: {
    lines: CheckoutLine[];
    currency: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    /** Required by Cashfree for domestic rails; ignored by Stripe. */
    customerPhone?: string;
    metadata: Record<string, string>;
  }): Promise<CheckoutSessionResult>;
  /** One-time checkout is not enough for plans — a recurring monthly session. */
  createSubscriptionSession(input: SubscriptionSessionInput): Promise<SubscriptionSessionResult>;
  cancelSubscription(providerId: string): Promise<{ subscriptionId: string }>;
  /** Verify webhook signature and parse the event. Returns null when invalid. */
  verifyWebhook(rawBody: string, signature: string, timestamp?: string): Promise<ProviderWebhookEvent | null>;
  getCheckoutPaymentStatus(sessionId: string): Promise<PaymentStatus>;
  refundPayment(input: { sessionId: string; amountCents?: number }): Promise<{ refundId: string }>;
}
