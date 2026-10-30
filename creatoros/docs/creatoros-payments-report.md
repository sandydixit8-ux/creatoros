# CreatorOS — Payments and Subscription Report

Date: 2026-10-30

## 1. Provider capability matrix

| Capability | Dodo (MoR) | Cashfree | Stripe |
| --- | --- | --- | --- |
| Role for CreatorOS | Platform subscriptions, US/UK/intl | INR mandates (India) | Alternative card gateway |
| Currencies used here | USD, GBP (EUR supported by account, not priced) | INR | USD/GBP |
| Recurring billing | Yes — subscription products | Yes — subscriptions/mandates | Yes |
| Tax handling | **Provider is merchant of record** | Merchant | Merchant |
| 3-D Secure | Provider-hosted | Provider-hosted | Provider-hosted |
| Cancellation | `PATCH /subscriptions/{id}` | mandate cancel | API |
| Refunds | `POST /refunds` | supported | supported |
| Webhook scheme | Standard Webhooks HMAC | `x-webhook-signature` | `stripe-signature` |
| Settlement currency | Provider-configured | INR | Account-configured |

**Verified live (2026-10-27):** Dodo store configured tax-inclusive, GBP localized prices pinned per
price object, secondary brand `CreatorOS` on all four products, checkout matrix 8/8 correct for the
prices below.

## 2. What the customer is charged

Advertised price = charged price, because Dodo is tax-inclusive. Tax is included in the displayed
amount, not added at checkout.

| Plan | USD | GBP |
| --- | --- | --- |
| Starter | $9 | £7 |
| Creator | $19 | £15 |
| Pro | $49 | £39 |
| Business | $99 | £79 |

These values live only in `src/lib/plans.ts` (`PLAN_PRICES`) and are re-derived server-side at checkout.
The client cannot send a price.

## 3. Internal subscription state machine

| Internal status | Meaning | Entitled? |
| --- | --- | --- |
| `pending` | Checkout opened, no confirmed mandate yet | No |
| `active` | Paid and current | Yes |
| `trialing` | Trial period | Yes |
| `past_due` | Renewal failed, provider still retrying | **Yes, until `BILLING_GRACE_DAYS` (default 3) after the failed period** |
| `on_hold` | Provider paused collection | Same grace rule |
| `canceled` | Mandate ended | No |

Mapping from gateways:

- Dodo `subscription.active` / `subscription.renewed` → `active`
- Dodo `subscription.past_due` / `subscription.on_hold` → `past_due`
- Dodo `subscription.cancelled` / `.expired` / `.failed` → `canceled`
- Cashfree `ACTIVE` → `active`; `CANCELLED`/`EXPIRED`/`CARD_EXPIRED`/`COMPLETED` → `canceled`
- Stripe status strings pass through

`free` is never inferred from a missing plan. A plan is only lowered when something authoritative says
so (D-12 regression test).

## 4. Webhook handling

Single endpoint for all gateways: `POST /api/webhooks/stripe`.

1. Read the raw body; a signature header must be present (unsigned dashboard validation pings are
   answered 200 and do nothing).
2. Try each configured provider's verifier; the one that verifies owns the event.
3. Claim the event in `webhook_events` (unique per provider+event id) with a 5-minute lease.
4. Process. Success → `processed_at`; failure → `markWebhookFailed` and **HTTP 502** so the gateway
   retries.
5. A redelivery of a processed event returns `{duplicate: true}` and changes nothing.

Dodo replay protection: Standard Webhooks timestamp must be within ±5 minutes of server time.

## 5. Checkout and reconciliation

- Checkout is server-validated: session → plan exists → currency has a configured provider → price
  re-derived → `trackPendingSubscription` records the mandate as `pending`.
- On return, `/app/billing?upgraded=<plan>` forces reconciliation. A quiet visit reconciles at most
  once a minute.
- Cashfree: `GET /subscriptions/{id}` (base URL is the Cashfree subscriptions API host).
- Dodo: `GET /checkouts/{id}` → `subscription_id` → `GET /subscriptions/{id}`; the pending row is
  rebound from the checkout session id to the real subscription id.
- **Only an upstream active/grace status applies a plan.** A URL parameter can never grant access.

## 6. Dunning

| Step | Implementation |
| --- | --- |
| Detect failure | Webhook `past_due`/`on_hold`, or reconciliation reports the same |
| Record | `subscriptions.status`, `subscription_events`, audit row |
| Notify | `email_jobs` row `subscription_payment_failed` (transactional, idempotent per subscription+period) |
| Retry | Provider retry schedule; CreatorOS does not re-charge behind the provider |
| Warn before restriction | Email states that paid features pause if payment is not completed |
| Restore | `past_due → active` applies the plan and queues `subscription_payment_recovered` |
| Restrict | After `BILLING_GRACE_DAYS`, entitlement recomputes and the workspace drops to free |

Notifications are bounded: one reminder per failed period per subscription, regardless of how many
times the gateway redelivers the event.

## 7. Admin visibility

- `/admin` revenue panel: MRR, gross, refunds, net, lifetime net, MRR movement, active subscriptions,
  paid orders.
- Orders list shows `has_pending_refund`.
- Refund route: cumulative refunds, provider call outside the DB transaction, one in-flight refund per
  order (`idx_refunds_one_pending`), audit entry per refund.
- `webhook_events` keeps failed receipts with the reason.

## 8. Fees, taxes and settlement — what is and is not verified

- Fee percentages, payout timing and reserve terms are commercial terms in each provider dashboard.
  **They are not encoded in this repository and were not verified here.** Do not publish a fee rate
  that has not been read from the live account.
- Dodo is the merchant of record, so it remits sales tax/VAT. CreatorOS must not describe itself as
  the seller for those transactions.
- Creator sales (orders) are separate: no merchant-of-record gateway may be used for a creator's own
  products, because that would transfer title to the provider.

## 9. Residual gaps and required account actions

| Item | Owner action |
| --- | --- |
| Complete one real test-mode purchase | Human completes a £7 Starter checkout in Dodo test mode; verify plan, subscription row, confirmation email |
| Dodo live API key rotation | Dashboard → Developer → API keys |
| Dodo webhook configured for the live endpoint | Dashboard → Webhooks → add `https://usecreatoros.co/api/webhooks/stripe`, copy `whsec_` |
| Dispute/chargeback events | Map gateway dispute events to a local state (not implemented) |
| Local invoice PDF | Not implemented; provider-hosted receipts are the current mechanism |
| Tax registration/legal review | Qualified adviser required; no compliance is claimed |

## 10. Classification

| Feature | Status |
| --- | --- |
| Server-side price/plan validation | Implemented + tested |
| Geo/currency routing per provider | Implemented + verified live |
| Idempotent signed webhooks | Implemented + tested |
| Grace period on failed renewal | Implemented + tested |
| Dunning/recovery/cancellation email | Implemented + tested |
| Dodo reconciliation fallback | Implemented + tested |
| Refund ledger and entitlement consistency | Implemented + tested |
| Real end-to-end live transaction | **Blocked** (human + card) |
| Proration engine | Delegated to provider (by design) |
| Dispute handling | Missing |
