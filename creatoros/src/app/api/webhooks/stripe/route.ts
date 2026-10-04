import { NextRequest } from "next/server";
import { run, row, nowIso } from "@/lib/db/db";
import { webhookProviders, type PaymentProvider, type ProviderWebhookEvent } from "@/lib/payments";
import { fulfillOrderBySession, markOrderFailed, type FulfillResult } from "@/lib/store/orders";
import { applySubscription } from "@/lib/billing/subscriptions";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Payment provider webhook (spec §9): signature-verified, idempotent,
 * records every event in webhook_events before processing. Handles both
 * one-time product/course purchases and recurring plan subscriptions.
 */
export async function POST(req: NextRequest) {
  const providers = webhookProviders();
  if (providers.length === 0) return fail("Payments not configured", 503, "payments_not_configured");

  const raw = await req.text();

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
  if (!provider || !event) return fail("Invalid signature", 400, "invalid_signature");

  // Idempotency: a duplicate delivery must not process twice.
  const existed = row("SELECT id FROM webhook_events WHERE id = ?", event.id);
  if (existed) return ok({ received: true, duplicate: true });
  try {
    run(
      "INSERT INTO webhook_events (id, provider, type, payload, processed_at) VALUES (?, ?, ?, ?, ?)",
      event.id,
      provider.name,
      event.type,
      JSON.stringify(event.data).slice(0, 10000),
      nowIso()
    );
  } catch {
    // concurrent duplicate won the insert race — treat as processed
    return ok({ received: true, duplicate: true });
  }

  const sessionId = str(event.data.id);
  let result: FulfillResult | "subscription_applied" | "tenant_not_found" | "ignored" | "error" = "ignored";

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
            });
            if (applied) {
              audit({ tenantId, action: "billing.webhook_subscription", resource: plan, meta: { event: event.id } });
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
          const plan = str(metadata.plan) || "free";
          const status = str(sub.status);
          const applied = applySubscription({
            tenantId,
            plan,
            provider: provider.name,
            providerId: str(sub.id),
            customerId: str(sub.customer),
            status: status || "active",
            currentPeriodEnd: str(sub.current_period_end) || str(sub.currentPeriodEnd) || null,
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
            plan: str(metadata.plan) || "free",
            provider: provider.name,
            providerId: str(sub.id),
            customerId: str(sub.customer),
            status: "canceled",
          });
          result = applied ? "subscription_applied" : "tenant_not_found";
          if (applied) {
            audit({ tenantId, action: "billing.webhook_subscription_deleted", resource: str(sub.id) });
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
    // The event is already persisted in webhook_events, so a retry would be a
    // duplicate no-op. Log and acknowledge to stop the gateway retry loop.
    result = "error";
    console.error(`[webhook] ${provider.name} ${event.type} ${event.id} failed:`, e);
  }

  if (result === "paid") {
    audit({ action: "store.webhook_fulfilled", resource: sessionId });
  }

  return ok({ received: true, result });
}
