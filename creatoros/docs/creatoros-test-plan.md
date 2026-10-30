# CreatorOS — Test Plan and Executed Results

Date executed: 2026-10-30
Environment: Windows, Node 22, repo `creatoros/`, each test file uses its own temporary SQLite file so
no test touches the production database. No real payment or marketing email is sent by any test:
the mailer is mocked in queue tests, gateway HTTP is stubbed, and webhooks are signed locally with a
test secret.

---

## 1. Commands and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **Pass** (no output) |
| `npm run lint` | **Pass** — 0 errors, 6 warnings (all pre-existing) |
| `npx vitest run` | **Pass — 51 files, 505 tests, 0 failed** |
| `npm run build` | **Pass** — production build completed, all routes compiled |

Baseline before this work was 462 tests. This work added **43** tests across 6 new files.

### Pre-existing lint warnings (not introduced here)

```
marketing/publisher/linkedin.mjs:61  'PUBLIC_BASE' unused
marketing/publisher/youtube.mjs:147  unused expression
marketing/publisher/youtube.mjs:272  'data' unused
marketing/publisher/youtube.mjs:278  'calendar' unused
marketing/publisher/youtube.mjs:283  'rowKey' unused
src/lib/auth/totp.ts:12              'STEP_MS' unused
```

## 2. Full test inventory (executed)

```
✓ src/lib/payments/payments.test.ts            (52)
✓ src/lib/analytics/reporting.test.ts          (9)
✓ src/lib/orders-transactional.test.ts         (17)
✓ src/lib/payments/dodo-webhook.test.ts        (18)
✓ src/lib/webhook-delivery.test.ts             (13)
✓ src/lib/billing/subscriptions.test.ts        (14)
✓ src/lib/subscription-plan-downgrade.test.ts  (10)
✓ src/lib/analytics/money.test.ts              (10)
✓ src/lib/analytics/money-refunds.test.ts      (9)   ← new
✓ src/lib/billing/grace.test.ts                (12)  ← new
✓ src/lib/billing/dodo-sync.test.ts            (6)   ← new
✓ src/lib/billing/dunning-webhook.test.ts      (4)   ← new
✓ src/lib/email/jobs.test.ts                   (8)   ← new
✓ src/lib/cron-email.test.ts                   (4)   ← new
✓ src/lib/email/mailer.test.ts                 (17)
✓ src/lib/email/engine.test.ts                 (8)
✓ src/lib/consent-gate.test.ts                 (19)
✓ src/lib/consent.test.ts                      (20)
✓ src/lib/consent-receipt.test.ts              (13)
✓ src/lib/contacts-consent.test.ts             (6)
✓ src/lib/admin/engine.test.ts                 (9)
✓ src/lib/store/orders.test.ts                 (5)
✓ src/lib/funnel.test.ts                       (10)
✓ src/lib/analytics/engine.test.ts             (5)
✓ src/lib/analytics/alerts.test.ts             (6)
✓ src/lib/analytics/links.test.ts              (11)
✓ src/lib/analytics/retention.test.ts          (4)
✓ src/lib/analytics/assistant.test.ts          (3)
✓ src/lib/site/traffic.test.ts                 (4)
✓ src/lib/auth/session.test.ts                 (12)
✓ src/lib/auth/password.test.ts                (4)
✓ src/lib/auth/password-reset.test.ts          (10)
✓ src/lib/auth/email-verify.test.ts            (9)
✓ src/lib/auth/email-change.test.ts            (8)
✓ src/lib/auth/totp.test.ts                    (9)
✓ src/lib/auth/mfa-token.test.ts               (5)
✓ src/lib/plans.test.ts                        (9)
✓ src/lib/templates.test.ts                    (7)
✓ src/lib/usage.test.ts                        (10)
✓ src/lib/courses/engine.test.ts               (6)
✓ src/lib/booking/slots.test.ts                (9)
✓ src/lib/community/engine.test.ts             (7)
✓ src/lib/notifications/engine.test.ts         (4)
✓ src/lib/account/gdpr.test.ts                 (6)
✓ src/lib/etsy-fees.test.ts                    (11)
✓ src/lib/url-safety.test.ts                   (10)
✓ src/lib/blog.test.ts                         (3)
✓ src/lib/ai/client.test.ts                    (12)
✓ src/app/api/coach/analyze/route.test.ts      (14)
✓ src/lib/payments/stripe-webhook.test.ts      (10)
✓ src/lib/payments/cashfree-provider.test.ts   (4)
```

## 3. Behavioural contracts covered by the new tests

### 3.1 Grace window — `src/lib/billing/grace.test.ts` (12)

- inside the window: `pro` stays `pro` on `past_due`
- outside the window: drops to `free`
- a `past_due` event redelivered five times does **not** extend the window
- `BILLING_GRACE_DAYS=0` → immediate downgrade
- nonsense values clamp (9999→30, -4→0, text→3)
- cancellation still downgrades immediately
- a second, better live subscription keeps the tenant when the graced one lapses
- `subscription_events` records a real transition once, not once per identical ping
- `isEntitled` boundary cases for active/trialing/canceled/pending/period-anchored/fallback

### 3.2 Dodo reconciliation — `src/lib/billing/dodo-sync.test.ts` (6)

- paid session promotes the plan and rebinds `chk_…` → `sub_…`
- a session with no subscription yet grants nothing and stays `pending`
- `cancelled` closes the mandate and downgrades
- `on_hold` inside grace keeps the plan (`past_due`)
- webhook-first race: the placeholder is closed, exactly one live mandate remains
- API failure leaves the row `pending` (no partial grant)

### 3.3 Dunning webhook — `src/lib/billing/dunning-webhook.test.ts` (4)

- a signed `subscription.on_hold` queues exactly one `subscription_payment_failed` and keeps the plan
- the same delivery id returns `duplicate: true`; a different delivery id for the same failure still
  produces only one email
- `past_due → active` queues a recovery email, not a second dunning email
- cancellation queues one `subscription_canceled` and downgrades the org

### 3.4 Email outbox — `src/lib/email/jobs.test.ts` (8)

- same idempotency key inserts once
- marketing suppressed for an unsubscribed address; transactional still allowed
- a due job sends once and is marked `sent`; a second drain does nothing
- a future-dated job is not sent early
- failure → backoff → retry → `dead` at `max_attempts`, error retained
- two concurrent drains send once (claim-then-send)
- backoff caps at 6 hours
- `recentEmailJobs` does not expose the HTML body

### 3.5 Cron drain — `src/lib/cron-email.test.ts` (4)

- unauthenticated call is 403 even when jobs are due
- wrong secret is 403
- Bearer secret drains and reports `{attempted, sent, retrying, dead}`
- `?secret=` works for schedulers that cannot set headers

### 3.6 Refunds and MRR — `src/lib/analytics/money-refunds.test.ts` (9)

- one store sale counted once, not twice
- `gross − refunds = net` holds
- tenant isolation
- refunds subtract in the monthly series
- a refund-heavy month never yields a negative bar scale
- new/expansion/contraction/churn split at list price
- a `past_due` status ping is not movement
- movement nets to zero when growth and loss cancel
- events outside the window are excluded

## 4. Acceptance criteria mapping

| Requirement | Test(s) | Status |
| --- | --- | --- |
| Successful payment activates the correct plan | `payments.test.ts`, `dodo-sync.test.ts` | Pass (simulated gateway) |
| Failed/pending payment does not activate | `dodo-sync.test.ts`, `subscriptions.test.ts` | Pass |
| Duplicate webhooks do not duplicate records or emails | `dunning-webhook.test.ts`, `webhook-delivery.test.ts` | Pass |
| Unauthorized users cannot read another user's billing | tenant-scoped queries + `subscriptions.test.ts`, `money-refunds.test.ts` | Pass |
| Renewal failure triggers recovery workflow | `dunning-webhook.test.ts`, `grace.test.ts` | Pass |
| Cancellation follows displayed terms | `subscriptions.test.ts`, `dunning-webhook.test.ts` | Pass |
| Refunds and state changes stay consistent | `money-refunds.test.ts`, `orders-transactional.test.ts` | Pass |
| Currency and amounts correct end to end | `payments.test.ts`, `money.test.ts` | Pass |
| Existing creator product sales still work | `orders-transactional.test.ts`, `store/orders.test.ts` | Pass |
| Test purchase appears once with correct currency | `money-refunds.test.ts` | Pass |
| Refund updates sales metrics | `money-refunds.test.ts` | Pass |
| MRR excludes one-time purchases | `money.test.ts`, `money-refunds.test.ts` | Pass |
| Queue retries do not duplicate messages | `email/jobs.test.ts` | Pass |
| Email provider failure does not break payment | webhook only enqueues; `dunning-webhook.test.ts` | Pass |
| Webhook forgery rejected | `dodo-webhook.test.ts`, `stripe-webhook.test.ts` | Pass |

## 5. Not executed (and why)

| Test | Why not run |
| --- | --- |
| Real Dodo/Cashfree/Stripe sandbox transaction | Would require a human to enter card data and would move real (test) money. Automated tests must not do this. |
| Playwright end-to-end journeys (`@playwright/test` is installed) | No E2E suite exists in the repo and no browser run was authorized in this pass. |
| `npm audit` | Not run; would report dependency vulnerabilities but does not change this work. Recommended before deploy. |
| Load/performance test | No SLA is claimed and no load harness exists. |
| Email deliverability (SPF/DKIM/DMARC) | Requires DNS access and a real send to a mailbox. |

## 6. How to reproduce

```bash
cd creatoros
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

Expected: tsc silent, lint 0 errors, 51 files / 505 tests passing, build success.
