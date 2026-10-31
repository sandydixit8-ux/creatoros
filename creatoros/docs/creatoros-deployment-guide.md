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
| Server env additions | `CRON_SECRET` (64 hex chars, generated on the host) and `BILLING_GRACE_DAYS=3`, both appended to `/home/ubuntu/app/.env`; `deploy.sh` keeps the file across deploys |
| Service | `creatoros` active, `NRestarts=0`, no error-level log entries in the 5 minutes after deploy |

Not done here because it needs a dashboard or DNS: Dodo webhook registration, SPF/DKIM/DMARC, the
test-mode purchase. `PAYMENT_PROVIDER`, `DODO_*` and email credentials were already present in the
server `.env` and were preserved by `deploy.sh`.

### 10.1 Content deploy — 2026-10-30 (later the same day)

| Item | Value |
| --- | --- |
| Commit | `d91141b` |
| Archive | `creatoros-20261030b.tar.gz`, sha256 `cfc89181b86715aa951444d3d5a3360d0fd81a323c01a490ddb590a133736bdc` |
| Previous build | `xbb432yMnsmZcyhdOdhOl` |
| New build | `N4n_xXCNiQbv0VMmr7Se7` |
| Change | Adds the US blog post only; no migrations, no schema, no config |
| Rollback artifact | `/home/ubuntu/app-pre-20261030b.tar.gz` (8.2 MB) |
| Verification | `/blog/how-to-sell-digital-products-us` → 200, title and `datePublished 2026-10-30` present, all four internal links rendered as anchors, no literal markdown links, present in `/sitemap.xml` and `/blog`, service active with `NRestarts=0`, no error logs |

### 10.2 Brand mark deploy — 2026-10-30 (evening)

| Item | Value |
| --- | --- |
| Commit | `f13beed` (deployed build; this docs line follows in a small follow-up commit) |
| Archive | `creatoros-logo.tar.gz`, sha256 `3fc6b98c3d313ffac47468f19ef6d503452318da5e706fca217a03a9b78a64b5` |
| Previous build | `N4n_xXCNiQbv0VMmr7Se7` |
| New build | `Wi0fkp5eaT_U5Z8jASSdJ` |
| Change | Replaces the letter "C" tiles with one shared `BrandMark`; new app icons. No migrations, schema or env changes |
| Rollback artifact | `/home/ubuntu/app-pre-logo.tar.gz` (8.3 MB) |
| Assets | `src/assets/brand/logo-mark.webp` (128px, 5,738 B) bundled through the module graph; `src/app/icon.png` (512px, 88,923 B) and `src/app/apple-icon.png` (180px) served as metadata routes; deleted `src/app/icon.tsx` so the generated icon no longer wins over the file |
| Verification | `/icon.png` → 200 `image/png` 88,923 B; `/apple-icon.png` → 200; `/favicon.ico` → 308 to `/icon.png`; `/_next/static/media/logo-mark.2bue8mtykn2q2.webp` → 200 `image/webp` 5,738 B; mark present on `/`, `/pricing`, `/auth/login`, `/auth/register`; `manifest.webmanifest` icon `src` = `/icon.png`; JSON-LD Organization `logo` = `https://usecreatoros.co/icon.png`; health `{"ok":true,"db":"ok"}`; service active, `NRestarts=0`, no error-level entries |

Note: the artwork is full-bleed with no alpha channel, so the mark is clipped to a rounded square rather
than floated as a transparent glyph. `BrandMark` uses `unoptimized` because the asset is already 5.7 KB
and the standalone server must not depend on the image optimizer.

### 10.3 View-gate deploy — 2026-10-31

| Item | Value |
| --- | --- |
| Commit | `6925d57` |
| Archive | `creatoros-viewgate.tar.gz`, sha256 `acfbd1ec477ee887478e4796b81f7016151a29e50a10d9242358a45bb1456e23` |
| Local archive | 8,835,878 bytes; checksum re-checked on the host after `scp` and matched |
| Previous build | `Wi0fkp5eaT_U5Z8jASSdJ` |
| New build | `MEAkDVZIHJEGP6WvL5w46` |
| DB snapshot | `/home/ubuntu/data/creatoros.db.snapshot-2026-10-31T06-16-42` |
| Rollback artifact | `/home/ubuntu/app-pre-viewgate.tar.gz` (8.7 MB) |
| Change | Marketing page view counts only after 10 s on the page or the first scroll/pointerdown/keydown/touchstart (`createViewGate`). No migration, schema or env change |
| CI | Run `41175655026`: "Lint, typecheck, test, build" and "Playwright E2E" both green (509 unit tests) |
| Served bundle | `/_next/static/chunks/2woq5g0i6bmrs.js` contains `site-view`, `sendBeacon`, `1e4`, `scroll`, `pointerdown`, `keydown`, `touchstart` |
| Live browser check | Load-and-leave (3 s) → 0 beacons; scroll at 2 s → exactly 1, still 1 after 12.5 s; no interaction, 11 s dwell → exactly 1 |
| Write path | A normal-UA browser that scrolled produced exactly one `POST /api/site-view` → 200 and one `site_visits` row (`/`, IN, desktop) |
| Health | `{"ok":true,"db":"ok"}`; `creatoros` active, `NRestarts=0`, no error-level entries since the restart |
| Routes checked | `/` 200 (`CreatorOS — Create. Grow. Sell. Automate. All in One Place.`), `/pricing`, `/blog`, `/auth/register`, `/auth/login`, `/api/health` 200; `/icon.png` 200 `image/png` 88,923 B |

Headless Playwright sends `HeadlessChrome`, which the server still classifies as a bot, so the gate check
was run twice: once as-is (proves the client-side suppression) and once with a normal desktop UA
(proves the row is written).

**Effect observed after the deploy.** The monitoring service came back at 06:22 UTC from `20.171.1.0`
(US) and loaded `/`, `/` again, `/pricing`, `/pricing` again and `/blog`, roughly 8–12 s apart. It
produced **one** beacon instead of five: the first `/` sat for 12 s, which crossed the 10 s threshold;
the later pages were left after 8 s and produced nothing. So this cycle went from about five counted
views to one. The gate reduces monitor inflation but does not eliminate a monitor that stays past the
dwell window; interaction (scroll/pointer/key/touch) remains the reliable signal. Raising the window is
a separate decision, not part of this deploy. A real visitor at 06:25 UTC (Android 15, IN) counted
normally after scrolling.

### 10.4 View-gate 30 s + campaign attribution — 2026-10-31

| Item | Value |
| --- | --- |
| Commits | `101a640` (30 s dwell + UTM), `2a86483` (schema-order fix) |
| Archive | `creatoros-utm2.tar.gz`, sha256 `9043816a59fd694feb35860a9ac48f2027861ad7e1c33f46eadb78e81dc98c4f` |
| Local archive | 8,834,686 bytes; checksum re-checked on the host after `scp` and matched |
| Previous build | `MEAkDVZIHJEGP6WvL5w46` |
| New build | `1oi5BnytILhaZFF-G5Nor` |
| DB snapshot | `/home/ubuntu/data/creatoros.db.snapshot-2026-10-31T07-01-13` |
| Rollback artifact | `/home/ubuntu/app-pre-utm2.tar.gz` (8.7 MB, built with `-C /home/ubuntu/app .`, so the archive root is the app root) |
| Change | Dwell window raised from 10 s to 30 s (interaction still counts instantly); migration 25 adds `site_visits.utm_source` and `utm_campaign` plus `idx_site_visits_utm`; the beacon sends the labels from the existing `creatoros_attr` cookie; `/api/site-view` validates and caps them; the admin traffic panel adds "Top sources" |
| CI | Run `41177995092` green for `101a640`; run `41178575351` green for `2a86483` |
| Migrations | `_migrations` now 1–25; both columns present; `idx_site_visits_utm` present |
| Data | 1,082 rows / 760 visitor-days before the live check, 0 tagged; no existing row was rewritten |
| Health | `{"ok":true,"db":"ok"}`; service active, `NRestarts=0`; `/`, `/pricing`, `/blog`, `/auth/register`, `/auth/login` → 200 |
| Live check | Tagged landing (`utm_source=verify_fixb&utm_campaign=live-check`) + one scroll → exactly 1 `POST /api/site-view` (200) and 1 row (`/`, IN, desktop, `utm_source=verify_fixb`, `utm_campaign=live-check`); 12 s dwell with no interaction → 0 requests and 0 rows; ~31 s dwell with no interaction → exactly 1 request and 1 row |
| Cleanup | The 2 verification rows were deleted; 0 tagged rows remain; totals returned to 1,083 rows / 761 visitor-days (one organic mobile visit arrived during the window) |

Headless Playwright still sends `HeadlessChrome`, which the server filters as a bot, so the live check used a
normal macOS Chrome UA. The beacon body is not exposed by Playwright's `request.postData()` for
`navigator.sendBeacon`, so the payload was proven from `site_visits` instead of from the request object.

**Monitor behaviour not yet observed under 30 s.** The last monitor cycle was at 06:23 UTC, before this
deploy; the Caddy log shows no request from `20.171.1.0` between 06:43 and 07:10. The next cycle will be
reported separately. Under the previous 10 s window one page in that cycle stayed 12 s and still counted.

**Incident: the first attempt returned 503 (06:51–06:52 UTC).** Archive `creatoros-utm.tar.gz`
(sha256 `7818e2abc397d13461bba71087d469b36a17d78224550052e0bf9b4013402906`, build
`qULuOsX_NCMk5qPezNrBn`) passed the deploy sanity check and restarted, but health returned
`{"ok":false,"db":"unavailable"}`. The journal showed `Error: no such column: utm_source` when `getDb()`
executed the schema. `schema.sql` runs before migrations, and its new
`CREATE INDEX ... ON site_visits(utm_source)` ran against a table where migration 25 had not added the
column yet, so the whole schema exec threw. No data changed: migrations stayed at 1–24 and the deploy
script had already taken a snapshot.

Rollback hit a second problem: `app-pre-utm.tar.gz` had been created with `-C /home/ubuntu app` instead
of `-C /home/ubuntu/app .`, so its entries were `app/...` and `deploy.sh` refused it with "server.js
missing at archive root". The app was restored manually with
`tar -xzf /home/ubuntu/app-pre-utm.tar.gz -C /home/ubuntu/app --strip-components=1`, the `.env` mode was
fixed, and a restart brought the previous build `MEAkDVZIHJEGP6WvL5w46` back with health 200. A correctly
rooted `/home/ubuntu/app-pre-utm-fixed.tar.gz` was created for future rollbacks.

Fix `2a86483` removes the index from `schema.sql`; migration 25 creates it after the columns exist, which
works on both fresh and existing databases. It also adds `src/lib/db/migrate.test.ts`: the test builds a
pre-25 `site_visits` table, runs the real `migrate()`, and asserts that the old row survives, both columns
exist and read as untagged, and migration 25 is recorded. That test fails against the previous
`schema.sql`. The corrected archive was deployed at 07:01 UTC.

Rule for future schema changes: nothing in `schema.sql` may reference a column that a migration adds,
because the file is executed first on every database.

**Ops fix found during verification.** `/home/ubuntu/app/.env` was `root:root 600` while the service runs
as `ubuntu`. systemd's `EnvironmentFile` reads the file as root, so the app still received every variable,
but each start logged `Failed to load env from .env ... EACCES`. `deploy.sh` now chowns the preserved file
to `ubuntu:ubuntu` before `chmod 600` (backup: `/home/ubuntu/deploy.sh.bak-20261031`), the current file is
chowned, and after a restart the journal has no env error. Health 200, `NRestarts=0`, and
`PAYMENT_PROVIDER`, `DODO_ENV`, `EMAIL_PROVIDER` and `BILLING_CURRENCY` are still present in the process
environment.

### 10.5 Etsy fee accuracy fix - 2026-10-31

| Item | Value |
| --- | --- |
| Commit | `13241e7` |
| Archive | `creatoros-etsyfee.tar.gz`, sha256 `9f7af8fed313d9b8404791fdb86702627ec1031a34e370d497fb80d66231762c` |
| Local archive | 9,397,658 bytes; checksum re-checked on the host after `scp` and matched |
| Previous build | `1oi5BnytILhaZFF-G5Nor` |
| New build | `M0ZowUEIdL2AL4R8dlZvz` |
| DB snapshot | `/home/ubuntu/data/creatoros.db.snapshot-2026-10-31T15-41-42` |
| Rollback artifact | `/home/ubuntu/app-pre-etsyfee.tar.gz` (8.7 MB, built with `-C /home/ubuntu/app .`) |
| Change | Adds the UK 0.48% Regulatory Operating Fee to the calculator (totals and VAT-on-fees base), corrects the UK own-store comparison from the US 2.9% + 30p to Stripe UK 1.5% + 20p, and syncs the £20/£5/monthly worked examples across the tool page, blog, outreach runbook, UK DM copy and YouTube metadata |
| Rates verified | UK 0.48% regulatory fee and "charged on item price plus shipping and gift wrap, subject to VAT where applicable" from Etsy Help, "What is a Regulatory Operating Fee?"; Stripe UK 1.5% + 20p for UK/EEA personal cards |
| CI | Run `41215530774` green; Lighthouse run `41215530805` green |
| Migrations | None; `_migrations` stays 1-25 |
| Health | `{"ok":true,"db":"ok"}`; service active, `NRestarts=0` |
| Live check | `/etsy-fee-calculator` 200: 0 matches for `£2.46` / `12.3%`, 6 for `£2.56`, 7 for `12.8%`, 7 for `0.48%`; `/blog/how-much-does-etsy-take-uk` 200: 0 matches for `£2.46` / `12.3%`, new `£2.56`, `£17.44`, `£11.34` and `0.48%` present |
| Same build | Local build ID matched the deployed build; no live traffic rows were written during verification |

The UK regulatory fee was the missing fourth charge: the calculator and articles had been quoting three
fees. Worked examples now read £2.56 / 12.8% on £20, £0.91 / 18.2% on £5, and about £102 in fees on 40
orders a month. The £5 test pins the fixed-fee effect, and `etsy-fees.test.ts` asserts the 0.48% rate, a
zero US regulatory fee and the blog's published numbers.


