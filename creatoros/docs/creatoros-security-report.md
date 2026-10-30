# CreatorOS — Security and Privacy Report

Date: 2026-10-30

This report lists code controls and observed events. It is not a compliance certification and must not
be quoted as one.

## 1. Controls verified in code

| Control | Implementation | Evidence |
| --- | --- | --- |
| No card data stored | Gateway-hosted checkout only; no PAN/CVV column exists | `src/lib/db/schema.sql` |
| Secrets server-only | No payment/email secret is exposed via `NEXT_PUBLIC_` | `src/lib/payments/*`, `.env.example` |
| Session cookie | `HttpOnly; SameSite=Lax; Secure` in production; revocation via `auth_version` | `src/lib/auth/session.ts:66` |
| Password storage | Password hashing module used by register/login/reset | `src/lib/auth/password.ts` |
| MFA | TOTP, only trusted after first successful code | `src/lib/auth/totp.ts`, `mfa-token.ts` |
| RBAC | Role checks on admin and settings actions | `src/lib/auth/rbac.ts` |
| Webhook authenticity | HMAC per gateway + ±5 min timestamp tolerance | `dodo-provider.ts`, `stripe-webhook.ts` |
| Webhook replay/duplicate | `webhook_events` claim with lease; duplicate returns no-op | `src/lib/payments/webhook-events.ts` |
| Billing endpoint abuse | 10 requests/min/IP on checkout | `src/lib/security/rate-limit.ts` |
| Tenant isolation | Every billing/analytics/order query filters `tenant_id`; tests assert it | `subscriptions.test.ts`, `money-refunds.test.ts` |
| Amount tampering | Price re-derived server-side from plan + currency | `src/app/api/billing/checkout/route.ts` |
| Open redirects | URL safety helper; tests | `src/lib/url-safety.ts` |
| Cron endpoints | `CRON_SECRET` bearer/query, else owner/admin session; never open | `src/lib/cron.ts` |
| Log minimisation | Webhook logs contain length/host/boolean only | `route.ts:58` |
| Unsubscribe enforcement | Marketing sends suppressed for unsubscribed addresses | `email/engine.ts`, `email/jobs.ts` |
| Data export/deletion | GDPR routines with tests | `src/lib/account/gdpr.ts` |
| Analytics retention | Prune job with a configurable window | `/api/cron/analytics-retention` |

## 2. Findings from production observation (29–30 Oct 2026)

| Observation | Assessment | Action |
| --- | --- | --- |
| `34.92.143.179` probing `/.git/config`, `/.env*` | Opportunistic scanner | All returned **404**. No source or env file is served. No action beyond normal monitoring. |
| `163.116.214.111`, `20.62.254.132` crawling | Crawlers, not exploitation | None |
| `14.195.184.162` (AWS Mumbai) made 1,208 requests / 24 h, including **837 authenticated `/app/*` 200s** | **Unresolved.** Either the owner's own automation or a session that should not exist | **Human confirmation required.** If this is not the owner's automation, rotate `AUTH_SECRET` immediately, which invalidates all sessions, and review `audit` rows for that period. |
| Caddy access log shows `Cookie` as `REDACTED` | Good | None |
| A third-party `AccessToken` header logged in plaintext (4 requests, IP `14.99.190.46`, not CreatorOS's) | Not our credential; likely a misdirected client | No exposure of our secrets. Keep the redaction rule for `AccessToken` as well. |
| ~97% of 24 h log volume was bots | Traffic truth must come from the first-party beacon, not logs | Already the rule (`docs/SEO-SETUP.md` §8) |

## 3. Residual risks

| Risk | Severity | Mitigation / next step |
| --- | --- | --- |
| In-memory rate limiter is per-process | Medium | Single instance today. If scaled, move the counter to the database or a shared store. |
| `AUTH_SECRET` rotation pending (see 837 authenticated hits) | **High until confirmed** | Confirm ownership; rotate if unexplained. Rotation logs everyone out. |
| No dependency vulnerability scan in this pass | Medium | Run `npm audit` before the next deploy; patch high/critical. |
| No CSP/Trusted Types verification in this pass | Medium | Review headers at the edge; not changed here. |
| Provider-side bounce/complaint data not ingested | Low | Add provider webhook ingestion before scaling marketing volume. |
| Analytics can be inflated by JS-executing bots | Low | Documented limitation; do not treat visit counts as audited |
| Email HTML has no plain-text alternative | Low | Add `text` part in `sendEmail` when templates get more complex |
| Dispute/chargeback state not modelled | Medium | Gateway dispute webhooks need mapping before volume grows |

## 4. What was deliberately not changed

- No Caddy configuration change for real client IP. `Cf-Connecting-Ip` is already logged and the
  parser was fixed instead, which carries zero production risk.
- No `AUTH_SECRET` rotation performed, because it logs every user out and the owner has not confirmed
  whether the authenticated traffic is theirs.
- No payment provider switch.
- No claim of PCI DSS, SOC 2, GDPR or tax compliance anywhere in the product or docs.

## 5. Manual actions required

1. Confirm whether `14.195.184.162` is the owner's automation; rotate `AUTH_SECRET` if not.
2. Rotate the Dodo live API key if it has ever been shared outside the server.
3. Reset the Meta App Secret if the Meta integration was ever configured with a shared value.
4. Add redaction for any custom auth header (`AccessToken`) in the edge log config.
5. Run `npm audit` and review.
