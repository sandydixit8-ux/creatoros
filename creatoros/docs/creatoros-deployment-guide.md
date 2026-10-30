# CreatorOS — Deployment Guide

Date: 2026-10-30

Deployment was **performed** on 2026-10-30 (see §10 for the record). This document remains the
procedure and the verification list for the next one.

---

## 1. What ships in this change

| Area | Files |
| --- | --- |
| Migrations | `src/lib/db/db.ts` (ids **23** `email_jobs`, **24** `subscription_events`), `src/lib/db/schema.sql` |
| Billing | `src/lib/billing/subscriptions.ts`, `src/lib/billing/notify.ts`, `src/lib/payments/dodo-provider.ts`, `src/app/app/billing/page.tsx` |
| Webhooks | `src/app/api/webhooks/stripe/route.ts` |
| Email | `src/lib/email/jobs.ts`, `src/app/api/cron/email/route.ts` |
| Analytics | `src/lib/analytics/money.ts`, `src/lib/admin/engine.ts`, `src/components/admin/revenue-panel.tsx`, `src/app/app/analytics/page.tsx` |
| Config | `.env.example` |

Migrations are additive and idempotent:

- **23** creates `email_jobs` + `idx_email_jobs_due`.
- **24** creates `subscription_events` + `idx_sub_events_tenant_time`.

Both use `CREATE TABLE IF NOT EXISTS`, so re-running is safe and existing rows are untouched.
`migrate()` runs on first `getDb()`, i.e. at application start.

## 2. Environment variables

Required for this feature set:

| Variable | Purpose | Notes |
| --- | --- | --- |
| `BILLING_GRACE_DAYS` | Days a failed renewal keeps access | Default **3**, clamped 0–30. `0` = immediate downgrade. |
| `CRON_SECRET` | Auth for scheduler jobs | Bearer header or `?secret=`. Unset falls back to owner/admin session. |
| `DODO_PAYMENTS_API_KEY` | Dodo API + reconciliation | Live key for production |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `whsec_...` signature secret | Without it every Dodo webhook is rejected |
| `DODO_ENV` | `test` or `live` | Must be `live` in production |
| `DODO_PRODUCT_STARTER/CREATOR/PRO/BUSINESS` | Dashboard product ids | Missing id fails checkout loudly |
| `PAYMENT_PROVIDER` | Preferred gateway | Currency routing still decides per currency |
| `BILLING_CURRENCY` | Default price currency | Currently `usd` |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Mail delivery | In production an unconfigured provider throws rather than dropping mail |

No credential is committed. `.env.example` contains placeholders only.

## 3. Scheduler

Add the mail drain alongside the existing jobs:

```
* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://usecreatoros.co/api/cron/email >/dev/null
```

The endpoint returns `{ attempted, sent, retrying, dead }`. If `dead` is non-zero, check
`email_jobs.last_error` before assuming the address is bad.

## 4. Webhooks

Single endpoint for every gateway:

```
POST https://usecreatoros.co/api/webhooks/stripe
```

- **Dodo**: dashboard → Developer → Webhooks → add endpoint. Subscribe to
  `payment.succeeded`, `payment.failed`, `subscription.active`, `subscription.renewed`,
  `subscription.past_due`, `subscription.on_hold`, `subscription.cancelled`, `subscription.expired`,
  `subscription.failed`. Copy `whsec_...` into `DODO_PAYMENTS_WEBHOOK_KEY`.
- **Stripe**: `checkout.session.completed`, `customer.subscription.created/updated/deleted`.
- **Cashfree**: the existing endpoint, unchanged.

If the Dodo webhook is missing, checkout still reconciles on return via the API, but dunning and
cancellation emails will not fire.

## 5. Email domain

1. Verify the sending domain at the provider.
2. Publish SPF, DKIM and DMARC records (DNS access required).
3. Set `EMAIL_FROM` to the verified address and `EMAIL_FROM_NAME=CreatorOS`.
4. Send one test to an owned mailbox and confirm headers pass.

## 6. Build and deploy (existing procedure)

```bash
cd creatoros
npm ci
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

Stage `.next/standalone`, `.next/static`, `src`, `data/emails`, tar, `scp`, then run
`sudo /home/ubuntu/deploy.sh <absolute tar path>` on the host.

Before deploying, take a database snapshot:

```sql
VACUUM INTO '/home/ubuntu/backups/creatoros-<date>.db';
```

Never run a destructive schema operation on production. These migrations only create tables and
indexes.

## 7. Post-deploy verification

| Check | Expected |
| --- | --- |
| `GET /api/health` | `{"ok":true,"db":"ok"}` |
| Response header / build marker | New `BUILD_ID` |
| `SELECT name FROM sqlite_master WHERE name IN ('email_jobs','subscription_events')` | both present |
| `POST /api/cron/email` with the secret | `200` and `{attempted:0,...}` on an empty queue |
| Dodo dashboard test webhook | Delivery shows a non-4xx response |
| `/pricing` | Correct currency and tax-inclusive copy for the visitor's country |
| `/app/billing` | Current plan renders; no error if there is no subscription |
| `/app/analytics` | Revenue card renders "net of refunds"; no layout shift |
| Admin revenue panel | Gross / refunds / net / movement render (zeros allowed) |

## 8. Rollback

1. Code: redeploy the previous artifact. The new tables are ignored by old code.
2. Window: set `BILLING_GRACE_DAYS=0` to restore immediate downgrade without a deploy.
3. Mail: stop the cron entry; queued rows remain and can be drained later or deleted.
4. Data: migrations 23/24 are additive. To remove them you would have to drop the two tables, which
   also discards queued mail and MRR history. Do not do this casually; the older code does not need
   the tables gone.

## 9. Deployment checklist

- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` 0 errors (6 pre-existing warnings)
- [x] `npx vitest run` all passing (51 files / 505 tests)
- [x] `npm run build` succeeds
- [x] `npm audit --omit=dev` reports 0 vulnerabilities
- [x] DB snapshot taken
- [x] `BILLING_GRACE_DAYS` decided by the business: **3 days**, confirmed 2026-10-30
- [x] `CRON_SECRET` set and cron entry installed
- [ ] Dodo webhook registered and secret stored
- [ ] SPF/DKIM/DMARC verified
- [x] Health + build marker checked after deploy
- [ ] One test-mode purchase completed by a human
- [x] Rollback artifact identified

## 10. Deployment record — 2026-10-30

| Item | Value |
| --- | --- |
| Commit | `c83a4c7` (build from `creatoros/`) |
| Archive | `creatoros-20261030.tar.gz`, sha256 `5c071a40fd6d01ae6aae321f3a18a7819df9273067f60305f14d9a43b0ebcafa` |
| Previous build | `Ba3GHZfMo0nwfAM-a8P04` |
| New build | `xbb432yMnsmZcyhdOdhOl` |
| DB snapshot | `/home/ubuntu/data/creatoros.db.snapshot-2026-10-30T12-05-39` |
| Rollback artifact | `/home/ubuntu/app-pre-20261030.tar.gz` (9.3 MB) |
| Migrations | 23 and 24 applied; `_migrations` max = 24; `email_jobs` + `subscription_events` present |
| Data before/after | users 5, contacts 3, orders 0, payments 0 — unchanged |
| Routes checked | `/`, `/pricing`, `/auth/login`, `/auth/register`, `/llms.txt`, `/sitemap.xml`, `/api/health` → all 200 |
| Geo pricing | GB renders `£7 / mo` with “$9 in the US · ₹749 in India”; US renders `$9 / mo` with “£7 in the UK · ₹749 in India”; tax-inclusive copy present |
| Cron auth | `POST /api/cron/email` → 200 with the secret, 403 without |
| Scheduler | Installed under user `ubuntu`; first automatic run 12:08:01 UTC returned 200 |
| Service | `creatoros` active, `NRestarts=0`, no error-level log entries in the 5 minutes after deploy |

Not done here because it needs a dashboard or DNS: Dodo webhook registration, SPF/DKIM/DMARC, the
test-mode purchase. `PAYMENT_PROVIDER`, `DODO_*` and email credentials were already present in the
server `.env` and were preserved by `deploy.sh`.
