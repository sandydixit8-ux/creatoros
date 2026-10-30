# CreatorOS — Revenue Analytics Report

Date: 2026-10-30

## 1. Data sources (authoritative order)

| Question | Source of truth |
| --- | --- |
| Did a store sale happen? | `orders` (status `paid`) + `refunds` ledger |
| Did a platform subscription charge happen? | gateway webhook → `subscriptions` + `subscription_events` |
| Was money returned? | `refunds` (status `succeeded`) |
| Did a person visit a page? | `analytics_events` (first-party, JS-gated) |
| Did traffic reach the site at all? | `site_visits` beacon — **not** Caddy logs |
| Which campaign? | UTM captured at first landing, 90-day cookie, attached at signup |

Browser events never establish revenue. Revenue is only recorded from server-side fulfilment.

## 2. Metric definitions

| Metric | Formula | Window | Source | Known limitation |
| --- | --- | --- | --- | --- |
| Gross sales | Σ order `amount_cents` (status paid **or** refunded) + Σ non-order `payments.amount_cents` (succeeded/refunded) | report window, else all time | `orders`, `payments` | Bookings are shown separately as a value, not collected cash |
| Refunds | Σ `refunds.amount_cents` where status `succeeded` | window | `refunds` | Provider-initiated reversals that never reach the refund route would be missed |
| Net sales | Σ (paid order `amount_cents − refunded_cents`) + Σ non-order succeeded payments | window | `orders`, `payments` | A partially refunded order stays `paid`, which is why `refunded_cents` is subtracted |
| MRR | Σ list price of `active` paid subscriptions, per mandate currency | point in time | `subscriptions`, `plans.ts` | Grace (`past_due`) subscriptions are excluded from MRR but counted as entitled for access; grace is short by design |
| New MRR | 0 → paid transitions | window | `subscription_events` | Requires history, which starts at migration 24; earlier months are blank by definition |
| Expansion MRR | paid → higher paid | window | `subscription_events` | No proration is modelled; the plan's list price is used |
| Contraction MRR | paid → lower paid, still paid | window | `subscription_events` | Same |
| Churned MRR | paid → 0 | window | `subscription_events` | A grace account is not churn until grace expires |
| Net MRR movement | new + expansion − contraction − churned | window | derived | Per currency only; never blended |
| AOV | net sales ÷ paid orders | window | `orders` | Multi-currency orders are not comparable without FX, so read it per currency |
| Checkout completion | confirmed purchases ÷ checkout starts | window | `funnel_events` | A person may start checkout twice; denominator counts starts, not people |
| Signup → activation | users reaching the activation step ÷ signups | window | `funnel_events` | Activation definition is the first published page |
| Conversion rate | conversions ÷ eligible visitors or sessions | window | `analytics_events`, `funnel_events` | Bot traffic that executes JS is indistinguishable from a human |
| Email delivery rate | sent ÷ attempted | window | `email_jobs`, `email_sends` | Provider-side bounces are not ingested yet |
| Unsubscribe rate | unsubscribes ÷ delivered | window | `unsubscribes`, `email_sends` | — |

## 3. Event taxonomy

Platform funnel steps (`src/lib/funnel.ts`):

`signup_completed`, `onboarding_completed`, `page_published`, `checkout_started`,
`purchase_completed`, `subscription_canceled`.

Tenant analytics events (`src/lib/analytics/engine.ts`): `page_view`, `link_click`, `lead`,
`booking`, `purchase`, `checkout_started`.

Platform subscription billing is recorded in the funnel with `kind: "subscription"`, and creator sales
with `kind: "store"`/`"course"`. A subscription renewal is **not** a new creator sale.

Each analytics row carries: id, `tenant_id`, `page_id`, `event_type`, `event_name`, `visitor_id`,
`session_id`, referrer, UTM source/campaign, device, country, engagement, JSON properties, timestamp.

Deduplication: financial records are idempotent at the order/subscription layer; funnel steps are
append-only and are read by distinct entity where a count must not double.

## 4. What changed in this pass

1. **Refund-aware totals.** `revenueSnapshot()` returns `gross`, `refunds`, `net` per currency.
   `period` is kept as an alias of `net` so existing screens keep working.
2. **Double-count fix.** One store sale writes an order *and* a payment row. Every report summed both.
   Order-linked payments are now excluded; the order is authoritative.
3. **MRR movement.** New `subscription_events` table (migration 24) written by `applySubscription()`
   on real transitions only, plus `mrrMovement()`.
4. **Monthly series honesty.** Refunded orders stay in the month sold; refunds subtract in the month
   returned; the bar scale is floored at 0 so a refund-heavy month cannot draw a negative bar.
5. **UI.** Creator analytics shows "net of refunds" and, when non-zero, `collected · refunded`.
   Admin revenue panel shows gross/refunds/net/lifetime and the five movement figures.

## 5. Reconciliation

- `gross − refunds = net` is asserted in `money-refunds.test.ts` on real rows (paid, partially
  refunded, fully refunded, standalone payment).
- Tenant isolation is asserted in the same file: another tenant's order never appears.
- Duplicate webhook → the order remains one row, so revenue appears once.
- The admin panel and the creator dashboard use the same definitions, so they cannot disagree about
  what "net" means.

## 6. Attribution

- Model: **last-touch within the UTM cookie lifetime (90 days)**, attached at signup registration.
- The cookie is first-party and consent-gated for ad pixels; UTM capture itself is not an ad pixel.
- First-touch is not stored separately. Do not claim first-touch or multi-touch attribution.
- Unknown attribution is labelled as direct/unknown rather than guessed.

## 7. Privacy

- No email address, card data or gateway secret is written to analytics rows.
- Visitor identifiers are hashed; `site_visits` retains country only at the level the edge provides.
- Retention is enforced by `/api/cron/analytics-retention` (`ANALYTICS_RETENTION_DAYS`, default 400).

## 8. Known limitations

| Limitation | Consequence |
| --- | --- |
| No historical subscription events before migration 24 | MRR movement is empty for periods before this deploy |
| MRR uses list price, not the actual charged amount | A manual discount in the gateway is not reflected |
| No FX conversion | Totals are always per currency; a blended number is never shown |
| Bot traffic that runs JS inflates visits | Traffic reports are directionally useful, not audited |
| Provider-side bounces not ingested | Email delivery metrics stop at "provider accepted" |
| Bookings have no collected amount | Booking value is shown as a separate figure, never added to revenue |
