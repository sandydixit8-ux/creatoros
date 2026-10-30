# CreatorOS — Gap Audit (Phase 0)

Date of audit: 2026-10-30
Repo: `creatoros/` (Next.js 16.4.3 App Router, React 19, `node:sqlite`, zod 4, vitest 3, Playwright)
Scope: international payments & subscription lifecycle, USP/conversion, revenue analytics, email automation.
Target markets: United States and United Kingdom.

This audit was produced by reading the repository, not by assuming. Every finding below cites the file
that proves it. Each item is classified as one of:

- **Implemented + verified** — code exists and a test or a live check exercises it.
- **Implemented but defective** — code exists and behaviour is wrong.
- **Partially implemented** — some path exists, some does not.
- **Missing**.
- **Blocked** — needs a credential, dashboard action, or human decision.

---

## 1. Stack and entry points

| Concern | Reality | Evidence |
| --- | --- | --- |
| Framework | Next.js 16.4.3 App Router, React 19.2.8 | `package.json` |
| Database | `node:sqlite` `DatabaseSync`, WAL, foreign keys on | `src/lib/db/db.ts` |
| Schema/migrations | Idempotent `MIGRATIONS[]` list, ids 1–24 | `src/lib/db/db.ts`, `src/lib/db/schema.sql` |
| Auth | Custom session cookie (`HttpOnly; SameSite=Lax; Secure` in prod), TOTP MFA, RBAC, audit log | `src/lib/auth/session.ts:66` |
| Validation | zod 4 schemas on API routes | e.g. `src/app/api/auth/register/route.ts` |
| Tests | 51 files / 505 tests at audit end | `npx vitest run` |
| CI | **Missing** — no `.github/` workflow; tests are run manually | repo root |
| Deploy | Built artifact copied via `scp` + `/home/ubuntu/deploy.sh`; DB snapshot via `VACUUM INTO` | operational, not in repo |

## 2. Payments and subscription lifecycle

### 2.1 Provider topology — implemented

- Provider abstraction: `getPaymentProviderForCurrency()` in `src/lib/payments/index.ts`.
- Three gateways, deliberately not interchangeable:
  - **Dodo Payments** — Merchant of Record for platform subscriptions in USD/GBP/EUR (US/UK).
  - **Cashfree** — INR mandates (India).
  - **Stripe** — alternative card gateway outside India.
- The provider is chosen per currency, not by one global env var, so a GBP visitor is never routed
  to an INR-only gateway (`src/app/api/billing/checkout/route.ts:52-64`).

Live Dodo configuration verified on 2026-10-27: tax-inclusive pricing, pinned GBP localized prices,
secondary brand `CreatorOS` on all four products, 8/8 checkout matrix correct.

### 2.2 Money handling — implemented + verified

- Integer minor units everywhere; `planPriceFor()` re-derives the price on the server.
- Client-supplied plan/price/currency is never trusted (`src/app/api/billing/checkout/route.ts`).
- Per-currency money rendering without FX guessing (`src/lib/money-format.ts`).
- Subscription rows record the mandate currency (migration adding `subscriptions.currency`, `src/lib/db/db.ts:225`).

### 2.3 Webhooks — implemented + verified, one route for all gateways

- Single endpoint `/api/webhooks/stripe` (historical name) verifies whichever gateway signed the body
  (`src/app/api/webhooks/stripe/route.ts:65-99`).
- Dodo uses Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, base64 `whsec_` key,
  5-minute tolerance (`src/lib/payments/dodo-provider.ts`, `TOLERANCE_SECONDS = 300`).
- Idempotency: claim → work → processed/failed receipt with a 5-minute lease;
  a failure returns **502** so the gateway retries (`src/lib/payments/webhook-events.ts`).
- Duplicate delivery is a no-op (`dunning-webhook.test.ts` asserts `duplicate: true`).

### 2.4 Subscription state machine — was defective, now fixed

| Finding | Severity | Status |
| --- | --- | --- |
| Only `active`/`trialing` granted access, so a `past_due` renewal **instantly** downgraded a paying customer to `free`. This contradicted the promise in `dodo-provider.ts` ("past_due keeps access while the grace period runs"). | High (churn) | **Fixed** — `GRACE_STATUSES`, `graceDays()`, `isEntitled()` in `src/lib/billing/subscriptions.ts`; default 3 days, `BILLING_GRACE_DAYS` |
| A redelivered `past_due` event extended the grace window every time (anchor was "now"). | Medium | **Fixed** — grace is anchored to `current_period_end`, falling back to `updated_at` only when no period exists |
| A Dodo pending subscription stored the **checkout session id** as `provider_id`. If the webhook was missing, the row stayed `pending` forever and a paying customer never got the plan. | High (revenue) | **Fixed** — `fetchDodoCheckoutSubscription()` + `syncPendingDodoSubscription()` resolve session → real `sub_...`, rebind the row, and close the placeholder if the webhook won the race |
| The billing page only reconciled Cashfree, so Dodo relied entirely on its webhook. | High | **Fixed** — `syncPendingSubscription()` reconciles both providers |
| No dunning email on failed renewal. | High (churn) | **Fixed** — `notifyPaymentFailed` / `notifyPaymentRecovered` / `notifySubscriptionCanceled`, queued from the webhook |
| `customer.subscription.deleted` never confirmed cancellation to the customer. | Medium | **Fixed** — idempotent cancellation email |
| Refund handling sets `orders.status='refunded'` / `payments.status='refunded'`, so refunds vanished from the report and "revenue" silently shrank. | Medium (reporting) | **Fixed** — `gross` / `refunds` / `net` in `revenueSnapshot` |
| A store sale writes **both** an order and its payment row, but the report summed both tables → every store sale counted twice. | High (reporting) | **Fixed** — order-linked payments are excluded; order rows are authoritative |
| No subscription history, therefore no new/expansion/contraction/churned MRR. | Medium | **Fixed** — `subscription_events` table (migration 24) + `mrrMovement()` |
| Upgrade/downgrade proration is delegated to the gateway. There is no local proration engine. | Expected | Documented, not a defect: the provider owns proration |
| Invoice/receipt access relies on provider-hosted receipts; no local invoice PDF. | Partially implemented | `docs/PAYMENTS-DODO.md` |
| Dispute/chargeback ingestion from gateways is not mapped to a local state. | Missing | Documented in payments report |

### 2.5 Money that must never be shared — implemented

- Creator sales (orders/products/courses/bookings) and platform subscription billing are separate
  tables (`orders`/`payments` vs `subscriptions`) and separate funnel events.
- Merchant-of-record gateways are excluded for a creator's own sales; creators cannot route their own
  revenue through a MoR that would take title to it.

## 3. USP, positioning and conversion

### 3.1 Current state — implemented

- Dedicated landing pages per segment: `/sell-digital-products`, `/creator-booking`,
  `/podcast-monetization`, `/kajabi-alternative`, `/linktree-alternative`, `/all-in-one-creator-platform`.
- Homepage has an outcome-led H1 and a workflow section; pricing is server-rendered with geo-aware
  currency and tax-inclusive copy (`src/app/pricing/page.tsx`, `src/app/page.tsx`).
- Plan limits and entitlements live in one place (`src/lib/plans.ts`) and are shown to the user from
  that same source, so the pricing page and backend cannot drift.
- Geo pricing is server-side via `cf-ipcountry` → `x-cr-country`, `no-store`, private
  (commits `33c8b4b`, `47da952`).

### 3.2 Gaps found

| Finding | Status |
| --- | --- |
| No verifiable social proof (no testimonials, no customer counts) — correctly absent rather than fabricated. | Blocked until real customers exist |
| Billing FAQ covers tax-inclusive pricing, cancellation and refunds; annual billing is not offered because the gateway/pricing model is monthly-only. | Implemented (monthly only, stated) |
| Conversion events exist (`signup`, `purchase`, funnel steps) but there is no controlled A/B framework. | Partially implemented — baseline first, experiments proposed not shipped |
| Onboarding: registration → verify email → workspace → publish page is implemented, but lifecycle nudges did not exist. | **Fixed** — see email report |
| Ad conversion IDs (`NEXT_PUBLIC_GOOGLE_ADS_ID`, labels, Meta pixel) are not set in production. | **Blocked** — credentials |

### 3.3 Pricing — unchanged by design

Prices verified from `src/lib/plans.ts` and not modified:

| Plan | USD | GBP | INR |
| --- | --- | --- | --- |
| Free | $0 | £0 | ₹0 |
| Starter | $9 | £7 | ₹749 |
| Creator | $19 | £15 | ₹1,599 |
| Pro | $49 | £39 | ₹3,499 |
| Business | $99 | £79 | ₹7,499 |

No price, plan, discount, countdown or scarcity was changed. Pricing experiments are proposed in the
implementation plan and require approval.

## 4. Revenue analytics

### 4.1 Existing — implemented

- First-party `analytics_events` with visitor/session id, UTM, device, country, engagement
  (`src/lib/analytics/engine.ts`).
- Platform funnel with explicit steps and `recordFunnelEvent` (`src/lib/funnel.ts`).
- UTM captured into a 90-day cookie and attached at signup.
- Traffic truth is the first-party `site_visits` beacon (requires JS). Caddy access logs are
  volume-only: Cloudflare hides the visitor IP, and the real country is in `Cf-Ipcountry`
  (documented in `docs/SEO-SETUP.md` §8).
- Server-confirmed financial events only: purchases are recorded from order fulfilment, not the browser.

### 4.2 Gaps found

| Finding | Status |
| --- | --- |
| Refunds invisible in totals; "revenue" was actually net-of-nothing. | **Fixed** — gross/refunds/net |
| Store sales double-counted across `orders` and `payments`. | **Fixed** |
| No MRR movement (new/expansion/contraction/churned). | **Fixed** — `subscription_events` + `mrrMovement()` |
| No explicit event-schema doc with metric definitions, windows and limitations. | **Fixed** — analytics report |
| Monthly series mixed refunds into nothing; negative months could produce a negative chart bar. | **Fixed** — refunds subtract, bar scale floored at 0 |
| Attribution is last-touch via UTM cookie; first-touch is not stored separately. | Documented limitation, not claimed as deterministic |
| Analytics retention job exists (`/api/cron/analytics-retention`). | Implemented |

## 5. Email automation

### 5.1 Existing — implemented

- Multi-provider mailer (`resend`/`mailgun`/`brevo`/`log`) that **fails loudly in production** when
  unconfigured (`src/lib/email/mailer.ts`).
- Campaign engine with consent filtering, unsubscribe suppression, per-recipient `email_sends` log and
  partial-campaign status (`src/lib/email/engine.ts`).
- Transactional emails present before this work: verify-email, password reset, email change, analytics
  alerts.

### 5.2 Gaps found

| Finding | Status |
| --- | --- |
| No durable queue: a provider outage lost the send, and a payment webhook would have blocked on SMTP/API latency. | **Fixed** — `email_jobs` outbox (migration 23) |
| No retry/backoff or dead-letter state. | **Fixed** — exponential backoff to 6 h, `dead` after `max_attempts` |
| No idempotency: a redelivered webhook could send twice. | **Fixed** — `idempotency_key` UNIQUE |
| No subscription lifecycle email (payment failure, recovery, cancellation). | **Fixed** |
| No welcome/onboarding sequence, abandoned-checkout recovery, lead-magnet delivery or booking reminders. | **Missing** (proposed in the implementation plan; see email report for why each was not shipped blind) |
| No plain-text fallback in outbound mail. | Missing |
| Bounce/complaint webhook ingestion not implemented; only the send result is logged. | Missing |
| SPF/DKIM/DMARC configuration lives in DNS, not the repo. | **Blocked** — DNS access |

## 6. Security and privacy

| Control | Status | Evidence |
| --- | --- | --- |
| No card data stored; gateway-hosted checkout only | Implemented | no PAN/CVV fields in schema |
| Webhook signature verification + timestamp tolerance | Implemented + tested | `dodo-webhook.test.ts`, `stripe-webhook.test.ts` |
| Billing endpoint rate limit (10/min/IP) | Implemented | `src/lib/security/rate-limit.ts` |
| In-memory rate limiter is per-process | **Partially implemented** — single-instance only | documented risk |
| Session cookie flags | Implemented | `src/lib/auth/session.ts:66` |
| Cross-tenant isolation on billing/analytics queries | Implemented — every query filters `tenant_id` | money/billing tests |
| Secrets only server-side | Implemented — no `NEXT_PUBLIC_` key for any payment secret | `src/lib/payments/*` |
| Log redaction | Implemented — Caddy redacts `Cookie`; webhook logs are PII-free length/host only | `src/app/api/webhooks/stripe/route.ts:58` |
| Cron endpoints gated | Implemented — `CRON_SECRET` bearer/query, else owner/admin session | `src/lib/cron.ts` |
| Dependency audit | Executed — production dependencies clean (0 vulnerabilities); 3 dev-only advisories remain in the vitest runner | `npm audit --omit=dev`, `npm audit` |

Do not read this table as a compliance claim. It is a description of code controls only.

## 7. Environment and observability

- `.env.example` documented only Stripe webhook setup; Dodo webhook, cron drain and grace window were
  undocumented. **Fixed**.
- Health endpoint `GET /api/health` returns `{ok, db}`.
- No error tracker; failures are structured `console.error` lines plus `audit` rows and the
  `webhook_events` / `email_jobs` tables for support.

## 8. Priority ranking used for implementation

1. Never lose or wrongly remove paid access (grace, Dodo reconciliation, webhook retries).
2. Never lose a customer message (outbox, idempotency, dunning).
3. Report money honestly (gross/refunds/net, double-count fix, MRR movement).
4. Conversion and lifecycle messaging that can be measured (welcome, recovery, reminders).
5. Everything blocked on credentials, documented rather than faked.

## 9. Blocked items (cannot be completed from this environment)

| Item | Why blocked | Exact next step |
| --- | --- | --- |
| A real end-to-end card payment against Dodo | Needs a live/test checkout completed by a human with card data; automated tests must not move real money | Complete one £7 Starter purchase in Dodo test mode, confirm the subscription row and plan |
| Dodo live key rotation | Dashboard access | Developer → API keys → rotate |
| Google Search Console review | User's Google account only | Owner opens GSC |
| YouTube metadata fixes for 3 videos + 5 unlists | YouTube API token belongs to the personal channel; writes return 403 | Manual Studio edits listed in `marketing/publisher/youtube-metadata-fixes.md` |
| Ad conversion IDs | Missing credentials | Set `NEXT_PUBLIC_GOOGLE_ADS_ID` + labels, Meta pixel |
| CI workflow | No `.github/` directory and no authorization to add one | Add a workflow that runs `npm test`, `tsc`, `lint`, `build` |
| Bounce/DMARC monitoring | DNS + provider dashboard | Configure DNS records, enable provider webhooks |
