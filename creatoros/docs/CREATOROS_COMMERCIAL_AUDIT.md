# CREATOROS_COMMERCIAL AUDIT — Phase 0

**Date:** 4 October 2026
**Scope:** Production product at `https://usecreatoros.co`
**Method:** Static source review of the full `creatoros` repository. Every finding below is cited to `file:line`. Absence of a capability is stated as **NOT IMPLEMENTED** rather than assumed.
**Verification:** All Critical/High findings were re-read directly from source by the author before inclusion. Two claims from the initial automated pass were checked and found **wrong** (see §17).

---

## 0. Headline conclusion

The product is **materially more capable than a 5.5/10 assessment suggests**, and simultaneously carried **four data-protection and security defects that would be regulatory exposure in the UK/EU**. Those two facts are not in tension: a large feature surface was built quickly, and the consent, tenancy, metering and input-validation foundations under it were not.

**Evidence-based score: 5.1/10** (§16). This is *lower* than the 5.5 starting point, not because the product regressed, but because the deeper audit surfaced Critical trust defects that the initial assessment did not look for.

**Status update (4 October 2026):** all four Critical items in §14 are now **fixed and covered by regression tests** — see the remediation log in §14.1. Verified with `npm run typecheck`, `npm run lint`, 170/170 unit tests and 24/24 E2E tests. The score in §16 is deliberately **not** raised yet: it should only move once the fixes are deployed to production and re-verified there.

The next launch blockers are no longer the four Criticals. **D-5** is now fixed as well — see §14.2. The remaining launch blocker is the HIGH payment-lifecycle item **D-13** (dunning, grace and recovery); **D-10**, **D-11** and **D-12** are closed.

---

## 1. Current product architecture

Nine working product modules, all server-rendered against a single SQLite file:

| Module | Entry point | State |
|---|---|---|
| Link-in-bio pages | `/app/bio`, `/u/[username]`, `/u/[username]/[slug]` | LIVE — blocks, publish toggle, QR (`src/app/api/bio/*`) |
| Lead capture / CRM | `/app/leads` | LIVE — UTM capture, consent gate, CSV export |
| Bookings | `/app/booking` | LIVE — availability windows, slot computation, buffers (`src/lib/booking/slots.ts`) |
| Digital store | `/app/store` | LIVE — products, one-time checkout, refunds |
| Courses | `/app/courses`, `/app/learn` | LIVE — sections/lessons, free + paid enrolment, progress, certificates |
| Community | `/app/community` | LIVE — posts, comments, reactions |
| Email | `/app/email` | LIVE — lists, templates, campaigns, unsubscribe, suppression |
| Analytics | `/app/analytics` | LIVE — first-party traffic, leads, bookings, revenue, MRR |
| AI growth coach | `/app/coach` | LIVE — LLM-backed, quota-metered |
| Platform admin | `/app/admin` | LIVE — orgs, plans, feature flags, tickets, cross-tenant refunds |

**Correction to prior assessment:** the AI coach, email automation and plan-limit enforcement all **exist and work**. An earlier review wrongly claimed AI credits were unimplemented. They are enforced at `src/app/api/coach/analyze/route.ts:79-83` (though see defect D-7).

**Weakness:** there is no onboarding layer. Registration lands directly on the dashboard (`src/app/api/auth/register/route.ts` → `/app`). No role or goal capture, no progressive profile setup, no activation milestone.

---

## 2. Current technical architecture

- **Framework:** Next.js `^16.3.4`, App Router, React 19, TypeScript, Tailwind, Zod. `output: "standalone"`, `reactStrictMode: true` (`package.json`, `next.config.ts`).
- **Rendering:** 104 routes, **all `force-dynamic`**. No static generation, no ISR, no streaming. Every request is a synchronous DB read.
- **Request pipeline:** `src/proxy.ts` sets security headers + CSP and performs CSRF rejection. It performs **no authentication**. Page protection is the single chokepoint `getSession()` in `src/app/app/layout.tsx:8-9`; **every API handler must self-guard**. All 104 handlers were reviewed — the 16 without a session check are legitimately public.
- **Data access:** thin synchronous helper over `node:sqlite` (`src/lib/db/db.ts:107-132`). No ORM, no repository layer. Routes issue SQL directly.
- **Multi-tenancy:** `organizations.id` is the tenant key. Isolation is **manual `tenant_id` predicates** — there is **no row-level security**. Scoping was verified sound on all sampled dynamic routes. **No cross-tenant leak was found.**
- **Auth:** cookie + password. scrypt with per-user salt and `timingSafeEqual` (`src/lib/auth/password.ts:5-17`) — sound. Stateless HMAC-SHA256 session token (`src/lib/auth/session.ts`).
- **RBAC:** viewer / editor / admin / owner (`src/lib/auth/rbac.ts:1-40`).

**Strong:** parameterised SQL throughout (no injection found), complete security header set, sound IDOR scoping, correct opt-in lead capture, real in-app support queue.

**Weak:** no transactions in business logic (defect D-3), no error boundaries, no loading states, no pagination anywhere, no CI.

---

## 3. Current payment architecture

| Capability | Status | Evidence |
|---|---|---|
| Provider abstraction | LIVE | `src/lib/payments/types.ts:67-102` |
| Currency-based routing | LIVE | `src/lib/payments/index.ts:47-55` |
| Stripe (USD) | Implemented, **untested webhooks** | `src/lib/payments/stripe-provider.ts` |
| Cashfree (INR) | LIVE, verified end-to-end | `src/lib/payments/cashfree-provider.ts` |
| Mock provider (non-prod) | LIVE | `src/lib/payments/mock.ts` |
| Provider recorded on order | LIVE | `src/lib/store/orders.ts:166-177` |
| Cashfree HMAC-SHA256 + `timingSafeEqual` | LIVE | `src/lib/payments/cashfree-provider.ts:266-277` |
| Stripe signature verification | LIVE, **no unit tests** | `src/lib/payments/stripe-provider.ts:91-101` |
| Event-ID idempotency ledger | LIVE | `src/app/api/webhooks/stripe/route.ts:42-56`, PK `schema.sql:421-427` |
| Idempotent fulfilment (conditional UPDATE) | LIVE | `src/lib/store/orders.ts:191-192` |
| Refunds (full/partial, provider-aware, audited) | LIVE | `src/app/api/admin/orders/[id]/refund/route.ts` |
| Entitlements revoked on refund | **NOT IMPLEMENTED** | refund route updates order only |
| Multi-currency | USD + INR only | `STRIPE_CURRENCIES` / `CASHFREE_CURRENCIES` |
| FX conversion | **NOT IMPLEMENTED** | hardcoded `RATE = 84`, display only (`src/lib/money-format.ts:3`) |
| Tax / VAT / GST / invoicing | **NOT IMPLEMENTED** | no logic anywhere |
| Webhook replay-window validation | **NOT IMPLEMENTED** | timestamp used for HMAC only, never for freshness |

All money is stored as integer minor units — correct. The provider abstraction is clean and genuinely extensible.

---

## 4. Current billing architecture

**Live:** monthly subscription checkout, cancel-at-period-end, per-org subscription records, provider webhooks that apply plan changes.

| Capability | Status | Evidence |
|---|---|---|
| Monthly subscriptions | LIVE | `src/app/api/billing/checkout/route.ts:65-78` |
| Cancel | LIVE | `src/app/api/billing/cancel/route.ts:19-24` |
| States modelled | `active`, `trialing`, `past_due`, `canceled` | `schema.sql:64`, `src/lib/billing/subscriptions.ts:17` |
| `grace` / `paused` / `expired` states | **NOT IMPLEMENTED** | — |
| Upgrade / downgrade | **STUB** — provider helper exists, no route or UI | `cashfree-subscriptions.ts:259-261` |
| Pause / resume | **STUB** — helper only | `cashfree-subscriptions.ts:246-257` |
| Proration | **NOT IMPLEMENTED** | — |
| Dunning / retry / grace period | **NOT IMPLEMENTED** | failed renewal only flips to `past_due` (`cashfree-provider.ts:396-399`) |
| Billing portal (self-serve card/invoice update) | **NOT IMPLEMENTED** | — |
| Annual plans | **NOT IMPLEMENTED** | — |
| Double-subscribe protection | PARTIAL — upsert heuristic | `src/lib/billing/subscriptions.ts:45-47` |

**Commercially significant:** a customer whose renewal fails falls to `past_due`, which grants no plan (`subscriptions.ts:85-92`), and there is no retry, no grace period, and no recovery email. Revenue is lost silently and the creator loses access with no warning path.

---

## 5. Current pricing

Free / Starter $9 / Creator $19 / Pro $49 / Business $99.

Pricing **structure** is sound and matches the Framekit crossover logic ($39 ÷ 5% ≈ $780/mo). `src/lib/plans.ts` defines the entitlement matrix.

**Enforcement audit — this is where it fails:**

| Limit | Enforced? | Evidence |
|---|---|---|
| `bioPages` | Yes | `src/app/api/bio/route.ts:36-37` |
| `links` | Yes (both paths) | `src/app/api/bio/[pageId]/route.ts:109-110`, `blocks/route.ts:51-52` |
| `contacts` | **Bypassable** | checked in 3 routes, but bookings and free enrolment create contacts without `bumpUsage` |
| `services` | Yes | `src/app/api/booking/services/route.ts:52-53` |
| `products` | Yes | `src/app/api/store/products/route.ts:48-51` |
| `courses` | Yes | `src/app/api/courses/route.ts:46` |
| `viewsPerMonth` | **Enforced but displayed wrong** | writes `"views"` (`src/app/api/track/route.ts:41,45`), UI reads `usage.viewsPerMonth` (`src/app/app/billing/page.tsx:46`) → user always sees 0 |
| `aiCredits` | **Broken** — checked *after* the paid LLM call | `src/app/api/coach/analyze/route.ts:74-83` |
| `emailsPerMonth` | Yes, per-recipient | `src/lib/email/engine.ts:63-65` |
| `customDomain` | No feature exists | column `schema.sql:104`, never read |
| `emailAutomation` | Gates broadcast send | `src/lib/email/engine.ts:73-74` |

Additional structural problems: quota counters are **append-only with no decrement path** (`src/lib/usage.ts` is the only writer), so deleting a page permanently burns quota; `bumpUsage` is a non-atomic read-modify-write (`src/lib/usage.ts:6-31`) so concurrent increments are lost; periods are UTC months, so resets land at 05:30 IST for the India audience.

---

## 6. Current acquisition channels

**Everything that exists:** the landing page (`src/app/page.tsx`), the pricing page, and whatever direct/word-of-mouth traffic arrives.

**Everything that does not exist:** blog, comparison pages, free tools/calculators, use-case landing pages, `llms.txt`, social links in marketing UI, directory listings, "Powered by CreatorOS" badge, embeddable widget, media kit, public creator directory.

**Sitemap contains 4 URLs** (`src/app/sitemap.ts:4-12`): `/`, `/pricing`, `/auth/login`, `/auth/register`.

**Referral program: NOT IMPLEMENTED. Affiliate program: NOT IMPLEMENTED. Partner program: NOT IMPLEMENTED.** No tables, no routes, no tracking.

This confirms the GTM assessment: CreatorOS is almost entirely dependent on creators bringing their own traffic. That is precisely the dynamic that decelerated Stan's growth, and it is the single largest commercial weakness.

---

## 7. Current GTM gaps

Ranked by business impact:

1. **Zero viral loops.** No referral, affiliate or partner mechanics exist in any form. Every new user is acquired manually.
2. **No content or SEO surface.** 4 sitemap URLs cannot rank for "creator CRM", "media kit generator", "link in bio" or any other high-intent query. Competitors own these.
3. **No free tools.** The highest-leverage creator acquisition asset (calculators/generators) is entirely absent.
4. **No marketplace or discovery.** Creators cannot find each other; buyers cannot find creators. Whop grew 255% YoY on exactly this.
5. **No product-led loop.** Public creator pages exist and work, but nothing on them recruits other creators.
6. **The funnel is unmeasurable.** Only `page_view`, `lead`, `booking`, `link_click` are tracked (`schema.sql:208`). Signup, activation, checkout, paid and renewal are **NOT TRACKED**. You cannot compute conversion at any stage, so you cannot optimise it.
7. **No onboarding.** No role/goal capture, no dynamic dashboard, no activation milestone. Public pages are auto-published on signup, so "activation" is never a deliberate event.

---

## 8. Current legal / trust gaps

**All five legal documents exist as DRAFT and are correctly `noindex`** (`src/components/legal/legal-page.tsx:13`) with a visible "pending legal review" banner (`:23-29`). That part is handled properly.

**Unresolved placeholders — all launch blockers:**

| Field | Value | Line |
|---|---|---|
| `entityName` | `[Registered legal entity name]` | `src/components/legal/legal-info.ts:2` |
| `companyNumber` | `[Company registration number]` | `src/components/legal/legal-info.ts:3` |
| `address` | `[Registered business address]` | `src/components/legal/legal-info.ts:4` |

Users cannot identify their contracting party. The footer names a technology partner but never the contracting entity (`src/components/layout/site-footer.tsx:22-23`).

**Missing entirely:** cookie consent mechanism, marketing preference centre, public subprocessor list, trust/security page, standalone Acceptable Use Policy, AI terms, DPA.

**The cookie policy contradicts the code.** `src/app/(legal)/cookie-policy/page.tsx:60-63` promises consent is obtained before non-essential cookies and can be withdrawn. In reality tracking fires unconditionally on every public page mount (`src/components/bio/public-view.tsx:13-27` → `POST /api/track`), the endpoint accepts no consent parameter (`src/app/api/track/route.ts:11-19`), and there is no banner, opt-out or preference store. Lead capture gets this right (`src/app/api/leads/capture/route.ts:33`); analytics does not.

**Credit where due:** the site makes **no** unsubstantiated compliance claims. No SOC 2, no "GDPR certified", no "bank-grade", no encryption-at-rest assertions. That is a genuine strength and must be preserved.

---

## 9. Current retention gaps

| Mechanism | Status |
|---|---|
| Automated lifecycle / welcome emails | **NOT IMPLEMENTED** — engine exists, no triggers or sequences |
| Streaks / milestones | **NOT IMPLEMENTED** |
| Weekly digest | **NOT IMPLEMENTED** |
| Cancellation feedback ("why are you leaving") | **NOT IMPLEMENTED** — cancel is one click |
| Downgrade / pause offers on cancel | **NOT IMPLEMENTED** |
| Cohort / retention curves | **NOT IMPLEMENTED** |
| Churn-risk detection | **NOT IMPLEMENTED** |
| In-app notifications | LIVE |

The email engine can send campaigns; nothing sends them automatically at a moment that matters. Retention is entirely dependent on the creator remembering to log in.

---

## 10. Current analytics

**Measurable today:** page views (time, source, device, country, page), leads, bookings, traffic sources, MRR, active subscriptions, last charge, 6-month revenue series.

**Not measurable:** signup, activation, checkout started, payment attempted, purchase, upgrade, cancel, renewal, ARR, ARPU, churn, LTV, cohort retention, CAC, payback.

**Integrity defects:**
- View counts are **approximately 2× inflated** — the server-side tracker inserts a `page_view` with a fresh random visitor on every render (`src/lib/bio/track.ts:9-21`, called at `src/app/u/[username]/page.tsx:41`) *and* the client posts another (`src/components/bio/public-view.tsx:17-27`). Every server render is also counted as a unique visitor.
- Server-side views do not call `bumpUsage`, so they bypass the view quota entirely.
- Hardcoded `× 84` INR conversion in the dashboard (`src/app/app/analytics/page.tsx:128`).
- Email open/click columns exist but are never written, so engagement is permanently `{opened: 0, clicked: 0}` (`schema.sql:262-263`).

---

## 11. Current database

`node:sqlite` (`DatabaseSync`), local file, WAL + FK enforcement on (`src/lib/db/db.ts:10-14`). Path from `CREATOROS_DB_PATH`.

**41 tables, 15 indexes.** Schema executed from disk on first DB access, then 9 idempotent migrations (`src/lib/db/db.ts:20-76`).

**Structural problems:**
- **`schema.sql` is not the source of truth.** `payments.order_id`, `orders.refunded_cents`, `subscriptions.customer_id` and several `email_campaigns` columns exist only as `ALTER TABLE` migrations (`src/lib/db/db.ts:30-59`).
- **Header comment claims "PostgreSQL-portable" but no Postgres driver is declared.** Postgres support: NOT IMPLEMENTED.
- **Five tables carry `tenant_id` with no FK to `organizations`**, unlike every other tenant table: `order_items` (`schema.sql:413`), `course_sections` (`:452`), `lessons` (`:461`), `enrollments` (`:476`), `lesson_progress` (`:489`).
- `posts.author_id`, `post_comments.author_id`, `post_reactions.user_id` have **no FK to `users`** (`schema.sql:301,310,319`).
- **No index on `analytics_events(tenant_id, event_type)`** although every analytics query filters on it.
- **No `busy_timeout`, no statement cache, no pool** — every DB call re-prepares SQL.
- **No soft delete anywhere** — removal is hard `DELETE`. Undelete and audit recovery are impossible.

**Dead schema:** `templates` (never read; catalog is hardcoded in `src/lib/templates.ts:23-380`), `automation_workflows` (referenced only by the GDPR table list), `sessions` (only ever deleted — see D-6), `users.role`, `users.email_verified`, `organizations.trial_ends`, `bookings.reminder_sent`, `email_sends.opened_at/clicked_at`.

**Build defect:** `migrate()` reads `schema.sql` at runtime via `process.cwd()` (`src/lib/db/db.ts:21`) while `output: "standalone"` is set and there is **no `outputFileTracingIncludes`**. A copied standalone bundle throws ENOENT on first DB access.

---

## 12. Current integrations

| Integration | State | Fail behaviour |
|---|---|---|
| Stripe | Implemented | 503 if unconfigured in production |
| Cashfree | Implemented, INR | Sandbox by default |
| Resend / Mailgun / Brevo | Implemented | **Silently falls through to local file, campaign still marked `sent`** |
| OpenAI-compatible AI | Implemented, key-gated | Fails closed |
| Cloudflare RUM | Passive (CSP allow) | — |
| OAuth / social login | **NOT IMPLEMENTED** | — |
| Object storage / file uploads | **NOT IMPLEMENTED** | media are bare URL strings |
| SMS / WhatsApp / push | **NOT IMPLEMENTED** | — |
| External feature-flag service | **NOT IMPLEMENTED** | local global table |

**Two fail-open defects that must be fixed:**
1. **Email failures are reported as successes.** Non-OK responses from all three providers fall through to writing an HTML file (`src/lib/email/mailer.ts:73-77,91-95,112-116`), and the caller records `status='sent'` and increments quota (`src/lib/email/engine.ts:99-100`). A campaign can report `sent` with zero emails delivered. Not env-gated despite the comment at `mailer.ts:55`.
2. **The default mailer persists recipient PII to disk.** `EMAIL_PROVIDER` defaults to `log`, which writes every rendered email including the `to:` address under `data/emails/` (`src/lib/email/mailer.ts:119-128`). No retention or cleanup.

---

## 13. Current technical debt

| Item | Detail |
|---|---|
| No transactions in business logic | `tx()` exists (`src/lib/db/db.ts:134-145`) but is used **only** by GDPR delete. `fulfillOrder` performs 6 dependent writes unguarded. |
| No error boundaries | No `error.tsx` / `global-error.tsx` anywhere |
| No loading states | No `loading.tsx` / `Suspense` on data routes |
| No pagination | Full-table `SELECT *` on contacts, campaigns, lists, templates, services, analytics events, lead export |
| N+1 queries | `canSendMore()` runs 3 queries **per recipient** inside the send loop (`src/lib/email/engine.ts:63-65,84`); `getCourse` runs a lesson count per row (`src/app/api/courses/route.ts:29`) |
| Sequential email sends | No batching or bounded concurrency — a 10k list cannot complete, and a crash leaves `status='sending'` blocking retries forever (`src/app/api/email/campaigns/[id]/send/route.ts:17`) |
| GET with side effects | `/api/coach/analyze` is a GET that spends AI credits (`route.ts:13,82`) — prefetch-unsafe, no rate limit |
| AI output unvalidated | `JSON.parse(res.text) as unknown` returned straight to the client (`route.ts:77,85`) |
| Dead code | `parseBody`, `hasQuota` (duplicates `withinLimit`), `newJti`, `canaryDays` (identity fn), `trackLinkClick`, `SessionGuard`, `createCustomer` (3 implementations, never called) |
| Duplicated logic | two divergent money formatters (`src/lib/money.ts`, `src/lib/money-format.ts`); IP extraction reimplemented inline instead of `getClientIp` |
| Hardcoded values | demo credentials in `scripts/seed.ts:8-14` and `e2e/helpers.ts:4-5`; `RATE = 84`; `no-reply@creatoros.dev` |
| No CI | No `.github/workflows` — nothing runs on push |
| Test isolation | Vitest and Playwright share a real SQLite file; no per-worker isolation |

---

## 14. Risk register

Severity: **CRITICAL** = regulatory exposure or irreversible data loss · **HIGH** = revenue loss or security weakness · **MEDIUM** = operational/commercial drag.

### CRITICAL

| ID | Issue | Current State | Expected State | Business Impact | Technical Impact | Recommended Fix | Priority | Dependencies | Test Method |
|---|---|---|---|---|---|---|---|---|---|
| **D-1** | Purchase and free enrolment silently set marketing consent | **FIXED 2026-10-04** — see §14.1 | Consent set only by explicit opt-in, with timestamp and source | GDPR Art. 6(1)(a)/7, PECR Reg. 22, CCPA/CPRA exposure; complaint and enforcement risk | None — trivial to fix | Never write `consent` on a transactional path. Default `0`. Add `consent_at` + `consent_source` columns | P0 | Migration for the two columns | Test: buy a product → assert `contacts.consent = 0`; assert campaign excludes buyer |
| **D-2** | "Delete my account" destroys the entire organisation | **FIXED 2026-10-04** — see §14.1 | Removing a user must not delete co-workers' data; org deletion is a separate, owner-only, confirmed action | Irreversible loss of every contact, order, booking, course and email history for the whole workspace | Data loss cascades from one FK | Split into "leave organisation" (remove membership) vs "delete organisation" (owner-only + typed confirmation of org name) | P0 | RBAC role check | Test: `viewer` calls delete → 403; second member's data survives |
| **D-3** | Email send failures reported as successes | **FIXED 2026-10-04** — see §14.1 | Provider failure must fail loudly; campaign status must reflect reality | Silent list-wide deliverability failure; revenue loss; support burden | Quota consumed for unsent email | Env-gate the file fallback to non-production only; propagate provider errors | P0 | None | Test: mock provider 500 → assert `sendCampaign` does not mark `sent` |
| **D-4** | Stored XSS via `javascript:` URLs | **FIXED 2026-10-04** — see §14.1 | Only `http:`, `https:`, `mailto:`, `tel:` permitted in any user-supplied URL | Attacker JS executes in site origin on a victim's click, including on authenticated pages | Full XSS despite `HttpOnly` cookies | Allowlist schemes at validation; sanitise bio block URLs | P0 | Shared URL validator | Test: submit `javascript:alert(1)` → 400; render assert `href` never starts with `javascript:` |

### 14.1 Remediation log — D-1 to D-4 (2026-10-04)

All four CRITICAL defects are closed and covered by regression tests. Verified with
`npm run typecheck`, `npm run lint` (0 problems), `npm test` (170/170) and
`npm run test:e2e` (24/24).

**D-1 — consent provenance**

- `contacts.consent_at` (nullable timestamp) and `contacts.consent_source` added to
  `src/lib/db/schema.sql`.
- Migrations 10-12 in `src/lib/db/db.ts` add the columns and remediate legacy rows
  that carry `consent = 1` with `source IN ('store','course')` and no
  `consent_at`. A row is only treated as a genuine opt-in if it has provenance.
- Transactional paths write `consent = 0` and never touch provenance:
  `src/lib/store/orders.ts` (product purchase) and the course enrolment path.
- Explicit opt-in records `consent_at` + `consent_source` in
  `src/app/api/leads/capture/route.ts`.
- Free course enrolment now also consumes the contact quota, which it previously
  bypassed.
- Tests: `src/lib/contacts-consent.test.ts` (6) — covers purchase-created,
  course-created, repeat purchase, and preservation of a real opt-in.
- Known remainder: D-8 quota enforcement is only partially closed. Booking
  contact creation still needs the same quota bump.

**D-2 — account deletion vs workspace deletion**

- `deleteAccountData` is replaced by two distinct operations in
  `src/lib/account/gdpr.ts`:
  - `leaveOrganization(tenantId, userId)` removes only the caller's membership.
    The identity is erased only when no other workspace holds it (Art. 17), and
    it returns `nextOrgId` so the session can be re-pointed instead of logging
    the user out.
  - `deleteOrganization(tenantId, actorUserId)` deletes the workspace and its
    tenant data. It deliberately does **not** delete the user row, so a member's
    other workspaces and teammates survive.
- `POST /api/account/delete` is owner-only and requires the matching `orgSlug` as
  typed confirmation. `POST /api/account/leave` is the membership-only path.
- `src/components/settings/privacy-section.tsx` now offers both actions, shows
  the delete control only to owners, and sends `orgSlug`.
- Tests: `src/lib/account/gdpr.test.ts` (6) — including the regression that the
  old code destroyed the user's other workspaces.

**D-3 — email fail-closed**

- `src/lib/email/mailer.ts`: an unset or unrecognised `EMAIL_PROVIDER` now
  resolves to `null` instead of silently degrading to the file-log backend.
  `emailConfigured()` reports false, and `sendEmail` throws in production. A
  provider that rejects the message propagates the error rather than writing a
  file and reporting success.
- `src/lib/email/engine.ts`: campaign status distinguishes `sent`, `partial` and
  `failed`; the provider error is stored on the recipient send row.
- Partial campaigns are **not** resumable yet. `POST .../send` rejects them and
  the UI hides the send button, because re-running would send a second copy to
  recipients already delivered. Recipient-level retry is the correct fix and is
  not yet built.
- Schema comment for `email_campaigns.status` updated to list the new states.
- Tests: `src/lib/email/mailer.test.ts` (17, +6 for provider resolution and
  failure handling) and `src/lib/email/engine.test.ts` (8, +5 for partial/failed
  accounting).

**D-4 — stored XSS via URL schemes**

- New `src/lib/url-safety.ts`: `isSafeUrl` / `sanitizeUrl` / `isHttpUrl` enforce
  an `http: https: mailto: tel:` allowlist, plus `hasDangerousScheme` and
  `payloadHasDangerousScheme` for free-form JSON.
  - Control characters are rejected and stripped before the scheme check, so
    tab-obfuscated `java&#9;script:` cannot slip through.
  - Protocol-relative (`//host`) and backslash forms are rejected.
  - Scheme detection is anchored on an explicit dangerous-scheme list, so ordinary
    text containing a colon (e.g. a clock time) is not misclassified.
- Applied at the API boundary: `src/app/api/profile/route.ts` (website, avatar and
  all five socials) and both bio block write paths
  (`src/app/api/bio/[pageId]/route.ts`, `src/app/api/bio/[pageId]/blocks/route.ts`).
- Defence in depth at render: all four `href` sinks in
  `src/components/bio/public-view.tsx` go through `safeHref`, which also
  neutralises unsafe URLs already stored before this allowlist shipped.
- Tests: `src/lib/url-safety.test.ts` (10).

### 14.2 Remediation log - D-5 cookie consent (2026-10-04)

**D-5 — the Cookie Policy promised consent management that did not exist**

- New `src/lib/consent.ts`: explicit category model (`essential` always on,
  `analytics` default **off**), a versioned `creatoros_consent_v1` record, and a
  strict parser that ignores unknown shapes instead of trusting them.
- New `src/lib/use-consent.ts`: persists the decision, keeps two open tabs in sync
  via the `storage` event plus a same-tab custom event, and exposes
  accept / reject / granular-set / withdraw.
- New `src/components/consent/consent-banner.tsx`, mounted in `src/app/layout.tsx`:
  - **Reject is presented as a first-class action with equal prominence to
    Accept.** A prompt whose only reachable button grants consent is not a choice
    under PECR.
  - Optional granular toggle instead of an accept-only wall.
  - Rendered in normal document flow, **not** as a `position: fixed` overlay. The
    fixed bottom bar was built first and regressed three checkout/enrolment E2E
    tests by intercepting clicks on controls at the bottom of the viewport; in
    production that is a real "Buy now" button being unclickable. In-flow it
    cannot cover page content.
  - Client-only and gated on `ready`, so it never appears in SSR output and does
    not flash at visitors who have already decided.
- New `src/components/consent/consent-preferences.tsx`, embedded in
  `src/app/(legal)/cookie-policy/page.tsx`, so the policy's withdrawal promise is
  honoured on the same page that makes it, and is reachable **after** the first
  visit rather than only via a first-visit banner.
- Server gate: `src/app/api/track/route.ts` now requires
  `consent: { analytics: true }` in the body and returns
  `{ tracked: false, consent: false }` **without writing a row** otherwise. The
  consent field is absent by default, so the previous behaviour (tracking
  unconditionally) is no longer reachable by omitting it.
- `src/components/bio/public-view.tsx` suppresses its `page_view` / `link_click`
  requests entirely until analytics consent resolves to granted.
- Policy text in `cookie-policy/page.tsx` reconciled with actual behaviour:
  names the categories, states no third-party advertising cookies are used, and
  says where the choice is stored and how to withdraw it.
- Tests: `src/lib/consent.test.ts` (20) for the record model and parser;
  `src/lib/consent-gate.test.ts` (11) calls the route the way an attacker or
  `curl` would and asserts **no `analytics_events` row** is written without
  consent, that unconsented calls do not consume the views quota, and that
  malformed or smuggled-in consent is refused rather than coerced;
  `e2e/consent.spec.ts` (6) covers first-visit display, reject/accept, granular
  save, persistence, withdrawal from the policy page, and that **no tracking
  request is issued before consent**.
- Verified with `npm run typecheck`, `npm run lint` (0 problems), **201/201** unit
  tests, **30/30** E2E tests, and a production standalone build.

**Known limitation at first deploy, closed immediately afterwards:** the gate above is
default-deny and refuses malformed input, but the consent signal was still supplied by the
caller, so it was not a tamper-evident server-side receipt and there was no central record of
a decision ever having been made. That gap was closed in the same remediation - see §14.3.

### 14.3 Remediation log - signed consent receipt (2026-10-04)

**Closing the evidential gap left open by D-5**

- New `src/lib/consent-receipt.ts`: the decision is captured **server-side** at the
  moment it is expressed and carried in a signed `HttpOnly; SameSite=Lax`
  `creatoros_consent` cookie holding `{ analytics, decidedAt, source, version }`.
  Reuses the session module's HMAC `sign`/`verify` (constant-time comparison)
  rather than duplicating crypto.
  - `readConsentReceipt` returns `null` for a missing, malformed, wrongly
    versioned, undated or tampered cookie — callers must read that as "no
    consent".
  - `analyticsGranted` is the single question the tracking endpoint asks, and is
    strict on purpose.
- New `src/app/api/consent/route.ts`: the only way to obtain a receipt. Validates
  `{ analytics: boolean, source: banner|preferences|withdrawn }`, rate-limits,
  and mints the cookie. Withdrawal posts `analytics: false` rather than clearing
  the cookie, so a decision (including a refusal) is remembered and the banner
  does not reappear every visit. The cookie is strictly necessary to remember the
  choice, so setting it needs no consent of its own.
- `src/app/api/track/route.ts` now authorises **from the receipt only**. The
  `consent` field was removed from the request schema entirely, so nothing in the
  body can influence the decision — a hand-crafted `{ analytics: true }` is now
  ignored rather than honoured, and a withdrawn visitor cannot unlock tracking by
  editing their request. The consent check also moved ahead of body parsing and
  rate limiting, so an unconsented caller cannot make the server parse or
  fingerprint anything.
- `src/lib/use-consent.ts`: `save` is now async and calls `/api/consent` **first**.
  The server is the authority; localStorage is written afterwards as a UI mirror
  for instant paint and cross-tab sync. If the receipt is refused nothing is
  stored and the banner stays up — the conservative outcome, since no receipt
  means no tracking. A local-only save would have shown "allowed" in the UI while
  the server still refused to record.
- `src/components/bio/public-view.tsx`: stops sending a consent flag entirely;
  the cookie travels with the request.
- `src/components/consent/consent-preferences.tsx`: the analytics toggle is now
  optimistic. With an async save, a controlled checkbox driven straight off server
  state snapped back on click and looked broken on a slow connection, which is a
  real defect rather than a test artefact. If the save is refused the switch falls
  back to what the server actually believes instead of staying lit.
- Policy text updated: the consent receipt cookie is named, described as strictly
  necessary, and the page states plainly that it is what gets checked before
  anything is recorded.
- Tests: `src/lib/consent-receipt.test.ts` (13) treats the receipt as a security
  boundary — unsigned hand-rolled payloads, tampered signatures, a refusal receipt
  edited into a grant, unexpected sources, missing/unparseable timestamps and
  future schema versions are all refused. `src/lib/consent-gate.test.ts` (19)
  exercises both routes end to end: no cookie, an unrelated cookie, a refusal, a
  withdrawal and a body flag claiming consent all record nothing; a granted receipt
  records exactly one event; and replacing a grant with a withdrawal stops
  recording immediately. `e2e/consent.spec.ts` (7) drives the **real** consent flow
  and asserts the receipt cookie exists and is `HttpOnly`, that a body flag is
  gone, and that withdrawing stops tracking.
- Verified with `npm run typecheck`, `npm run lint` (0 problems), **222/222** unit
  tests, **31/31** E2E tests.

**Deployment integrity issue found while verifying this in production.** The first
D-5 deploy reported success but shipped nothing: `deploy.sh` hardcoded
`tar -xzf /home/ubuntu/app7.tar.gz` and silently ignored its argument, so it
re-extracted the previous build. This was caught only because the endpoint was
probed live over HTTPS after deploying rather than trusted on the deploy script's
"=== DONE ===". Fixed by taking the archive as `$1` (with the previous path as a
default), failing if it is absent, printing its `sha256sum`, and printing the
`BUILD_ID` so a stale build is visible in the deploy log. Verified live: five
probe requests (no consent / refusal / smuggled flag / malformed / genuine
consent) produced `tracked:false` for the first four and exactly one stored row
for the last, with the row count reconciling exactly against the baseline.

### 14.4 Remediation log - D-10 transactions around money writes (2026-10-04)

**D-10 — multi-write money paths with no transaction**

`tx()` already existed in `src/lib/db/db.ts` but was **never called anywhere in the codebase**; every
payment path wrote rows one at a time with no atomicity.

**`tx()` itself was not safe enough to use as-is:**
- It issued a plain `BEGIN`, which only takes the write lock at the first write. Two callers could
  both read, then both try to upgrade, and one would get `SQLITE_BUSY` — exactly the read-then-write
  pattern a money row needs to avoid. Now `BEGIN IMMEDIATE`, so the lock is taken up front and the
  loser waits and then sees committed state.
- It had no nesting guard, so an inner `tx()` would issue `BEGIN` inside `BEGIN` and SQLite would
  refuse. Inner calls now join the outer transaction, and the outermost call owns commit/rollback,
  so an inner failure still aborts everything a caller wrapping several helpers expects.

**`fulfillOrder` — the paid-but-unfulfilled dead end.** The order was flipped to `paid`, the payment
row updated, the enrolment created, usage bumped and an audit row written as five independent writes.
If the enrolment insert failed, the customer had paid, was marked fulfilled, and could not open the
course — and because the idempotency guard returns `already_paid` on every subsequent attempt, **no
retry could ever repair it**. Terminal and silent, discovered by the customer. All five writes now
run in one transaction: a failure anywhere rolls back, the order stays `pending`, and a later webhook
or return-visit retry can still fulfil it.

**Refund — intent recorded before the gateway call.** A refund moves money at the provider first and
updates the ledger second. If the process died in between, `refunded_cents` still read as un-refunded
while the customer had been made whole, and since the route only refuses amounts above
`amount_cents - refunded_cents`, the order looked refundable again — a second admin click would refund
them twice. The `already_paid`-style guard does not exist here at all.

- Migration 13 + `refunds` table: `pending | succeeded | failed` intents with the provider refund id,
  amount, reason and admin. The claim is written **before** the provider is called, so an in-flight
  or crashed refund is visible rather than lost.
- A **partial unique index** on `(order_id) WHERE status = 'pending'` enforces at most one in-flight
  refund per order in the database, so two concurrent admin requests cannot both compute the same
  "remaining" figure and race.
- The ledger is re-read inside the same transaction as the claim, so the amount is computed under the
  lock rather than from a stale earlier read.
- Three phases: claim (transaction) → gateway call (no lock held; holding a write lock across a
  provider network call would serialise all admin actions behind gateway latency) → commit
  (transaction). On provider failure the intent is released to `failed` so an admin can retry; if the
  commit phase fails after the money moved, the intent is deliberately left `pending`, because a
  stuck claim blocks retries and that is the safe direction to fail in.
- Also fixed: the refund path never updated the `payments` row, so an order could read `refunded`
  while its payment still read `succeeded`. A full refund now marks the payment refunded; a partial
  one correctly leaves both alone.
- Tests: `src/lib/orders-transactional.test.ts` (17) covers `tx()` commit/rollback/nesting/state
  cleanup, fulfilment atomicity — including a forced enrolment failure proving the order stays
  `pending` and a retry succeeds — and every refund-intent path including the commit-phase failure
  that leaves the ledger untouched with the claim still blocking.
- New `scripts/check-migrations.ts` to apply pending migrations to a **copy** of a database and report
  what changed, so a migration can be rehearsed before it touches production. Verified migration 13
  applies cleanly on a copy that was still at migration 7.
- Verified with `npm run typecheck`, `npm run lint` (0 problems, 0 warnings), **239/239** unit tests,
  **31/31** E2E tests.

### 14.5 Remediation log - consent gate bypass on the server render path (2026-10-04)

**Found during D-10 production verification, not by the tests.**

Deploying D-10 and then diffing `analytics_events` before and after my own verification
requests showed **three new rows that I had not consented to**. All three were
`event_type='page_view', device='server'`, timestamped exactly when I curled the public
bio pages. The D-5 remediation was incomplete.

**What D-5 had actually closed.** The consent gate was applied to `POST /api/track`, the
client beacon. But `src/app/u/[username]/page.tsx` and `.../[slug]/page.tsx` call
`trackPublicView(bio)` while rendering, and `src/lib/bio/track.ts` wrote straight to
`analytics_events` with a fresh visitor id and **no consent check at all**. So every render
of every public bio page recorded a view — before any script ran, independent of the banner,
and even after a withdrawal. A visitor who declined, or who withdrew and then kept browsing,
was still being measured. The Cookie Policy promises measurement happens only after
agreement, so the product did not match its own published wording.

`trackPublicView` is now gated on the same signed receipt via `analyticsGranted`, and is
`async` because `cookies()` is.

- One subtlety worth recording: `analyticsGranted` takes a **cookie header**, not a cookie
  value, because it re-parses the `name=value` form. Passing `jar.get(name).value` returns
  `null` and reads as "no consent". That silently denied every view on the first attempt —
  the kind of failure that looks like correct default-deny behaviour while actually never
  recording anything, which is why the tests assert the **affirmative** case too.
- `trackLinkClick` has no callers, so there is no second unguarded path in use; it is left
  alone rather than half-migrated.
- Tests: three new E2E cases in `e2e/consent.spec.ts` assert the row count for
  `device='server'` page views does **not** move without consent, moves by exactly one with
  consent, and stops moving after withdrawal. They read the E2E database directly, because
  these writes never appear in a network trace — which is exactly why the original gap
  survived a suite that otherwise covered consent thoroughly.

**Also fixed: a flaky security test that could have hidden a real break.**
`consent-receipt.test.ts` proved signature tampering was refused by rewriting the **last**
character of the base64url signature. In base64url that character can encode padding bits
alone, so on some random signatures the rewrite decoded to identical bytes and the
tampered token verified successfully — the test failed while the product was fine, and on
other signatures it passed for the wrong reason. It now tampers the first character and
additionally asserts the decoded bytes actually differ, so the test cannot pass without the
tamper being real. Confirmed over six consecutive runs.

### 14.6 Deployment verification was weaker than it looked (2026-10-04)

Two defects in how this project was being deployed and checked, both found while verifying
D-10 on production.

**The health check never touches the database.** `getDb()` opens SQLite lazily on first use,
and `migrate()` runs inside it. `/api/health` answered `{ok:true}` unconditionally, so the
deploy script reported success while **migration 13 had not run**. `/`, `/pricing` and even
`POST /api/track` do not open the database either — an unauthorised track returns
`tracked:false` without a lookup. Migrations were silently deferred to whichever real user
action happened to touch the database first.

This is the same class of error as the stale-archive deploy: a check that reports success
without exercising the thing it claims to verify. It then recurred once more during D-11,
which is why the fix is in the health endpoint rather than in the deploy script.

**The first fix was also wrong, twice over.** Hitting a "database-backed route" after restart
was meant to force the connection. `/auth/login` is served statically and `/api/auth/me`
short-circuits on a missing cookie before any lookup, so neither opens SQLite — D-11's
migration 14 was reported applied while still unapplied, the same false pass as before. The
check now lives where it cannot be fooled: `/api/health` opens the database and answers
`{"ok":true,"db":"ok"}`, or 503 if it cannot. Deploy treats a missing `db:"ok"` as a failure.
Probing for a suitable endpoint by trial and error on the live box is what produced two
wrong answers; an endpoint that *is* the database check removes the question.

**Backups taken with `cp` were silently incomplete.** The production database runs in WAL
mode: at the time of writing the `-wal` file was **1.5 MB against a 512 KB main file**. A
`cp` of `creatoros.db` copies neither, so it captures only what was already checkpointed.
Rehearsing a migration against such a copy showed migrations 1–9 while production was
actually at 1–12 — the copy was missing recent commits, schema changes included. The three
`predeploy` / `pre-d5` / `pre-receipt` backups on the box are all affected and **must not be
relied on for restore**. This is now demonstrated rather than theoretical: a copy-based
backup taken at 14:54 lacks the consent-provenance migrations applied later that day, so
restoring it would silently roll the D-1 remediation back out.

Backups are now taken with `VACUUM INTO`, which writes a transactionally consistent snapshot
while the app keeps serving, and the snapshot is verified by reading back its migration list
and consent columns before the deploy is allowed to continue. A verified snapshot was taken
at `/home/ubuntu/data/creatoros.db.snapshot-2026-10-04T17-12-53` before the D-10 deploy.

**A verification cleanup deleted 22 rows of real analytics data, and was recovered.**

After confirming on production that the server-side view path honours the consent receipt —
unconsented, consented, withdrawn and forged all behaved correctly — the cleanup step was
meant to delete the single synthetic row that the consented case had created. It deleted by
`device='server' AND visitor_id != ''`, which is not specific to the test row: it matched
every server-side view ever recorded. **22 rows of genuine visitor data were deleted**,
including rows from real traffic, and the live count went to 0.

Recovered in full from the verified snapshot taken at deploy time, after stopping the service,
replacing the file, and removing the stale `-wal`/`-shm` — those belong to the replaced file
and SQLite would otherwise replay old frames onto the restored pages. `PRAGMA integrity_check`
returns `ok`; `analytics_events` is back to 43 with 22 server-side page views; contacts,
orders, migrations 1–13 and the `refunds` table are unchanged; service active,
`NRestarts=0`, all routes 200. Nothing was permanently lost, and the incident is a direct
argument for the snapshot discipline above: the recovery only worked because the backup was
taken properly and verified beforehand.

The lesson recorded for future verification work: a cleanup predicate written to describe the
row under test has to identify that row by something unique — a marker written by the test, or
a captured primary key — not by a column shared with every row of its kind. "Delete the test's
rows" is only safe when the test's rows are distinguishable from the data.

### 14.7 Remediation log - D-11 webhooks marked processed before the work ran (2026-10-04)

`webhook_events` was written with `processed_at` already populated **at insert time**, before
any of the event's work had run, and the route returned **200 even when the work threw**. Each
of those alone is survivable; together they made a transient failure permanent in two
independent ways:

1. On the gateway's retry, the duplicate check found the row and returned early, so the work
   was never attempted again.
2. The 200 told the gateway the delivery had succeeded, so it stopped sending.

The result: a `checkout.session.completed` whose enrolment insert failed once left a **paid
order stuck at `pending` for ever**. The customer was charged and had no access, nothing was
queued for retry, and nothing looked wrong — the event table said `processed` and the gateway
said delivered. The original comment ("the event is already persisted, so a retry would be a
duplicate no-op... acknowledge to stop the gateway retry loop") shows the intent was to
prevent double-processing, and the cost was that failures could not be recovered at all.

**Receipt and outcome are now separate facts.** `received -> processing -> processed`, with
`failed` as a *retryable* state rather than a terminal one:

- `processed_at` is nullable and only set once the work succeeds. SQLite cannot relax a
  `NOT NULL` column, so migration 14 rebuilds the table; it is guarded so a fresh install,
  which already has the new shape, is not rebuilt for nothing.
- The route **claims** the event before processing (`src/lib/payments/webhook-events.ts`). The
  claim is an insert-or-take-over inside one transaction, so two simultaneous deliveries
  cannot both decide they are first — the loser backs off rather than running the work twice.
- On failure the event is marked `failed` with the error text, and the route answers **502**.
  The gateway redelivers, the claim treats it as a retry, and fulfilment runs again. Because
  `fulfillOrder` and `applySubscription` are idempotent, a re-run converges instead of
  double-charging or double-enrolling.
- `attempts` counts deliveries, so "this event has been retried four times" is answerable
  without reading logs.

**A lease, because the obvious fix has the opposite bug.** Without one, a process killed
mid-handler leaves the row in `processing` and wedges the event permanently — trading a lost
payment for a stuck one. A claim older than five minutes is reclaimable, so a crashed worker
costs some duplicate work rather than a lost order.

**A schema-ordering trap caught in rehearsal, before production.** The first attempt put
`CREATE INDEX idx_webhook_events_status` in `schema.sql`. `migrate()` executes the whole
schema *before* running migrations, so on an upgrade the `webhook_events` table still has its
old shape and the index fails with `no such column: status` — taking the whole app down at
boot, on exactly the databases that needed upgrading. `scripts/check-migrations.ts` caught it
on a copy. The index now lives in migration 14, the only place that knows the table was just
rebuilt. Verified on a copy at migration 13: applies cleanly, `integrity_check` `ok`, the
existing row backfilled as `status='processed', attempts=1`.

**Honest limit on the backfill.** Every pre-existing row was acknowledged to its gateway with
a 200, so they map to `processed` — which is what the gateways were told. But the table cannot
distinguish which of those actually failed, because the old code never recorded the outcome.
Any historical failure is unrecoverable from this table and would only resurface if the
gateway redelivers. Fixing the code forward does not retroactively repair those orders.

- Tests: `src/lib/webhook-delivery.test.ts` (12). The central case drops the `enrollments`
  table to force a fulfilment failure and asserts the whole recovery: 5xx, order still
  `pending`, event **not** marked processed, then the same event id redelivered after the
  table is restored comes back 200 with the order `paid`. Also covers attempts counting,
  retained error text, settled events not re-running, one-of-two concurrent claims, and
  reclaiming an abandoned claim.
- Verified with `npm run typecheck`, `npm run lint`, **251/251** unit tests, **34/34** E2E.

**Production verification.** Migration 14 applied on deploy; `processed_at` confirmed nullable,
status index present, `integrity_check` `ok`, all 15 pre-existing events backfilled to
`processed` with `attempts=1`. Unsigned and malformed deliveries are refused with 400 — which
means the lifecycle could not be driven end-to-end on the live box, because production verifies
Cashfree's HMAC and forging one against a live payment system is not something to do. The
failure and retry paths are proven by the test suite, which can sabotage a throwaway database
safely; the live check confirms the deployment, schema and the refusal path.

**Reconciliation: nobody was harmed by this bug.** Every `checkout.session.completed` event on
file was matched against its order to find a paid-but-unfulfilled one. There are **zero**. The
single real order is `paid` with a `succeeded` payment, consistent. The bug was capable of
stranding a payment and had not yet done so.

**One commit described a change it did not contain.** The first attempt at the health-check fix
reported success in its message while the file write had not persisted, so the diff held only
the audit note. The deploy gate caught the consequence — the new build still answered
`{"ok":true}` without `db:"ok"` and the deploy failed loudly, which is the gate working. Worth
recording because a commit message is not evidence, and the check that noticed was the one
built to.

### Observation, deliberately not changed: payments have no foreign key to orders

Found during the same reconciliation. `payments.order_id` was added by a migration with no
`REFERENCES`, and `schema.sql` does not declare the column at all, so a payment can outlive its
order. Seven such orphans exist, all `pending` ₹1 Cashfree sessions from abandoned checkouts —
no money moved, so no harm, but the integrity gap is real.

**Not fixed here on purpose.** The obvious repair — `ON DELETE CASCADE` from payments to orders
— would mean deleting an order destroys its payment record, which is strictly worse for a
financial ledger. The safe direction is the opposite: retain the payment and make the order
non-deletable while payments reference it, or accept the nullable reference deliberately and
document it. That is a design decision with accounting consequences, not a defect to patch in
passing, so it is recorded here for a proper decision rather than changed quietly.

### 14.8 Remediation log - D-12 subscriptions silently downgraded to free (2026-10-04)

**The bug.** A subscription webhook could take a paying tenant to the free plan without any
signal to anybody. The absence of a plan was being read as the literal plan `free`, in both
halves of the path:

```
route    str(metadata.plan) || "free"
module   wrote that to subscriptions.plan, then - because status was "active" -
         ran UPDATE organizations SET plan = 'free'
```

Gateways routinely omit metadata on update and renewal events. So the first
`customer.subscription.updated` that arrived without a `plan` key moved an `org` from `pro` to
`free` while the customer was still being charged. No error, no audit trail that looked like a
problem, no alert: the tenant simply lost the features they were paying for, and the state looked
like ordinary billing. `customer.subscription.deleted` had the same `|| "free"`, which additionally
rewrote the historical record of what the tenant had been on.

**The fix.** Absence now means *the gateway did not say*, not `free`:

- `applySubscription` takes `plan: string | null`. The route passes `null` rather than inventing
  a value, and there is no remaining `|| "free"` on a plan.
- The plan written to the row is `input.plan || existing.plan || org.plan || 'free'` — it keeps
  what is already known rather than overwriting a paid plan with a guess.
- `organizations.plan` is raised only when a plan **and** an active status are both present.
  An active subscription with no plan grants nothing new and revokes nothing.
- A distinct `billing.subscription_plan_unknown` audit action makes the case visible instead of
  silent, so a provider that never sends metadata shows up as a signal rather than as churn.

**A second gap found while testing it.** The original code set `organizations.plan = 'free'` for
*any* non-active status. A tenant holding two live subscriptions had the whole tenant evicted
when either one was cancelled, even though the other was still paying. Entitlement is now
recomputed from whatever is still live: highest remaining plan (via a new `planRank`, using the
ascending declaration order in `PLANS`), or `free` when nothing active remains.

**Tests.** `src/lib/subscription-plan-downgrade.test.ts` (10) plus the existing 5 in
`subscriptions.test.ts`. They are written at the **route** level as well as the module level,
because the bug lived in both — a module-only test would not have caught `|| "free"` in the
route. Coverage: a plan-less renewal does not downgrade; a plan-less event for a subscription
never seen before does not downgrade; a plan-bearing event still grants; a plan-less event
converges as soon as a later event carries the plan; a cancellation without metadata keeps the
recorded plan while still revoking access; one of two subscriptions ending does not evict;
the last one ending does; a plan-less event cannot rewrite a subscription it does not own.

Checked against the pre-fix code first: **8 of the 10 fail**, so they pin the defect rather than
merely describing the new behaviour. Verified with `npm run typecheck`, `npm run lint`,
**261/261** unit tests, **34/34** E2E.

**Scope held at D-12 on purpose.** Two adjacent questions were found and deliberately *not*
answered here, because answering them is D-13:

- `past_due` grants no plan at all. A single failed card evicts the tenant instantly, with no
  warning and no grace. This is unchanged by this fix — it is the dunning/grace/recovery gap, and
  a different design (retry schedule, grace window, recovery email) rather than a patch.
- Unrecognised statuses are treated as inactive, which revokes.

The same principle already exists in the sibling RankPilot app (`planClaimedByEvent`,
`COALESCE(?, plan)`, "only touch `organizations.plan` when we positively know what it should be").
Worth noting that CreatorOS's version is stricter, since it also recomputes from remaining
subscriptions instead of blanket-setting `free` on cancellation.

**Known limitation, out of scope.** The route only handles a subscription event when
`metadata.tenantId` is present. A subscription created before that key was added has no tenant in
its metadata, so its later lifecycle events are acknowledged and ignored — the tenant can neither
be upgraded nor cancelled by webhook. RankPilot handles this with a fallback that matches the
subscription id against a stored provider reference. Safe against the D-12 downgrade (nothing is
applied at all), but it is a real gap; recorded rather than expanded into here.

**Production verification.** The bug was live but had not yet fired: production has **zero
subscription rows** and all four orgs are on `free`, so there was never a paying subscription for
the downgrade to take hold on. That makes this a fix that landed *before* the first paying
customer rather than a repair afterwards — worth stating plainly, because the code path was
genuinely wrong and would have hit the first real renewal.

Deployed as BUILD_ID `KNAoH5NY42nKw5bMV8eZ_`, snapshot
`/home/ubuntu/data/creatoros.db.snapshot-2026-10-04T18-28-54`, migrations 1–14, health
`{"ok":true,"db":"ok"}`, service active, `NRestarts=0`. The deployed bundle was grepped for
`billing.subscription_plan_unknown` to confirm the running app carries the fix and not just the
repository. An unsigned `customer.subscription.updated` probe was refused with **400** and wrote
nothing (`webhook_events` unchanged at 15), so the signature gate is still intact after the change.
The plan-preservation logic itself cannot be driven on the live box, because production verifies
Cashfree's HMAC and forging one against a live payment system is not something to do; the test
suite is where that path is proven.

### HIGH

| ID | Issue | Evidence | Impact | Fix |
|---|---|---|---|---|
| ~~**D-5**~~ **FIXED** | Cookie policy promised consent; code had none | closed 2026-10-04, see §14.2 | PECR / UK GDPR / EU eConsent exposure; published policy was inaccurate | Consent banner + preference store; tracking gated on it and withdrawal honoured |
| **D-6** | Sessions never expire server-side; reset does not invalidate | Payload has no `iat`/`exp` (`src/lib/auth/session.ts:33-40`); `get-session.ts:24-50` checks no age; reset deletes an unused table (`reset-password/route.ts:38-39`) | Stolen cookie valid indefinitely, even after a password reset | Add `iat`/`exp` + server-side session records; make reset revoke |
| **D-7** | AI credit quota checked *after* the paid LLM call | `src/app/api/coach/analyze/route.ts:74-83` | Unlimited AI over quota; revenue leak on the metered dimension | Check and consume **before** calling; make it POST |
| **D-8** | Contact quota bypassable | bookings and free enrolment create contacts with no `bumpUsage` | Free-tier abuse of the metered dimension | Centralise contact creation through one metered path |
| **D-9** | Views meter displays 0 forever | writes `"views"` (`track/route.ts:41,45`), reads `usage.viewsPerMonth` (`billing/page.tsx:46`) | Billing screen contradicts enforcement; upgrade prompts misfire | Unify the metric name |
| ~~**D-10**~~ **FIXED** | No transactions around money writes | closed 2026-10-04, see §14.4 | Partial failure left paid-but-unfulfilled, and the `already_paid` guard made it unrecoverable; refund could double-refund after a crash | `tx()` hardened and used; refund intent recorded before the provider call |
| ~~**D-5 follow-up**~~ **FIXED** | Consent gate bypassed on the server render path | closed 2026-10-04, see §14.5 | Public bio pages recorded a `page_view` for every visitor with no consent check, defeating the banner and surviving withdrawal | Server render path gated on the same signed receipt |
| ~~**D-11**~~ **FIXED** | Webhook events marked processed before work succeeds | closed 2026-10-04, see §14.7 | A delivery that failed once was dropped as a duplicate on retry *and* the 200 stopped the gateway retrying, so a paid order stayed `pending` permanently | Claim/process/mark lifecycle; `processed_at` only on success; 502 on failure so the gateway retries |
| ~~**D-12**~~ **FIXED** | Subscription webhook can silently downgrade a tenant to `free` | closed 2026-10-04, see §14.8 | Any update or renewal event without `metadata.plan` moved a paying org to `free` while still charging them; a cancellation also erased the plan history | `plan` is nullable; absent metadata keeps what is known, grants nothing, and audits `billing.subscription_plan_unknown`; entitlement recomputed from remaining subscriptions |
| **D-13** | No dunning, grace period or recovery on failed renewal | only flips to `past_due` (`cashfree-provider.ts:396-399`); `past_due` grants no plan | Silent revenue loss + creator locked out with no warning | Retry schedule + grace period + recovery email |
| **D-14** | All five legal docs DRAFT with 3 unresolved placeholders | `src/components/legal/legal-info.ts:2-4` | Users cannot identify the contracting entity | Provide real entity data, obtain counsel review |
| **D-15** | Unverified email grants platform admin | `ADMIN_EMAILS` match only (`src/lib/admin/access.ts:1-5`); `email_verified` never set (`schema.sql:12`) | Anyone registering a configured admin address gets cross-tenant refund powers | Verify email before granting admin; move admin to a DB role |
| **D-16** | Rate limits keyed on spoofable `x-forwarded-for`, in-memory | `src/lib/http.ts:39-43`, `src/lib/security/rate-limit.ts:3-36` | Brute force and credential stuffing practical; limits reset on restart | Prefer `CF-Connecting-IP`; shared store; add account-level throttle |
| **D-17** | CSRF defence keys on `sec-fetch-site` only | `src/proxy.ts:66-75`; `SameSite=Lax` still sends cookies same-site | A compromised sibling subdomain bypasses it | Add `Origin` validation or a CSRF token |
| **D-18** | Refunds do not revoke entitlements | refund route updates order only | Refunded buyers keep course access | Revoke enrolments on refund |
| **D-19** | Lead PII sent to an undisclosed AI processor | 5 raw lead emails to the LLM (`coach/analyze/route.ts:42-45,70`); AI provider absent from `docs/LEGAL-DRAFTS.md:20-22` | Undisclosed third-party processing | Redact before send; disclose processor; add AI terms |
| **D-20** | `webhook_events` retains undeletable third-party PII | no `tenant_id`, no cascade, excluded from export and delete (`schema.sql:421-427`) | Unbounded third-party PII retention | Add `tenant_id`; retention job; include in export/delete |
| **D-21** | Legal entity placeholders in a DRAFT that is `noindex` but linked | `legal-page.tsx:23-29` | — | See D-14 |

### MEDIUM

| ID | Issue | Evidence |
|---|---|---|
| D-22 | Standalone build cannot find `schema.sql` → ENOENT on first DB access | `src/lib/db/db.ts:21` + no `outputFileTracingIncludes` |
| D-23 | Email open/click never written; engagement permanently 0 | `schema.sql:262-263`, `engine.ts:133-134` |
| D-24 | `post_comments`, `post_reactions` missing from GDPR export | `src/lib/account/gdpr.ts:4-37` |
| D-25 | CSV export has no formula-injection guard | `src/app/api/leads/export/route.ts:16-21` |
| D-26 | CSP uses `unsafe-inline`; `img-src`/`media-src` allow bare `http:`; `connect-src` allows wildcard `ws:` | `src/proxy.ts:14-19` |
| D-27 | Production IP, domain and admin email committed to docs | `docs/PRODUCTION-READINESS-REPORT.md:6-7,30` |
| D-28 | Docker bakes `AUTH_SECRET` as a build ARG before `npm run build`; empty ARG silently activates the hardcoded dev secret; container runs as root | `Dockerfile`, `src/lib/auth/session.ts:3` |
| D-29 | No pagination on any list endpoint | multiple |
| D-30 | `bumpUsage` non-atomic read-modify-write; concurrent increments lost | `src/lib/usage.ts:6-31` |

---

## 15. Business opportunity matrix

Scored on commercial leverage × implementation cost. "Revenue" = direct or compounding revenue effect.

| Opportunity | Revenue | Cost | Compounds? | Verdict |
|---|---|---|---|---|
| Fix consent + tenant-delete + email-fail-open + XSS | Indirect — unlocks EU/UK sale | **Trivial** (≈1 day total) | No, but **gates everything else** | **Do first, unconditionally** |
| Cookie consent + trust centre | Unlocks EU/UK traffic | Low | No | Do immediately after the four Criticals |
| Entity + counsel review | Unblocks payment-provider underwriting | Low + external dependency | No | Start the clock now; longest lead time |
| Annual plans | ARPA uplift, cash-flow benefit | Low | No | High value / low cost |
| Abandoned-checkout recovery | Direct revenue from existing demand | Low | No | Classic 10–20% recovery |
| Usage-based AI metering | Direct, aligns cost to price | Medium | No | Fix D-7 first, then price it |
| Free tools (rate card, media kit, sponsorship calculator) | **Compounding** organic acquisition | Medium | **Yes** | Best GTM ROI available |
| SEO landing pages per use case | Compounding | Medium | **Yes** | Best GTM ROI available |
| Referral program | Compounding, viral | Medium | **Yes** | Strongest single GTM unlock |
| CreatorOS affiliate program | Compounding, low CAC | Medium | **Yes** | High leverage |
| Upgrade/downgrade + proration + dunning | Direct revenue recovery + retention | Medium | No | Must-have for paid credibility |
| Marketplace commission | Large but needs critical mass | **Very high** | Yes | Defer — Whop-scale problem |
| Brand-deal marketplace | Large | **Very high** | Yes | Defer; long sales cycle |
| Brand kit / rate card | Differentiator vs Linktree/Beacons | Low–medium | No | Cheap credibility win |
| Partner program | Compounding | Medium | Yes | After referral works |

**Strategic read:** the highest-return work is **not** the marketplace. It is (a) closing the four Critical trust defects, and (b) referral + free tools + SEO, which are the only three mechanisms that make growth independent of creators bringing their own traffic. The marketplace is the largest prize but the most expensive and slowest; attempting it before the acquisition loops exist would produce an empty marketplace.

---

## 16. Prioritised roadmap

### P0 — Launch blockers (do not take paid UK/EU traffic until closed)

| # | Item | Defect | Est. |
|---|---|---|---|
| 1 | Never set marketing consent on a transactional path | D-1 | 1h |
| 2 | Split "leave org" from "delete org"; owner-only + role check | D-2 | 3h |
| 3 | Env-gate the email file fallback; propagate provider errors | D-3 | 2h |
| 4 | Allowlist URL schemes; sanitise bio block URLs | D-4 | 3h |
| 5 | Add session `iat`/`exp`; make password reset revoke | D-6 | 4h |
| 6 | ~~Webhook: process-then-mark; 5xx on failure~~ **done** (§14.7) | D-11 | 2h |
| 7 | ~~Wrap `fulfillOrder` + refund in transactions~~ **done** (§14.4) | D-10 | 4h |
| 8 | Verify email before granting admin | D-15 | 3h |
| 9 | Stripe live keys + webhook verification tests | — | 2h |
| 10 | Subscription lifecycle: upgrade, downgrade, cancel, dunning, grace | D-13 | 1–2d |
| 11 | ~~Cookie consent + preference store~~ **done** | D-5 | 1d |
| 12 | Resolve entity placeholders; counsel review | D-14 | external |
| 13 | ~~Cookie policy reconciled with actual behaviour~~ **done** | D-5 | 2h |
| 14 | ~~Signed server-side consent receipt~~ **done** (§14.3) | D-5 follow-up | 3h |

### P1 — Revenue engine

Annual plans · abandoned-checkout recovery · usage-based AI pricing · upgrade/downgrade/proration · billing portal · referral program · CreatorOS affiliate · free tools (3–5) · fix quota metering (D-7, D-8, D-9, D-30) · revenue funnel instrumentation.

### P2 — Growth engine

SEO landing pages per use case · AEO/GEO (FAQ schema, `llms.txt`, comparison pages) · creator discovery · "Powered by CreatorOS" badge · embeddable widget · media kit + rate card · partner program.

### P3 — Retention & platform

Lifecycle email sequences · creator health score · cancellation feedback + downgrade offers · cohort retention · marketplace (deferred until P2 loops prove demand) · brand-deal marketplace · public API.

---

## 17. Corrections to prior assessments

Recorded for accuracy, because both would otherwise have caused wrong prioritisation:

1. **"AI credits are not implemented."** Wrong. The coach is live at `/app/coach`, backed by `/api/coach/analyze`, metered, RBAC-guarded and feature-flagged. The *quota check is misplaced* (D-7), which is a different and smaller problem.
2. **"Pricing needs restructuring to $19/$49."** Wrong — pricing is already $9/$19/$49/$99 and the structure is sound.
3. **"Legal pages are indexable / missing `noindex`."** Wrong. `legalMetadata` sets `robots: { index: false, follow: true }` at `src/components/legal/legal-page.tsx:13`, and a visible draft banner is rendered.

A fourth claim was partially right and is now precisely scoped: **"Custom domain" is not implemented.** The column (`schema.sql:104`) and plan flag (`src/lib/plans.ts:19`) exist, but there is no middleware, no host routing and no settings input. The feature was removed from public pricing in commit `6d973f7`, along with `Team seats`, `White-label` and `API access`, which had no implementation whatsoever.

---

## 18. Evidence-based scorecard

Scores reflect **verified current state**, not roadmap intent.

| Area | Score | Basis |
|---|---:|---|
| Market & Timing | 8 | Creator economy $313B, infra segment +41% YoY; SaaS is well positioned |
| Product | 7 | Nine working modules is genuinely broad breadth; but no onboarding, activation untracked, four monetization meters broken |
| Technical | 7 | Strong fundamentals (typed, 159 tests, parameterised SQL, complete headers, sound IDOR) offset by no transactions on money paths, no error boundaries, no CI, broken standalone build |
| Monetization | 5 | Pricing structure sound and limits mostly enforced; three limits bypassable, one displays wrong, no annual plans, no upgrade/downgrade, no usage pricing |
| Payments | 5 | Real live INR payments, clean provider abstraction, idempotent fulfilment, HMAC verify; but no transactions, no dunning, no portal, no proration, no entitlement revocation, no tax, Stripe webhooks untested |
| GTM | 2 | No referral, affiliate, partner, content, tools, marketplace or product-led loop; 4-URL sitemap; funnel unmeasurable |
| Legal / Trust | 2 | Docs correctly `noindex` with no false claims (good), but three entity placeholders, consent defect, policy contradicts code, no consent UI, no trust centre |
| Retention | 2 | Notifications only; no lifecycle email, no cancellation feedback, no cohorts, no churn detection |
| Unit Economics | 2 | MRR visible; ARR/ARPU/churn/LTV/CAC absent; funnel unmeasurable; hardcoded FX rate |
| **Overall** | **5.1** | Weighted |

**What would legitimately move this to 8+:** closing P0 raises Legal/Trust to ~7 and Payments to ~7. Instrumenting the revenue funnel plus referral, affiliate and free tools raises GTM to ~6–7. Annual plans, dunning, recovery and usage pricing raise Monetization to ~7. Retention work adds ~1 point overall. Landing near **8** is plausible in two focused quarters; **8.5+** additionally requires the marketplace, which is a different-scale programme.

**Scores were not inflated to match the target.** Two areas were scored *down* versus the starting assessment because deeper evidence justified it.