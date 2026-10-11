import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { planRank } from "@/lib/plans";
import { audit } from "@/lib/audit";
import { fetchSubscription, type CfSubscription } from "@/lib/payments/cashfree-subscriptions";

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  provider: string;
  provider_id: string | null;
  customer_id: string | null;
  status: string;
  plan: string;
  current_period_end: string | null;
  /** Currency the mandate was created in. '' on rows predating migration 16. */
  currency: string;
  created_at: string;
  updated_at: string;
}

export const ACTIVE_STATUSES = ["active", "trialing"] as const;

/**
 * Idempotent upsert of a subscription and apply its plan to the org.
 * Used by webhooks (checkout.session.completed, subscription.*) so a
 * re-delivered webhook never double-applies.
 *
 * `plan` is nullable, and null means **the gateway did not tell us** - not "free".
 * Gateways routinely omit metadata on update and renewal events, and reading that
 * absence as `free` silently downgraded paying tenants: an active subscription
 * arrived with no plan, the org was set to `free`, and the customer lost the paid
 * features they were still being charged for. The rule here is that a plan is only
 * ever lowered when something authoritative says so.
 */
export function applySubscription(input: {
  tenantId: string;
  plan: string | null;
  provider: string;
  providerId?: string | null;
  customerId?: string | null;
  status: string;
  currentPeriodEnd?: string | null;
  /** Currency the mandate was actually created in. Recorded so MRR is not guessed. */
  currency?: string | null;
}): SubscriptionRow | null {
  // A gateway can deliver events for tenants that were deleted while a mandate
  // was still active. Returning null keeps the webhook a 200 so the provider
  // stops retrying, instead of failing on the subscriptions foreign key.
  if (!row("SELECT id FROM organizations WHERE id = ?", input.tenantId)) {
    audit({
      action: "billing.subscription_orphan",
      resource: input.providerId || input.plan || "",
      meta: { provider: input.provider, tenantId: input.tenantId, status: input.status },
    });
    return null;
  }

  const existing = input.providerId
    ? row<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? AND provider_id = ?", input.tenantId, input.providerId)
    : row<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? AND plan = ? AND status != 'canceled'", input.tenantId, input.plan ?? "");

  // Keep whatever we already know rather than inventing `free`: the subscription's
  // own plan, else the plan the org is currently on.
  const orgPlan = String(row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", input.tenantId)?.plan ?? "");
  const resolvedPlan = input.plan || existing?.plan || orgPlan || "free";

  // Keep a known currency rather than re-guessing on every gateway ping: a
  // subscription created in INR must not be relabelled USD just because a later
  // event omitted the currency. Only fall back to the deployment's billing
  // currency when we have genuinely never seen one.
  const knownCurrency = String(
    input.currency || existing?.currency || (process.env.BILLING_CURRENCY || "usd")
  ).toLowerCase() === "inr" ? "inr" : "usd";

  let sub: SubscriptionRow | undefined = existing;
  if (existing) {
    run(
      `UPDATE subscriptions SET
         provider = ?, provider_id = ?, customer_id = ?,
         status = ?, plan = ?, current_period_end = ?, currency = ?, updated_at = ?
       WHERE id = ?`,
      input.provider,
      input.providerId ?? null,
      input.customerId ?? null,
      input.status,
      resolvedPlan,
      input.currentPeriodEnd ?? existing.current_period_end,
      knownCurrency,
      nowIso(),
      existing.id
    );
    sub = row<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", existing.id);
  } else {
    const id = newId("sub");
    run(
      `INSERT INTO subscriptions (id, tenant_id, provider, provider_id, customer_id, status, plan, current_period_end, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.tenantId,
      input.provider,
      input.providerId ?? null,
      input.customerId ?? null,
      input.status,
      resolvedPlan,
      input.currentPeriodEnd ?? null,
      knownCurrency,
      nowIso(),
      nowIso()
    );
    sub = row<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", id);
  }

  const isActive = ACTIVE_STATUSES.includes(input.status as (typeof ACTIVE_STATUSES)[number]);

  if (isActive) {
    if (input.plan) {
      run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", resolvedPlan, nowIso(), input.tenantId);
      audit({ tenantId: input.tenantId, action: "billing.subscription_active", resource: resolvedPlan, meta: { provider: input.provider, providerId: input.providerId } });
    } else {
      // Active, but the gateway withheld the plan. Grant nothing new and take
      // nothing away - guessing either way would be inventing billing state.
      audit({ tenantId: input.tenantId, action: "billing.subscription_plan_unknown", resource: resolvedPlan, meta: { provider: input.provider, providerId: input.providerId, status: input.status } });
    }
  } else {
    // This subscription no longer grants anything, but that is not the same as the
    // tenant having nothing. Recompute what is still live rather than blanket-setting
    // `free`: a tenant holding a second, better subscription must not be evicted
    // because an unrelated one ended.
    const remaining = all<SubscriptionRow>(
      "SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ('active', 'trialing') ORDER BY created_at DESC",
      input.tenantId
    );
    const best = remaining.reduce<SubscriptionRow | null>((top, s) => (!top || planRank(s.plan) > planRank(top.plan) ? s : top), null);
    const entitled = best?.plan ?? "free";
    run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", entitled, nowIso(), input.tenantId);
    audit({
      tenantId: input.tenantId,
      action: "billing.subscription_inactive",
      resource: resolvedPlan,
      meta: { status: input.status, was: orgPlan, now: entitled, stillActive: remaining.length },
    });
  }

  return sub!;
}

/** Cancel subscriptions under a tenant (by provider id when known) and drop status. */
export function cancelSubscriptionTracking(tenantId: string, providerId?: string | null) {
  if (providerId) {
    run(
      "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE tenant_id = ? AND provider_id = ?",
      nowIso(),
      tenantId,
      providerId
    );
  } else {
    run(
      "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE tenant_id = ? AND status IN ('active', 'trialing')",
      nowIso(),
      tenantId
    );
  }
  audit({ tenantId, action: "billing.subscription_canceled", resource: providerId ?? "" });
}

export function activeSubscription(tenantId: string): SubscriptionRow | undefined {
  return row<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1`,
    tenantId
  );
}

export function subscriptionsFor(tenantId: string): SubscriptionRow[] {
  return all<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
}

/**
 * Record the mandate a checkout session just opened. Status `pending` means
 * "Cashfree returned a session but we have not seen it become active yet".
 * The subscription webhook promotes it; `syncPendingCashfreeSubscription` is
 * the fallback for when that webhook has not been configured in the dashboard.
 */
export function trackPendingSubscription(input: {
  tenantId: string;
  provider: string;
  providerId: string;
  plan: string;
  currency: string;
}): void {
  if (row("SELECT id FROM subscriptions WHERE provider = ? AND provider_id = ?", input.provider, input.providerId)) return;
  const id = newId("sub");
  run(
    `INSERT INTO subscriptions (id, tenant_id, provider, provider_id, customer_id, status, plan, current_period_end, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.tenantId,
    input.provider,
    input.providerId,
    null,
    "pending",
    input.plan,
    null,
    input.currency,
    nowIso(),
    nowIso()
  );
}

/** Cashfree terminal states that mean the mandate will never collect again. */
const CF_TERMINAL = ["CANCELLED", "CUSTOMER_CANCELLED", "EXPIRED", "COMPLETED", "CARD_EXPIRED"];

/**
 * Reconcile an open Cashfree mandate against the live gateway. The webhook is
 * the primary path for promoting a subscription; this is the fallback so a
 * paying customer is not stranded when the dashboard webhook has not been
 * configured. Only an ACTIVE upstream subscription grants the plan — a local
 * `pending` row alone (or a spoofed `?upgraded=` query) can never invent one.
 *
 * `force` skips the debounce and is used for the explicit post-checkout return
 * (`/app/billing?upgraded=plan`); quiet page loads reconcile at most once a
 * minute so a lingering row does not hammer the gateway.
 */
export async function syncPendingCashfreeSubscription(tenantId: string, opts: { force?: boolean } = {}): Promise<void> {
  const pending = row<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE tenant_id = ? AND provider = 'cashfree' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  if (!pending?.provider_id) return;

  if (!opts.force) {
    const ageMs = Date.now() - new Date(pending.updated_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 60_000) return;
  }

  let info: CfSubscription;
  try {
    info = await fetchSubscription(pending.provider_id);
  } catch (e) {
    console.error("[billing.sync] cashfree status fetch failed:", e instanceof Error ? e.message : e);
    return;
  }

  const cfStatus = String(info.subscription_status || "").toUpperCase();
  if (CF_TERMINAL.includes(cfStatus)) {
    cancelSubscriptionTracking(tenantId, pending.provider_id);
    return;
  }
  if (cfStatus === "ACTIVE") {
    applySubscription({
      tenantId,
      plan: pending.plan,
      provider: "cashfree",
      providerId: pending.provider_id,
      status: "active",
      currentPeriodEnd: info.next_schedule_date || null,
      currency: pending.currency,
    });
  }
  // INITIALIZED / BANK_APPROVAL_PENDING / ON_HOLD are not collecting yet; the
  // subscription webhook (when configured) or a later sync promotes them.
}