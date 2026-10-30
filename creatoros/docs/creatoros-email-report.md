# CreatorOS — Email Automation Report

Date: 2026-10-30

## 1. Existing infrastructure reused

- Provider layer: `src/lib/email/mailer.ts` — `resend` | `mailgun` | `brevo` | `log`.
  In production an unset/misconfigured provider throws instead of silently discarding mail.
- Campaign engine: `src/lib/email/engine.ts` — consent filtering, unsubscribe suppression,
  per-recipient `email_sends` log, partial campaign status.
- Transactional mail already present: verify email, password reset, email change, analytics alerts.

No provider was added and no template system was replaced.

## 2. Architecture: one outbox, one drain

```
webhook / app code
      │  enqueueEmail({ idempotencyKey, ... })
      ▼
  email_jobs  ──(claim: status='sending')──►  sendEmail()
      ▲                                          │
      │  failure: backoff 60s·2^n (cap 6h)       │ success: status='sent'
      │  attempts >= max → status='dead'         ▼
      └────────────────────────────────────  sent_at
                       ▲
        GET/POST /api/cron/email  (CRON_SECRET)
```

Why this and not a workflow engine: the required properties are persistence, retry, idempotency,
observability and rate awareness. One indexed table plus a bounded drain gives all of them with no new
dependency and no second scheduler. A workflow engine would add operational surface without changing
the guarantees.

### Guarantees

| Property | Mechanism |
| --- | --- |
| No duplicate sends from a redelivered webhook | `idempotency_key` UNIQUE + `INSERT OR IGNORE` |
| No duplicate sends from overlapping cron runs | conditional `UPDATE ... WHERE status='queued'` claim before sending |
| No lost send on provider outage | row stays `queued` with a future `next_attempt_at` |
| Bounded retries | `attempts`, `max_attempts` (default 5), exponential backoff capped at 6 h |
| Terminal failures visible | `status='dead'` + `last_error`; `recentEmailJobs()` for support |
| Marketing respects opt-out | `kind='marketing'` checks `unsubscribes`; transactional deliberately does not |
| Payment webhooks never block on mail | the webhook only inserts a row |

## 3. Workflows

| Workflow | Trigger | Status |
| --- | --- | --- |
| F — payment failed | `customer.subscription.updated` with `past_due`/`on_hold` | **Shipped** |
| F — payment recovered | `past_due`/`on_hold` → `active` | **Shipped** |
| F — cancellation confirmation | `customer.subscription.deleted` | **Shipped** |
| A — welcome + onboarding | registration | Not shipped (see §6) |
| B — lead magnet delivery | form submit on a published page | Not shipped (requires creator-configured asset delivery) |
| C — abandoned checkout | checkout pending after a delay | Not shipped (policy + consent copy needed) |
| D — booking notifications | booking created/rescheduled/cancelled | Not shipped (timezone/offset policy needed) |
| E — purchase receipt + delivery | order fulfilled | Partially: order succeeds and access is granted; no receipt email yet |

## 4. Templates shipped

All are transactional, responsive, plain HTML, no tracking pixel, no remote images, and every one has
a single secure action: the signed-in billing page. They never put a session id, card detail or token
in the URL.

| Template | Subject | Idempotency key |
| --- | --- | --- |
| `subscription_payment_failed` | We could not renew your CreatorOS subscription | `payment_failed:<sub>:<YYYY-MM-DD of failed period>` |
| `subscription_payment_recovered` | Your CreatorOS payment went through | `payment_recovered:<sub>:<period>` |
| `subscription_canceled` | Your CreatorOS subscription is cancelled | `subscription_canceled:<sub>` |

Wording rules applied: the failure email says access continues "for now" and that paid features pause
if payment is not completed; it explicitly says it is a billing notice, not marketing. No legal claim,
no guarantee, no invented discount.

## 5. Operational runbook

| Task | Command / route |
| --- | --- |
| Drain due mail | `POST /api/cron/email` with `Authorization: Bearer $CRON_SECRET` |
| Inspect recent jobs | `recentEmailJobs()` (admin/support code path) — excludes HTML body |
| Retry a dead job | `UPDATE email_jobs SET status='queued', attempts=0, next_attempt_at=<now> WHERE id=?` |
| Pause lifecycle mail | stop the cron entry; rows accumulate as `queued`, nothing is sent |
| Change cadence | cron interval; every minute is intended |

A scheduler entry is required. In this deployment the cron routes are called by the host scheduler
(`/home/ubuntu/deploy.sh` installs the service); add:

```
* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://usecreatoros.co/api/cron/email >/dev/null
```

## 6. Why the remaining workflows were not shipped

Shipping them "to tick the box" would mean inventing product rules and sending real email on them:

- **Welcome/onboarding**: needs a decision on which goal maps to which message and what counts as
  activation for each segment.
- **Abandoned checkout**: needs a delay, a stop condition, a consent basis for a reminder that is
  marketing in the UK/EU sense, and a recovery link that is safe to put in email. The current checkout
  session URL is provider-hosted and single-use; re-issuing it needs a provider call.
- **Lead magnet**: needs the creator to attach a deliverable and a delivery mechanism; the repo has
  forms but no per-lead asset contract.
- **Booking reminders**: needs reminder offsets, timezone source, and a no-show policy.

Each is specified in the implementation plan with trigger, delay, stop condition and consent rule, so
it can be enabled deliberately rather than guessed.

## 7. Deliverability

| Requirement | State |
| --- | --- |
| Verified sender domain | Configured outside the repo; `EMAIL_FROM` / `EMAIL_FROM_NAME` env |
| SPF / DKIM / DMARC | **Blocked** — DNS access not available here |
| Bounce/complaint ingestion | Not implemented |
| Plain-text fallback | Not implemented (HTML only) |
| List-Unsubscribe header | Not implemented for transactional; campaigns use the existing unsubscribe URL |
| Suppression list | `unsubscribes`, enforced for marketing |

Transactional messages are not gated on marketing consent because they report money movement, but they
are still idempotent and minimal. Marketing sends must continue to pass through the campaign engine's
consent check; the outbox refuses `kind='marketing'` for an unsubscribed address as a second guard.

## 8. Classification

| Item | Status |
| --- | --- |
| Durable queue + retry + dead letter | Implemented + tested |
| Idempotent lifecycle emails | Implemented + tested |
| Cron drain + auth gate | Implemented + tested |
| Dunning / recovery / cancellation content | Implemented + tested (content not deliverability-tested) |
| Welcome / onboarding / recovery / lead magnet / reminders | Missing, specified for approval |
| Bounce/complaint ingestion, plain-text, DMARC | Missing / blocked |
