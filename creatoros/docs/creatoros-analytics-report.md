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
| Conversion rate | conversions ÷ eligible visitors or sessions | window | `analytics_events`, `funnel_events` | The tenant tracker gates on consent, not on dwell; a bot that executes JS there is still indistinguishable from a human. Marketing `site_visits` is dwell-gated (next row) |
| Marketing page view | One `site_visits` row, written only after 30 s on the page or the first scroll/pointer/key/touch (`createViewGate`) | window | `site_visits` | A load-and-leave never counts, so short bounces are missing by design; a monitor that stays 30 s or scrolls still counts |
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
- Since 2026-10-31 the same cookie also labels each marketing page view (`site_visits.utm_source`
  and `utm_campaign`, migration 25), so the admin traffic panel shows which post or ad produced the
  visits, not only which one produced the signup. A tagged view is reported under its campaign and
  not again under its referrer, so nothing is counted twice. Existing rows stay untagged.

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
| Marketing page views are dwell-gated, not audited | A view counts only after 30 s on the page or a real interaction (`createViewGate`), so the load-and-leave monitors seen on 30 Oct no longer register. A bot that stays 30 s or scrolls still counts, and real bounces under 30 s are deliberately not counted. Raw hits stay in the Caddy access log |
| Provider-side bounces not ingested | Email delivery metrics stop at "provider accepted" |
| Bookings have no collected amount | Booking value is shown as a separate figure, never added to revenue |

## 9. Traffic snapshot — 2026-10-30 (read from the production DB)

First-party numbers from `site_visits` (server-side beacon, no cookie) plus the Caddy access log.
Read at 19:17 UTC, so 30 Oct is a partial day.

| Metric | Value |
| --- | --- |
| 30 Oct so far | 135 page views, 96 visitor-days |
| Last 7 days | 568 page views, 396 visitor-days |
| Previous 7 days | 345 page views, 242 visitor-days |
| Since tracking began (2026-10-19) | 1,048 page views, 734 visitor-days, 1.43 views per visitor |
| Countries, 30 days | IN 889, US 115, NL 24, ID 8, JP 4, FR 2, ES 2, PK/IE/DE/CN 1 each, **GB 0** |
| Referrers, 7 days | youtube.com 384, direct 298, l.instagram.com 6, reddit 5, google 4, facebook 3, brevo 1 |
| Devices, 7 days | mobile 536 (76%), desktop 167 |
| Pages, 7 days | `/` 516, `/auth/login` 69, `/pricing` 50, `/blog` 25, `/auth/register` 24, `/etsy-fee-calculator` 3 |
| Funnel, 30 days | 4 signups, 2 activations, 5 `checkout_started` (last one 2026-10-20) |
| Accounts | 5 users (2 test, 1 owner, 1 verification, 1 real on 2026-10-28), 3 contacts, 0 orders, 0 payments |

Two things this snapshot does not show, both checked directly:

- **A monitoring service inflates the dashboard.** On 30 Oct, 36 of 68 `/api/site-view` beacons came
  from nine Azure addresses (`20.25.10.64`, `52.225.78.140`, `20.106.231.193`, `20.171.125.128`,
  `20.171.4.213`, `20.161.47.116`, `4.155.196.102`, `132.196.38.98`, `172.185.167.41`) sending a
  macOS Chrome 136 user agent and walking `/` → `/pricing` → `/blog`. The same addresses call
  `/api/health` about twice a minute. `isLikelyBot` only inspects the user agent, so these are
  recorded as US desktop visitors. Real human page views on 30 Oct were closer to 99 than 135, and
  the `/pricing` figure (21 today) is roughly a third machine traffic.
- **The UK has no traffic at all.** Zero requests with `cf-ipcountry: GB` in the access log, and no
  `GB` row in `site_visits` in 30 days. What traffic exists is 89% India, referred by YouTube.
  The US/UK positioning has not reached its own audience yet.

Also seen in the same window: 40 `404`s, almost all a WordPress scanner from one NL address probing
`/wp`, `/wordpress`, `/cms`, `/press`, `/wp-json`; four `403`s on `/api/cron/email` at 12:06–12:12,
which are the pre-rotation `CRON_SECRET` calls already documented in the security report. No action
needed on either.

Attribution gap worth knowing before the outreach links go out: `site_visits` had no UTM columns, so
campaign tags were not visible in the marketing-site traffic panel. Signup attribution did work —
`UtmCapture` stores the tags in a first-party cookie and `/api/auth/register` forwards them — so a
signup from `utm_source=outreach` was attributable even though the page views were not. This was closed
on 2026-10-31 (migration 25 plus the beacon change): page views now carry `utm_source`/`utm_campaign`
and the panel shows a "Top sources" table.
