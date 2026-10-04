import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { getPaymentProvider, providerByName } from "@/lib/payments";
import { activeSubscription, cancelSubscriptionTracking } from "@/lib/billing/subscriptions";
import { audit } from "@/lib/audit";
import { SITE_URL } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "billing:write")) return err.forbidden();

  const sub = activeSubscription(s.org.id);
  if (!sub) return err.conflict("No active subscription to cancel");

  const provider = providerByName(sub.provider) ?? getPaymentProvider();
  if (sub.provider_id && provider.isConfigured()) {
    try {
      await provider.cancelSubscription(sub.provider_id);
    } catch {
      return err.server();
    }
  }

  // Downgrade at period-end in Stripe, but the DB reflects cancellation now.
  cancelSubscriptionTracking(s.org.id, sub.provider_id ?? "");
  audit({ tenantId: s.org.id, userId: s.user.id, action: "billing.cancel", resource: sub.plan, ip: req.headers.get("x-forwarded-for") || undefined });

  return Response.redirect(new URL(`${SITE_URL}/app/billing?canceled=1`), 303);
}