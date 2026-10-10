import { NextRequest } from "next/server";
import { row } from "@/lib/db/db";
import { webhookProviders, type PaymentProvider, type ProviderWebhookEvent } from "@/lib/payments";
import { claimWebhookEvent, markWebhookProcessed, markWebhookFailed } from "@/lib/payments/webhook-events";
import { fulfillOrderBySession, markOrderFailed, type FulfillResult } from "@/lib/store/orders";
import { applySubscription } from "@/lib/billing/subscriptions";
import { recordFunnelEvent } from "@/lib/funnel";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Payment provider webhook (spec §9): signature-verified, idempotent, and safe
 * to redeliver. Handles both one-time product/course purchases and recurring
 * plan subscriptions.
 *
 * Ordering matters more than it looks (D-11). The event is *claimed* first so a
 * crash cannot lose it, the work runs next, and only a success marks it
 * processed. A failure answers 502 so the gateway redelivers, and the claim makes
 * the redelivery a retry rather than a discarded duplicate. Answering 200 on
 * failure — which this route used to do — is what made a single transient error
 * permanently lose a paid order.
 */
export async function POST(req: NextRequest) {
  const providers = webhookProviders();
  if (providers.length === 0) return fail("Payments not configured", 503, "payments_not_configured");

  const raw = await req.text();

  // Delivery diagnostic (PII-free): proves whether a gateway postal arrived at
  // all even when signature rejection drops it before an event row exists.
  console.log(
    `[webhook] inbound len=${raw.length} host=${req.headers.get("x-forwarded-host") || req.headers.get("host") || ""} sig=${Boolean(req.headers.get("x-webhook-signature"))} ts=${Boolean(req.headers.get("x-webhook-timestamp"))}`
  );
  if (!req.headers.get("x-webhook-signature") && !req.headers.get("stripe-signature")) {
    console.log("[webhook] rejected: no signature header present");
  }

  // The sender is whichever gateway's signature verifies: Cashfree signs with
  // x-webhook-signature + x-webhook-timestamp, Stripe with stripe-signature.
  let provider: PaymentProvider | null = null;
  let event: ProviderWebhookEvent | null = null;
  for (const candidate of providers) {
    const cashfree = candidate.name === "cashfree";
    const signature = (cashfree ? req.headers.get("x-webhook-signature") : req.headers.get("stripe-signature")) || "";
    const timestamp = (cashfree ? req.headers.get("x-webhook-timestamp") : "") || "";
    const verified = await candidate.verifyWebhook(raw, signature, timestamp);
    if (verified) {
      provider = candidate;
      event = verified;
      break;
    }
  }

  // No gateway signed this. A real event is always signed, so nothing was
  // processed and nothing can be fulfilled from this body. This is the one
  // path we answer 200 on purpose: Cashfree's dashboard sends an unsigned
  // validation POST when you add a webhook endpoint, and 400-ing it blocks
  // the Subscriptions product setup in the merchant dashboard.
  if (!provider && !event && !req.headers.get("x-webhook-signature") && !req.headers.get("stripe-signature")) {
    return ok({ received: true, verified: false });
  }
  if (!provider || !event) return fail("Invalid signature", 400, "invalid_signature");

  const claim = claimWebhookEvent({
    id: event.id,
    provider: provider.name,
    type: event.type,
    payload: event.data,
  });
  if (!claim.claimed) {
    return ok({ received: true, duplicate: true, reason: claim.reason });
  }

  const sessionId = str(event.data.id);
  let result: FulfillResult | "subscription_applied" | "tenant_not_found" | "ignored" | "not_payable" = "ignored";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // A subscription session carries mode="subscription" + metadata.
        if (event.data.mode === "subscription") {
          const metadata = (event.data.metadata ?? {}) as Record<string, unknown>;
          const tenantId = str(metadata.tenantId);
          const plan = str(metadata.plan);
          if (tenantId && plan) {
            const applied = applySubscription({
              tenantId,
              plan,
              provider: provider.name,
              providerId: str(event.data.subscription),
              customerId: str(event.data.customer),
              status: "active",
              currentPeriodEnd: str(event.data.currentPeriodEnd) || null,
              currency: str(metadata.currency) || undefined,
            });
            if (applied) {
              audit({ tenantId, action: "billing.webhook_subscription", resource: plan, meta: { event: event.id } });
              recordFunnelEvent({
                step: "purchase_completed",
                tenantId,
                plan,
                source: provider.name,
                meta: { event: event.id, kind: "subscription" },
              });
              result = "subscription_applied";
            } else {
              result = "tenant_not_found";
            }
          }
        } else if (sessionId) {
          result = fulfillOrderBySession(sessionId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data as Record<string, unknown>;
        const metadata = (sub.metadata ?? {}) as Record<string, unknown>;
        const tenantId = str(metadata.tenantId);
        if (tenantId) {
          // No plan in metadata means the gateway did not say - never that the plan is
          // `free`. Reading absence as `free` downgraded paying tenants on any update
          // event that omitted metadata (D-12).
          const plan = str(metadata.plan) || null;
          const status = str(sub.status);
          const applied = applySubscription({
            tenantId,
            plan,
            provider: provider.name,
            providerId: str(sub.id),
            customerId: str(sub.customer),
            status: status || "active",
            currentPeriodEnd: str(sub.current_period_end) || str(sub.currentPeriodEnd) || null,
            // Stripe sends the subscription's own currency at the top level, not
            // in metadata. Recorded so MRR is not computed at a guessed rate.
            currency: str(sub.currency) || undefined,
          });
          result = applied ? "subscription_applied" : "tenant_not_found";
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data as Record<string, unknown>;
        const metadata = (sub.metadata ?? {}) as Record<string, unknown>;
        const tenantId = str(metadata.tenantId);
        if (tenantId) {
          const applied = applySubscription({
            tenantId,
            // Same rule as above: keep the stored plan instead of rewriting it to
            // `free`. applySubscription only drops the org when no active
            // subscription remains.
            plan: str(metadata.plan) || null,
            provider: provider.name,
            providerId: str(sub.id),
            customerId: str(sub.customer),
            status: "canceled",
          });
          result = applied ? "subscription_applied" : "tenant_not_found";
          if (applied) {
            audit({ tenantId, action: "billing.webhook_subscription_deleted", resource: str(sub.id) });
            recordFunnelEvent({
              step: "subscription_canceled",
              tenantId,
              plan: str(metadata.plan),
              source: provider.name,
              meta: { event: event.id },
            });
          }
        }
        break;
      }
      case "checkout.session.expired":
        if (sessionId) {
          const order = row<{ id: string }>("SELECT id FROM orders WHERE provider_session_id = ? AND status = 'pending'", sessionId);
          if (order) {
            markOrderFailed(order.id, "canceled");
            result = "not_payable";
          }
        }
        break;
      default:
        result = "ignored";
    }
  } catch (e) {
    // Leave the event retryable and tell the gateway to come back. The receipt
    // stays on file with the reason, so this is visible to support rather than a
    // silent no-op.
    markWebhookFailed(event.id, e);
    console.error(`[webhook] ${provider.name} ${event.type} ${event.id} failed (attempt ${claim.attempts}):`, e);
    return fail("Webhook processing failed", 502, "webhook_processing_failed");
  }

  markWebhookProcessed(event.id);

  if (result === "paid") {
    audit({ action: "store.webhook_fulfilled", resource: sessionId });
  }

  return ok({ received: true, result });
}
