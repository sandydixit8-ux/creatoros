# CreatorOS — Acceptance Checklist

Date: 2026-10-30

Legend:
- **Verified** — implemented and exercised by an executed check (test, build, live observation).
- **Implemented** — code exists and compiles, but the end-to-end path needs an external account.
- **Partial** — some of the requirement exists; the rest is listed.
- **Missing** — not implemented.
- **Blocked** — needs a credential, dashboard action, or a human decision.
- **Approval** — a commercial/product decision that must not be made unilaterally.

---

## Gap 1 — International payments and subscription lifecycle

| # | Requirement | Status | Where / why |
| --- | --- | --- | --- |
| 1.1 | Identify existing provider(s) without silently switching | Verified | Dodo (MoR, USD/GBP), Cashfree (INR), Stripe (alt). No switch made. |
| 1.2 | Separate platform subscriptions from creator sales | Verified | `subscriptions` vs `orders`/`payments`; MoR excluded for creator sales |
| 1.3 | Server-side plan, price, currency validation | Verified | `checkout/route.ts`, `planPriceFor`, tests |
| 1.4 | Integer minor units, no float money | Verified | all money in cents; `money-format.ts` |
| 1.5 | Checkout success/failure/pending/cancel states | Verified | webhook mapping + billing page states |
| 1.6 | Persist subscription and renewals | Verified | `applySubscription`, `subscription_events` |
| 1.7 | Upgrade/downgrade and proration | Partial | Plan change applies; proration is delegated to the gateway (by design) |
| 1.8 | Cancel at period end / immediate | Partial | Provider-owned; local tracking records `canceled`; no local period-end scheduler |
| 1.9 | Reactivation | Partial | Re-checkout works; no one-click reactivation API |
| 1.10 | Refund handling updates entitlement | Verified | refund route + `markOrderFailed`; analytics tests |
| 1.11 | Invoice / receipt access | Partial | Provider-hosted receipts; no local invoice PDF |
| 1.12 | Billing history and dates | Verified | billing page + `subscriptionsFor` |
| 1.13 | Idempotent signed webhooks | Verified | HMAC + tolerance + claim/processed receipt; tests |
| 1.14 | Duplicate/delayed/out-of-order events | Verified | receipt + conditional transitions; tests |
| 1.15 | Reconcile local state with provider | Verified | Cashfree + Dodo reconciliation, provider-agnostic call |
| 1.16 | Explicit lifecycle state machine | Verified | documented in payments report |
| 1.17 | Failed renewal detection + notification | Verified | dunning webhook tests |
| 1.18 | Grace/suspension per published terms | Verified | `BILLING_GRACE_DAYS`; test |
| 1.19 | Restore access after recovery | Verified | recovery email + plan reapplied; test |
| 1.20 | Admin view of failures/recoveries | Partial | `webhook_events`, audit, subscriptions; no dedicated dunning dashboard |
| 1.21 | No card data stored; secrets server-only | Verified | schema + env review |
| 1.22 | Billing authz, rate limit, CSRF posture | Verified | session + RBAC + 10/min/IP; no cross-tenant reads in tests |
| 1.23 | Real test-mode card payment | Blocked | requires a human with card details in Dodo test mode |
| 1.24 | Tax/legal/PCI claims | Approval | none claimed anywhere |

## Gap 2 — USP and conversion

| # | Requirement | Status | Where / why |
| --- | --- | --- | --- |
| 2.1 | Outcome-focused positioning | Verified | homepage + segment landing pages exist |
| 2.2 | Audience clarity for the two initial segments | Verified | `/creator-booking`, `/sell-digital-products` |
| 2.3 | Clear primary CTA | Verified | "Start free" → `/signup` |
| 2.4 | Feature-to-benefit messaging | Verified | landing pages |
| 2.5 | Pricing page matches backend | Verified | single source `plans.ts`; test |
| 2.6 | Tax-inclusive, transparent recurring terms | Verified | pricing copy + Dodo config |
| 2.7 | Upgrade prompts near limits | Partial | limits shown on billing; contextual prompts not added |
| 2.8 | Annual billing | Missing | monthly-only model; experiment E4 requires billing support |
| 2.9 | No fake testimonials/scarcity/dark patterns | Verified | none present |
| 2.10 | Mobile and accessibility | Partial | responsive layout; no axe audit run |
| 2.11 | Conversion events without double counting | Verified | funnel + purchase events |
| 2.12 | A/B experiment framework | Missing | baseline first; experiments proposed (E1–E5) |
| 2.13 | Price changes | Approval | none made |

## Gap 3 — Revenue analytics

| # | Requirement | Status | Where / why |
| --- | --- | --- | --- |
| 3.1 | Documented event taxonomy | Verified | analytics report |
| 3.2 | Server-confirmed financial events only | Verified | order fulfilment + webhook; browser events never grant revenue |
| 3.3 | Deduplication / idempotent ingestion | Verified | order uniqueness + webhook receipt; tests |
| 3.4 | Audience metrics | Verified | visitors, page views, link clicks, sources, devices, countries |
| 3.5 | Conversion metrics | Verified | funnel + checkout steps |
| 3.6 | Gross sales | Verified | `gross`; test |
| 3.7 | Refunds | Verified | `refunds` from the ledger; test |
| 3.8 | Net sales with a stated definition | Verified | `net`; test asserts `gross − refunds = net` |
| 3.9 | Revenue by product/campaign | Partial | product label on order items; campaign attribution is last-touch only |
| 3.10 | AOV | Partial | derivable; not surfaced as a card |
| 3.11 | Repeat purchase rate | Missing | requires a cohort query/UI |
| 3.12 | MRR | Verified | `mrrByCurrency`; test |
| 3.13 | New/expansion/contraction/churned MRR | Verified | `subscription_events` + `mrrMovement`; tests |
| 3.14 | One-time sales excluded from MRR | Verified | tests |
| 3.15 | Email metrics | Partial | delivery/click stored for campaigns; bounce ingestion missing |
| 3.16 | Metric definitions with formulas/limits | Verified | analytics report |
| 3.17 | Attribution window + model stated | Verified | 90-day UTM cookie, last-touch; limitations documented |
| 3.18 | Tenant isolation in analytics | Verified | tests |
| 3.19 | Reconcile dashboard with source rows | Verified | `money-refunds.test.ts` |
| 3.20 | Empty/loading/error states | Partial | server-rendered empties; no skeleton/error boundary audit |
| 3.21 | Analytics failure never breaks checkout | Verified | analytics writes are non-fatal (`funnel.test.ts` "never throws") |

## Gap 4 — Email automation

| # | Requirement | Status | Where / why |
| --- | --- | --- | --- |
| 4.1 | Persistent job queue | Verified | `email_jobs`; tests |
| 4.2 | Retry with backoff | Verified | 60s·2^n capped 6h; test |
| 4.3 | Idempotency / duplicate suppression | Verified | unique key; concurrency test |
| 4.4 | Delivery state tracking | Verified | `status`, `attempts`, `last_error`, `sent_at` |
| 4.5 | Failed-job visibility | Verified | `dead` + `recentEmailJobs()` |
| 4.6 | Unsubscribe/suppression | Verified | marketing suppressed; transactional allowed; test |
| 4.7 | Not blocking payment webhooks | Verified | enqueue-only; test |
| 4.8 | Welcome/onboarding sequence | Missing | specified, needs product rules |
| 4.9 | Lead magnet delivery | Missing | needs per-lead asset contract |
| 4.10 | Abandoned checkout recovery | Missing | needs delay/consent/recovery-link decision |
| 4.11 | Booking notifications | Missing | needs offsets/timezone policy |
| 4.12 | Post-purchase receipt/delivery | Partial | access granted on fulfilment; receipt email not implemented |
| 4.13 | Subscription activation/renewal/failure/recovery/cancel | Partial | failure, recovery, cancellation shipped; activation/renewal notices not |
| 4.14 | Responsive templates, plain-text fallback | Partial | responsive HTML; no plain-text part |
| 4.15 | SPF/DKIM/DMARC | Blocked | DNS access |
| 4.16 | Bounce/complaint ingestion | Missing | provider webhooks not wired |
| 4.17 | Correct timezone/currency in mail | Partial | currency from the mandate; no localized dates |
| 4.18 | English US/UK copy | Verified | templates shipped in en |

## Cross-cutting

| # | Requirement | Status |
| --- | --- | --- |
| 5.1 | Backward-compatible migrations | Verified (ids 23, 24 additive, idempotent) |
| 5.2 | Existing data preserved | Verified (no destructive migration) |
| 5.3 | Existing tests still pass | Verified (505/505) |
| 5.4 | Typecheck | Verified |
| 5.5 | Lint | Verified (0 errors) |
| 5.6 | Production build | Verified |
| 5.7 | CI enforcement | Verified — root `.github/workflows/ci.yml` runs lint, typecheck, tests, build, Playwright E2E and `npm audit --omit=dev`. First run after the change: **success**, both jobs, audit `found 0 vulnerabilities` (run `41051797883`, 2026-10-30) |
| 5.8 | Dependency audit | Verified — production deps 0 vulnerabilities; 3 dev-only advisories in the vitest runner (needs a major upgrade, tracked separately) |
| 5.9 | Deployment | Blocked (not authorized in this pass) |
| 5.10 | Docs and runbooks | Verified (this doc set) |
| 5.11 | No fabricated results/claims | Verified — every number above came from an executed command |

## Open items requiring a human

1. ~~Confirm the `14.195.184.162` authenticated `/app` traffic.~~ Done 2026-10-30: traced to the owner's
   own account and egress; no `AUTH_SECRET` rotation. Optional hygiene: change the owner password.
2. Complete one Dodo test-mode purchase and verify plan + email.
3. Register the Dodo webhook and store `whsec_...` in production.
4. Set `CRON_SECRET` and install the every-minute mail drain.
5. Publish SPF/DKIM/DMARC.
6. Approve or reject experiments E1–E5.
7. ~~Decide whether to enable the missing lifecycle workflows.~~ Decided 2026-10-30: none for now;
   only payment-failed / recovered / cancellation transactional mail is live.
8. Add `trusted_proxies` (Cloudflare ranges) to the Caddy site block so `audit_logs.ip` records real
   clients instead of the CF edge (see security report §3).
9. Rotate Dodo live key; reset Meta App Secret if it was ever shared.

## Decisions recorded 2026-10-30

| Decision | Value | Where it lives |
| --- | --- | --- |
| Grace window after a failed renewal | **3 days** (`BILLING_GRACE_DAYS=3`, clamped 0–30) | `src/lib/billing/subscriptions.ts`, deploy guide §3 |
| Extra lifecycle email workflows | **None for now.** Only payment-failed, recovered and cancellation email is live. Welcome/abandoned/lead-magnet/booking stay proposals pending rules + consent basis | `docs/creatoros-email-report.md` |
| CI enforcement | **Extended.** The pipeline already ran lint, typecheck, tests, build and Playwright E2E; it now also fails on a vulnerable production dependency and runs when the workflow file itself changes. It still never deploys | `.github/workflows/ci.yml` |
| `14.195.184.162` authenticated traffic | **Owner's own tooling/egress.** No `AUTH_SECRET` rotation | `docs/creatoros-security-report.md` §2 |
