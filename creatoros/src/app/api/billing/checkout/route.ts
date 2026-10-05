import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { run, row, nowIso } from "@/lib/db/db";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { PLANS, PLAN_PRICES } from "@/lib/plans";
import { getPaymentProviderForCurrency, getPaymentProvider, billingCurrency } from "@/lib/payments";
import { normalisePhone } from "@/lib/payments/cashfree-subscriptions";
import { applySubscription } from "@/lib/billing/subscriptions";
import { recordFunnelEvent } from "@/lib/funnel";
import { SITE_URL } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const checkoutSchema = z.object({
  plan: z.string().min(1).max(40),
  /** Cashfree mandates need a 10-digit Indian mobile; Stripe ignores it. */
  phone: z.string().max(20).optional().default(""),
});

/**
 * Start a recurring plan checkout.
 *
 * Returns JSON rather than a redirect because providers differ:
 *  - Stripe returns a hosted `url` to redirect to.
 *  - Cashfree returns only a `sessionId`; the browser must then open Cashfront's
 *    subscription checkout with `subscriptionsCheckout({ subsSessionId })`.
 * The webhook applies the plan once the mandate is authorised.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "billing:write")) return err.forbidden();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("billing_checkout", ip), 10);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const plan = parsed.data.plan.toLowerCase();
  if (!PLANS[plan] || plan === "free") return err.validation({ plan: "Unknown plan" });

  const org = row("SELECT id, plan FROM organizations WHERE id = ?", s.org.id);
  if (!org) return err.notFound();

  const phone = normalisePhone(parsed.data.phone);
  const currency = billingCurrency();
  const provider = getPaymentProviderForCurrency(currency);
  const cashfreeReady = provider.name === "cashfree" && provider.isConfigured();
  const stripeReady = provider.name === "stripe" && provider.isConfigured();

  if (stripeReady || cashfreeReady) {
    // Price the plan in the configured billing currency. Cashfree supports
    // both USD and INR mandates, so this is a merchant choice.
    const prices = PLAN_PRICES[plan];
    const amountCents = (currency === "inr" ? prices.inr : prices.usd) * 100;

    if (cashfreeReady && !phone) {
      return err.validation({ phone: "A 10-digit phone number is required for Indian mandates" });
    }

    try {
      const session = await provider.createSubscriptionSession({
        planKey: plan,
        planName: plan.charAt(0).toUpperCase() + plan.slice(1),
        amountCents,
        currency,
        successUrl: `${SITE_URL}/app/billing?upgraded=${plan}`,
        cancelUrl: `${SITE_URL}/app/billing`,
        customerEmail: s.user.email,
        // Cashfree rejects an email here: it requires a person name.
        customerName: s.user.name,
        customerPhone: phone,
        metadata: { tenantId: s.org.id, plan },
      });
      audit({
        tenantId: s.org.id,
        userId: s.user.id,
        action: "billing.checkout_session",
        resource: plan,
        ip,
        meta: { provider: provider.name, subscriptionId: session.subscriptionId },
      });
      recordFunnelEvent({
        step: "checkout_started",
        tenantId: s.org.id,
        userId: s.user.id,
        plan,
        currency,
        amountCents,
        source: provider.name,
      });
      return ok({ provider: provider.name, sessionId: session.sessionId, url: session.url ?? null });
    } catch (e) {
      console.error("[billing.checkout] provider error:", e);
      return err.server();
    }
  }

  // No provider keys: simulate in development, refuse in production.
  if (process.env.NODE_ENV === "production") {
    // Distinguish "no gateway at all" from "a gateway exists but not for this
    // currency", because the second is the state this deploy was actually in
    // during the UK/USA launch prep and the fix is a Stripe key, not support.
    return err.conflict(
      getPaymentProvider().isConfigured()
        ? `Billing in ${currency.toUpperCase()} is not available yet. Contact support.`
        : "Billing is not configured. Contact support.",
    );
  }

  run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, nowIso(), s.org.id);
  applySubscription({
    tenantId: s.org.id,
    plan,
    provider: "mock",
    providerId: null,
    status: "active",
    currency,
  });
  audit({ tenantId: s.org.id, userId: s.user.id, action: "billing.plan_change", resource: plan, ip });
  // The dev/mock path grants the plan immediately, so it is a real purchase for
  // funnel purposes as well as checkout_started.
  recordFunnelEvent({ step: "checkout_started", tenantId: s.org.id, userId: s.user.id, plan, currency, source: "mock" });
  recordFunnelEvent({ step: "purchase_completed", tenantId: s.org.id, userId: s.user.id, plan, currency, source: "mock" });
  return ok({ provider: "mock", sessionId: null, url: `/app/billing?upgraded=${plan}` });
}
