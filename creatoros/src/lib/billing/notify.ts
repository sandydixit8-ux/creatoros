import { row } from "@/lib/db/db";
import { SITE_URL } from "@/lib/constants";
import { enqueueEmail, type EnqueueResult } from "@/lib/email/jobs";
import { formatMoneyCents, normalizeCurrency } from "@/lib/money-format";
import { PLAN_PRICES, type PriceCurrency } from "@/lib/plans";

/**
 * Billing lifecycle notifications (Gap 4, Workflow F).
 *
 * These are transactional: they tell a customer that money did or did not move.
 * They are therefore not gated on marketing consent, but they are absolutely
 * idempotent — a gateway that redelivers `past_due` five times must produce one
 * reminder, not five.
 */

interface OwnerContact {
  email: string;
  name: string;
}

/** The person who should hear about billing: the org owner, else any member. */
export function billingContact(tenantId: string): OwnerContact | null {
  const owner = row<OwnerContact>(
    `SELECT u.email AS email, u.name AS name
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ? AND m.role = 'owner'
     ORDER BY m.created_at ASC LIMIT 1`,
    tenantId
  );
  if (owner?.email) return owner;
  const any = row<OwnerContact>(
    `SELECT u.email AS email, u.name AS name
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ?
     ORDER BY m.created_at ASC LIMIT 1`,
    tenantId
  );
  return any?.email ? any : null;
}

function priceLabel(plan: string, currency: string): string {
  const table = PLAN_PRICES[plan];
  if (!table) return "";
  const major = table[normalizeCurrency(currency) as PriceCurrency];
  if (typeof major !== "number" || major <= 0) return "";
  return formatMoneyCents(major * 100, normalizeCurrency(currency));
}

/** The only secure place to update a payment method is the signed-in billing page. */
export function billingUrl(): string {
  return `${SITE_URL}/app/billing`;
}

/**
 * A renewal failed (or the mandate went on hold). One reminder per failure
 * window: keyed on the subscription id and the period that failed.
 */
export function notifyPaymentFailed(input: {
  tenantId: string;
  plan: string;
  providerId: string;
  currency?: string | null;
  periodEnd?: string | null;
}): EnqueueResult | null {
  const contact = billingContact(input.tenantId);
  if (!contact) return null;

  const window = (input.periodEnd || new Date().toISOString()).slice(0, 10);
  const price = priceLabel(input.plan, input.currency || "usd");
  const planName = input.plan.charAt(0).toUpperCase() + input.plan.slice(1);

  return enqueueEmail({
    tenantId: input.tenantId,
    to: contact.email,
    toName: contact.name,
    template: "subscription_payment_failed",
    subject: "We could not renew your CreatorOS subscription",
    idempotencyKey: `payment_failed:${input.providerId}:${window}`,
    kind: "transactional",
    html: `<div style="font:15px/1.6 sans-serif;max-width:520px;color:#111">
  <h2 style="margin:0 0 12px">Your last payment did not go through</h2>
  <p>Hi ${escapeHtml(contact.name || "there")},</p>
  <p>We tried to renew your <strong>${escapeHtml(planName)}</strong> plan${
    price ? ` (${escapeHtml(price)}/month)` : ""
  } but the payment was declined by your bank or card issuer.</p>
  <p>Your account still works for now. To keep it that way, update your payment method:</p>
  <p><a href="${billingUrl()}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Update payment method</a></p>
  <p style="color:#666;font-size:13px">If the payment is not completed, paid features will be paused. You can export your data at any time from Settings.</p>
  <p style="color:#666;font-size:13px">You are receiving this because it is a billing notice for your account, not marketing.</p>
</div>`,
  });
}

/**
 * The card worked again. Transactional, idempotent on the period that was
 * recovered, so a duplicate `active` webhook does not re-send it.
 */
export function notifyPaymentRecovered(input: {
  tenantId: string;
  plan: string;
  providerId: string;
  currency?: string | null;
  periodEnd?: string | null;
}): EnqueueResult | null {
  const contact = billingContact(input.tenantId);
  if (!contact) return null;

  const window = (input.periodEnd || new Date().toISOString()).slice(0, 10);
  const price = priceLabel(input.plan, input.currency || "usd");
  const planName = input.plan.charAt(0).toUpperCase() + input.plan.slice(1);

  return enqueueEmail({
    tenantId: input.tenantId,
    to: contact.email,
    toName: contact.name,
    template: "subscription_payment_recovered",
    subject: "Your CreatorOS payment went through",
    idempotencyKey: `payment_recovered:${input.providerId}:${window}`,
    kind: "transactional",
    html: `<div style="font:15px/1.6 sans-serif;max-width:520px;color:#111">
  <h2 style="margin:0 0 12px">You are all set</h2>
  <p>Hi ${escapeHtml(contact.name || "there")},</p>
  <p>The payment for your <strong>${escapeHtml(planName)}</strong> plan${
    price ? ` (${escapeHtml(price)}/month)` : ""
  } went through, and your account stays on the paid plan.</p>
  <p><a href="${billingUrl()}">View billing</a></p>
</div>`,
  });
}

/**
 * Cancellation confirmation. Keyed on the subscription alone: a customer
 * cancelling once should get one confirmation, even if the gateway redelivers
 * the deletion event.
 */
export function notifySubscriptionCanceled(input: {
  tenantId: string;
  plan: string;
  providerId: string;
}): EnqueueResult | null {
  const contact = billingContact(input.tenantId);
  if (!contact) return null;

  const planName = input.plan ? input.plan.charAt(0).toUpperCase() + input.plan.slice(1) : "paid";

  return enqueueEmail({
    tenantId: input.tenantId,
    to: contact.email,
    toName: contact.name,
    template: "subscription_canceled",
    subject: "Your CreatorOS subscription is cancelled",
    idempotencyKey: `subscription_canceled:${input.providerId}`,
    kind: "transactional",
    html: `<div style="font:15px/1.6 sans-serif;max-width:520px;color:#111">
  <h2 style="margin:0 0 12px">Your subscription is cancelled</h2>
  <p>Hi ${escapeHtml(contact.name || "there")},</p>
  <p>Your <strong>${escapeHtml(planName)}</strong> subscription has been cancelled and will not renew again. You will not be charged further.</p>
  <p>Your account and data stay available on the free plan. You can restart any time from billing.</p>
  <p><a href="${billingUrl()}">View billing</a></p>
</div>`,
  });
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
