# CreatorOS — Implementation Plan (Phases 2–7)

Companion to `creatoros-gap-audit.md`. This records what was actually changed, why, and in what order.
Nothing here is a mockup: every item marked **shipped** exists in the repository and passed the checks
listed in `creatoros-test-plan.md`.

---

## Phase 2 — Payment and subscription reliability

### 2.1 Grace window for failed renewals

- **Files:** `src/lib/billing/subscriptions.ts`, `.env.example`
- **Problem:** only `active`/`trialing` were entitled, so the first `past_due` webhook stripped a paying
  customer's plan. That is the most expensive possible reaction to an expired card.
- **Change:**
  - `GRACE_STATUSES = ["past_due", "on_hold"]`
  - `graceDays()` reads `BILLING_GRACE_DAYS`, default **3**, clamped to 0–30
  - `isEntitled()` grants active/trialing always, and grace statuses until `graceDays()` after the
    failed period
  - `applySubscription()` keeps the plan during grace and only recomputes the tenant's entitled plan
    when grace is actually over
  - `activeSubscription()` now returns a graced subscription, so the billing page and the cancel route
    still see it
- **Anchor decision:** grace is measured from `current_period_end` (stable across redeliveries), not
  from the arrival time. A gateway retrying every day cannot extend access indefinitely. Only when the
  provider supplied no period at all does it fall back to `updated_at`.
- **Rollback:** set `BILLING_GRACE_DAYS=0`; behaviour returns to immediate downgrade. No schema change.

### 2.2 Dodo checkout reconciliation

- **Files:** `src/lib/payments/dodo-provider.ts`, `src/lib/billing/subscriptions.ts`,
  `src/app/app/billing/page.tsx`
- **Problem:** `createSubscriptionSession` only has the checkout **session** id, so the pending row was
  keyed on `chk_...`. Webhooks and the subscription API speak `sub_...`. With no webhook the row stayed
  `pending` forever.
- **Change:**
  - `fetchDodoCheckoutSubscription(sessionId)` → `GET /checkouts/{id}` → `subscription_id` →
    `GET /subscriptions/{id}`
  - `syncPendingDodoSubscription()` rebinds the pending row to the real id, closes the placeholder if
    the webhook already created the real row, and applies the upstream status
  - `syncPendingSubscription()` reconciles Cashfree **and** Dodo; the billing page calls it
- **Safety:** an unpaid or authorising session still grants nothing; only upstream `active`/`past_due`
  applies a plan. A spoofed `?upgraded=` cannot invent a payment.
- **Debounce:** quiet page loads reconcile at most once a minute; the post-checkout return forces it.

### 2.3 Dunning and lifecycle mail from the webhook

- **Files:** `src/app/api/webhooks/stripe/route.ts`, `src/lib/billing/notify.ts`
- **Change:** on `customer.subscription.updated` with `past_due`/`on_hold` → queue
  `subscription_payment_failed`. On `past_due` → `active` → queue `subscription_payment_recovered`.
  On `customer.subscription.deleted` → queue `subscription_canceled`.
- **Non-blocking:** the webhook only inserts a row into `email_jobs`. Sending happens later, so a mail
  outage cannot turn a payment acknowledgement into a 502 (which the gateway would then retry).
- **Idempotency:** `payment_failed:<sub>:<period>`, `payment_recovered:<sub>:<period>`,
  `subscription_canceled:<sub>`. Redelivery and a second gateway ping for the same failure produce one
  email.

### 2.4 Provider decision — no switch

Cashfree stays for INR, Stripe stays as the alternative card gateway, Dodo stays the MoR for US/UK.
No provider was added or removed. The reasoning is recorded in `docs/PAYMENTS-DODO.md` and the audit:
a MoR removes the tax/remittance burden for US/UK sales from an Indian entity, which is exactly what
this business needs; Cashfree cannot settle those currencies, and Stripe leaves tax handling with us.

## Phase 3 — USP and conversion

Shipped in this phase:

- Geo-aware, tax-inclusive pricing copy (already live; verified, not re-changed).
- Billing page now reports what actually happened after checkout via provider-agnostic reconciliation,
  so a paid customer sees the paid plan instead of "free".
- Analytics dashboard separates **net** from **gross/refunds** and labels it, so the number a creator
  reads is the number they were paid.

Deliberately **not** shipped without approval (see §Experiments):

- Any price change, discount, annual plan or trial change.
- Testimonials, customer counts, revenue claims or competitor comparisons.

## Phase 4 — Revenue analytics

### 4.1 Refund-aware totals — `src/lib/analytics/money.ts`

`revenueSnapshot()` now returns:

- `gross` — money collected in the window (paid **and** later-refunded orders, plus non-order charges)
- `refunds` — succeeded rows in the `refunds` ledger
- `net` — money retained (`paid − refunded_cents` + non-order succeeded charges)
- `period` — kept as an alias of `net` for existing callers
- `lifeTime` — net, all time

Documented rules:

- A partially refunded order keeps `status='paid'` and carries `refunded_cents`, so `net` subtracts it.
- A fully refunded order is `status='refunded'`: it is in `gross`, excluded from `net`.
- Refunds come from the `refunds` table, not from a subtraction guess, so `gross − refunds = net`
  holds for real data.

### 4.2 Double-count fix

`store/orders.ts` writes **both** an order row and a payment row for one sale. The old report summed
both tables. Payments are now counted only when `COALESCE(order_id,'') = ''`, making the order table
authoritative for store revenue. Applied in `revenueSnapshot`, `revenueMonthlySeries`, `platformRevenue`
and the admin panel.

### 4.3 MRR movement

- **Schema:** `subscription_events` (migration **24**), indexed `(tenant_id, created_at)`.
- **Writer:** `applySubscription()` appends a row only when plan or status actually changes, so routine
  renewal pings do not create history.
- **Reader:** `mrrMovement({ tenantId?, days })` → `new`, `expansion`, `contraction`, `churned`, `net`
  per currency, costed at list price in the mandate's own currency (no FX).
- **Rules:** `past_due`/`on_hold` count as paid, so a grace account is not reported as churn.
  `paid → 0` is churn; `paid → lower paid` is contraction.
- **Surfaced:** admin revenue panel (platform-wide), 30-day window.

### 4.4 Monthly series

- Orders stay in the month they were sold; refunds land in the month the money went back.
- Bar scale is floored at 0 so a refund-heavy month cannot draw a negative bar; the true signed figure
  stays in `byCurrency`.

### 4.5 Metric definitions

Written in `creatoros-analytics-report.md` with formula, source, window and limitation for each metric.

## Phase 5 — Email automation

### 5.1 Durable outbox

- **Files:** `src/lib/email/jobs.ts`, migration **23** (`email_jobs`), `src/app/api/cron/email/route.ts`
- **Why not a workflow engine:** the requirement is "persistent, retried, idempotent, observable". One
  table plus one drain function does that with a fraction of the code and no new dependency.
- **Guarantees:**
  - `idempotency_key` UNIQUE → enqueueing the same logical message twice inserts once
  - claim-then-send (`status='sending'`) so two concurrent drains never double-send
  - exponential backoff `60s · 2^n`, capped at 6 h, `dead` at `max_attempts` (default 5)
  - marketing kind is suppressed against the `unsubscribes` list; transactional is not, because
    "your card was declined" is not marketing
  - `recentEmailJobs()` exposes state for support without the HTML body
- **Cron:** `GET|POST /api/cron/email`, gated by `authorizedCron` (Bearer/`?secret=`, else owner/admin
  session). Intended cadence: every minute.

### 5.2 Templates shipped

Payment failed, payment recovered, subscription cancelled — all transactional, mobile-readable,
plain HTML, no tracking pixels.

### 5.3 Not shipped, and why

Welcome/onboarding, abandoned-checkout recovery, lead-magnet delivery and booking reminders need
product decisions that are not in the repo (which goal maps to which message, how long a checkout is
"abandoned", which booking reminder offsets). Shipping them with invented defaults would send real
mail to real people on rules nobody approved. They are specified below with the exact trigger, delay,
stop condition and consent rule so they can be enabled deliberately.

## Phase 6 — Verification

Executed on 2026-10-30 from a clean working tree:

| Command | Result |
| --- | --- |
| `npx vitest run` | **51 files / 505 tests passed** (was 462 before this work) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 6 warnings (all pre-existing, in `marketing/publisher/*.mjs` and `totp.ts`) |
| `npm run build` | succeeded; all routes compiled |

Exact per-file results are in `creatoros-test-plan.md`.

## Phase 7 — Documentation

- `docs/creatoros-gap-audit.md`
- `docs/creatoros-implementation-plan.md` (this file)
- `docs/creatoros-test-plan.md`
- `docs/creatoros-payments-report.md`
- `docs/creatoros-analytics-report.md`
- `docs/creatoros-email-report.md`
- `docs/creatoros-security-report.md`
- `docs/creatoros-deployment-guide.md`
- `docs/creatoros-acceptance-checklist.md`
- `.env.example` updated (Dodo webhook, cron drain, grace window)

## Proposed conversion experiments (need approval)

Each experiment states hypothesis, segment, primary metric, guardrail, decision rule. None is live.

| # | Hypothesis | Segment | Primary metric | Guardrail | Decision rule |
| --- | --- | --- | --- | --- | --- |
| E1 | "Start free" beats "See pricing" above the fold | Coaches + digital-product creators | Homepage visit → signup | Signup→activation | Ship if signup rate improves ≥10% with no activation drop >2pp, n ≥ 400/arm |
| E2 | Showing limits on the pricing table reduces surprise-upgrade churn | Free users near a limit | Upgrade rate within 7 days of hitting a limit | Refund rate, support tickets | Ship if upgrade rate rises with refunds flat |
| E3 | A 3-email onboarding sequence increases first-published-page rate | New signups | Signup → first published page (7d) | Unsubscribe rate < 0.5% | Ship if activation rises ≥5pp |
| E4 | Annual plan at 2 months free increases cash collection | Paying users at renewal | 12-month cash collected | Monthly churn | Requires billing support for annual periods first |
| E5 | Abandoned-checkout email (1 h, 24 h) recovers ≥5% | Checkout starters | Checkout completion | Complaint rate | Ship only after consent copy is reviewed |

## Sequencing rationale

Payments first because a broken state machine loses money that analytics and email cannot recover.
Analytics second because without honest numbers every later experiment is noise. Email third because
its triggers depend on the payment and order events that now exist. Conversion copy last because it is
cheap to change but expensive to measure without the other three.
