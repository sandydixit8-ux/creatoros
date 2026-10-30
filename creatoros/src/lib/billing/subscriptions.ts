import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { planRank } from "@/lib/plans";
import { normalizeCurrency } from "@/lib/money-format";
import { audit } from "@/lib/audit";
import { fetchSubscription, type CfSubscription } from "@/lib/payments/cashfree-subscriptions";
import { fetchDodoCheckoutSubscription, type DodoSubscriptionInfo } from "@/lib/payments/dodo-provider";

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
 * Statuses that mean "the money did not arrive this period, but the customer has
 * not left". A provider that retries a failed renewal reports one of these while
 * it is still trying, and the account is expected to keep working until the
 * retry window closes.
 *
 * Treating them as instantly inactive — which is what the old code did, because
 * only `active`/`trialing` were in `ACTIVE_STATUSES` — threw a paying customer
 * off their paid plan the moment a card expired, before they had any chance to
 * update it. The comment in `dodo-provider.ts` already promised a grace window;
 * this is where that promise is kept.
 */
export const GRACE_STATUSES = ["past_due", "on_hold"] as const;

/** Clamp the operator setting to something a human could defend to a customer. */
export function graceDays(): number {
  const raw = Number(process.env.BILLING_GRACE_DAYS ?? "3");
  if (!Number.isFinite(raw)) return 3;
  return Math.min(30, Math.max(0, Math.floor(raw)));
}

/**
 * Is this subscription granting paid features right now?
 *
 * `active`/`trialing` always are. A grace status is entitled only until
 * `graceDays()` after the period that failed, so a permanently broken card
 * cannot keep a paid plan forever. The anchor is `current_period_end` when the
 * gateway supplied one (stable across redeliveries — the same `past_due` event
 * cannot silently extend the window); only when there is no period at all do we
 * fall back to the row's `updated_at`, because there is nothing better to use.
 */
export function isEntitled(
  sub: Pick<SubscriptionRow, "status" | "current_period_end" | "updated_at">,
  nowMs: number = Date.now()
): boolean {
  if (ACTIVE_STATUSES.includes(sub.status as (typeof ACTIVE_STATUSES)[number])) return true;
  if (!GRACE_STATUSES.includes(sub.status as (typeof GRACE_STATUSES)[number])) return false;

  const anchor = sub.current_period_end || sub.updated_at;
  const anchorMs = new Date(anchor).getTime();
  if (!Number.isFinite(anchorMs)) return false;

  const days = graceDays();
  if (days === 0) return false;
  return nowMs - anchorMs <= days * 24 * 60 * 60 * 1000;
}

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
  // currency when we have genuinely never seen one. Anything the product cannot
  // bill in is coerced to USD by normalizeCurrency rather than stored as-is.
  const knownCurrency = normalizeCurrency(
    input.currency || existing?.currency || process.env.BILLING_CURRENCY || "usd"
  );

  let sub: SubscriptionRow | undefined = existing;
  // Snapshot the prior state before the upsert: `subscriptions` is overwritten in
  // place, so this is the last moment the old plan/status can be read for MRR
  // movement. `''` means no prior subscription existed.
  const priorPlan = existing?.plan ?? "";
  const priorStatus = existing?.status ?? "";
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

  // Append history only for real transitions. A renewal webhook that restates
  // `active/creator` must not add a row, or every gateway retry would look like
  // a new subscription and inflate MRR movement.
  if (priorPlan !== resolvedPlan || priorStatus !== input.status) {
    run(
      `INSERT INTO subscription_events
         (id, tenant_id, subscription_id, provider, from_plan, to_plan,
          from_status, to_status, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("sev"),
      input.tenantId,
      sub!.id,
      input.provider,
      priorPlan,
      resolvedPlan,
      priorStatus,
      input.status,
      knownCurrency,
      nowIso()
    );
  }

  // Grace is anchored to the failed period, not to the moment this particular
  // event arrived: redelivering the same `past_due` must not reset the clock.
  const graceAnchor = {
    status: input.status,
    current_period_end: sub!.current_period_end,
    updated_at: existing?.updated_at ?? sub!.updated_at,
  };
  const entitledByGrace =
    GRACE_STATUSES.includes(input.status as (typeof GRACE_STATUSES)[number]) && isEntitled(graceAnchor);

  if (isActive) {
    if (input.plan) {
      run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", resolvedPlan, nowIso(), input.tenantId);
      audit({ tenantId: input.tenantId, action: "billing.subscription_active", resource: resolvedPlan, meta: { provider: input.provider, providerId: input.providerId } });
    } else {
      // Active, but the gateway withheld the plan. Grant nothing new and take
      // nothing away - guessing either way would be inventing billing state.
      audit({ tenantId: input.tenantId, action: "billing.subscription_plan_unknown", resource: resolvedPlan, meta: { provider: input.provider, providerId: input.providerId, status: input.status } });
    }
  } else if (entitledByGrace) {
    // Payment failed but the retry window is still open. Keep the plan; the
    // customer has been emailed a way to fix the card (see billing/notify.ts)
    // and dropping them here would punish an expired card, not a churn decision.
    run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", resolvedPlan, nowIso(), input.tenantId);
    audit({
      tenantId: input.tenantId,
      action: "billing.subscription_grace",
      resource: resolvedPlan,
      meta: {
        provider: input.provider,
        providerId: input.providerId,
        status: input.status,
        graceDays: graceDays(),
        anchor: graceAnchor.current_period_end,
      },
    });
  } else {
    // This subscription no longer grants anything, but that is not the same as the
    // tenant having nothing. Recompute what is still live rather than blanket-setting
    // `free`: a tenant holding a second, better subscription must not be evicted
    // because an unrelated one ended. Grace-period rows count as live.
    const candidates = all<SubscriptionRow>(
      "SELECT * FROM subscriptions WHERE tenant_id = ? AND status NOT IN ('canceled', 'pending') ORDER BY created_at DESC",
      input.tenantId
    );
    const remaining = candidates.filter((s) => isEntitled(s));
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

/**
 * The subscription currently granting access, if any.
 *
 * This includes a `past_due`/`on_hold` row while its grace window is open: the
 * customer is still on the paid plan, still sees it on the billing page, and must
 * still be able to cancel it. An expired grace row grants nothing and is skipped.
 */
export function activeSubscription(tenantId: string): SubscriptionRow | undefined {
  const candidates = all<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE tenant_id = ? AND status NOT IN ('canceled', 'pending') ORDER BY created_at DESC",
    tenantId
  );
  const entitled = candidates.filter((s) => isEntitled(s));
  entitled.sort((a, b) => {
    const aStrict = ACTIVE_STATUSES.includes(a.status as (typeof ACTIVE_STATUSES)[number]) ? 0 : 1;
    const bStrict = ACTIVE_STATUSES.includes(b.status as (typeof ACTIVE_STATUSES)[number]) ? 0 : 1;
    if (aStrict !== bStrict) return aStrict - bStrict;
    return planRank(b.plan) - planRank(a.plan);
  });
  return entitled[0];
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

/**
 * Reconcile an open Dodo checkout against the live API.
 *
 * Same fallback shape as the Cashfree sync, with one extra step that Cashfree
 * does not need: the pending row is keyed on the *checkout session* id because
 * that is all `createSubscriptionSession` can return, while webhooks and the
 * subscription API speak in `sub_...` ids. If the webhook is missing or lost,
 * the row would otherwise stay `pending` forever and a paying customer would
 * never receive the plan.
 *
 * So this resolves session -> subscription id, rebinds the row to the real id
 * (or closes the placeholder if the webhook already created the real row), and
 * then applies the upstream status. Only an upstream `active`/`past_due` grants
 * anything; an unpaid or authorising session still grants nothing.
 */
export async function syncPendingDodoSubscription(tenantId: string, opts: { force?: boolean } = {}): Promise<void> {
  const pending = row<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE tenant_id = ? AND provider = 'dodo' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  if (!pending?.provider_id) return;

  if (!opts.force) {
    const ageMs = Date.now() - new Date(pending.updated_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 60_000) return;
  }

  let info: DodoSubscriptionInfo | null;
  try {
    info = await fetchDodoCheckoutSubscription(pending.provider_id);
  } catch (e) {
    console.error("[billing.sync] dodo status fetch failed:", e instanceof Error ? e.message : e);
    return;
  }
  if (!info) return; // Session exists but has no subscription yet: nothing to grant.

  const realId = info.subscriptionId;
  if (realId !== pending.provider_id) {
    const clash = row<SubscriptionRow>(
      "SELECT * FROM subscriptions WHERE provider = 'dodo' AND provider_id = ? AND id != ?",
      realId,
      pending.id
    );
    if (clash) {
      // The webhook beat us to it and already owns the real id. The placeholder
      // has no further purpose; close it rather than leaving two live rows.
      run("UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE id = ?", nowIso(), pending.id);
      audit({ tenantId, action: "billing.subscription_placeholder_closed", resource: pending.provider_id, meta: { realId } });
    } else {
      run("UPDATE subscriptions SET provider_id = ?, updated_at = ? WHERE id = ?", realId, nowIso(), pending.id);
      audit({ tenantId, action: "billing.subscription_rebound", resource: realId, meta: { from: pending.provider_id } });
    }
  }

  if (info.status === "canceled") {
    cancelSubscriptionTracking(tenantId, realId);
    return;
  }
  if (info.status === "pending") return;

  applySubscription({
    tenantId,
    plan: pending.plan,
    provider: "dodo",
    providerId: realId,
    status: info.status,
    currentPeriodEnd: info.currentPeriodEnd,
    currency: info.currency || pending.currency,
  });
}

/**
 * Reconcile whatever gateway has an open pending row for this tenant. Callers
 * should not have to know which provider the visitor picked, so the billing page
 * uses this instead of the provider-specific functions.
 */
export async function syncPendingSubscription(tenantId: string, opts: { force?: boolean } = {}): Promise<void> {
  await Promise.all([
    syncPendingCashfreeSubscription(tenantId, opts),
    syncPendingDodoSubscription(tenantId, opts),
  ]);
}