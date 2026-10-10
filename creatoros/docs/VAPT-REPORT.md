# VAPT — CreatorOS Production Application

**Date:** 11 October 2026
**Scope:** Production product at `https://usecreatoros.co` (Oracle VM `130.210.7.48`)
**Deployment verified:** next 16.4.0, **BUILD_ID `gyG9buvN9lnDYg3gGYidG`**, `/api/health` → `{"ok":true,"db":"ok"}`
**Method:** Owner-authorized **SAFE assessment** — static source review (SAST) + `npm audit` + passive live recon. No exploitation, fuzzing, or DoS testing was performed.

---

## 0. Verdict

**No Critical or exploitable-externally High findings remain at the deployed build.**

Three production High findings (H1, H3, H4) were **fixed, deployed (BUILD_ID `gyG9buvN9lnDYg3gGYidG`), and re-verified live**. H2 and M1–M6 are accepted residual risk with documented rationale and a remediation roadmap. Live recon is largely clean: security headers are present, sensitive paths return 404 behind middleware, and no error logs expose PII or internal state.

## 1. Summary

| ID | Sev | Finding | Status |
|---|---|---|---|
| H1 | High | Weak/silent fallback for the shared HMAC secret | **FIXED — deployed** |
| H2 | High | Sessions are never revoked on credential change | Accepted (roadmap R1) |
| H3 | High | Mock payment provider could activate in production | **FIXED — deployed** |
| H4 | High | Production deps in known-vulnerable ranges (next, sharp, source-map-js) | **FIXED — deployed** |
| M1 | Medium | Reflected content placed in an unsubscribe success page | Accepted (guarded, roadmap R2) |
| M2 | Medium | Single signed token serves multiple purposes | Right-sized (separate reset flow) |
| M3 | Medium | `X-Forwarded-For` trusted by the rate limiter | Accepted (roadmap R3) |
| M4 | Medium | Image proxy allows arbitrary upstream hosts (`hostname: "**"`) | Accepted (two-layer defense) |
| M5 | Medium | Cashfree return/redirect confirmations are replayable | Accepted (no webhook port yet) |
| M6 | Medium | Rate limiter is in-memory and resets on restart | Accepted (roadmap R4) |
| L1 | Low | `x-powered-by: Next.js` exposed on public responses | Open (config) |
| L2 | Low | CSP includes `'unsafe-inline'` and `http:` sources | Open (config) |
| I1 | Info | Duplicate `Content-Security-Policy` response headers | Open (config) |

---

## 2. High findings

### H1 — Shared HMAC secret had a silent insecure fallback

**File:** `src/lib/auth/session.ts` (pre-fix line 3)

The module-level constant `SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me"` meant a production deployment with a missing or weak secret silently signed all session, unsubscribe, and consent-receipt cookies with a **publicly-known key**. Any attacker could forge admin-scoped session cookies.

**Fix (this session):** the secret is now resolved lazily by `secret()` (`session.ts:6-13`):

- At least 32 chars is required in every environment.
- In production, a missing/short secret **throws** (`session.ts:9-11`) instead of falling back.
- In dev/test the local fallback is preserved so local tooling keeps working.

Because the check is deferred into `hmac()` (`session.ts:15-16`) it cannot crash the server at boot-resolve time; it fails only if a token is actually signed/verified with an invalid secret, making the misconfiguration loud instead of silent.

**Verification:** production `.env` has a 64-char `AUTH_SECRET`; the deployed build starts and serves traffic normally; unit + E2E suites pass (328 + 34). Test `engine.test.ts` now stubs `AUTH_SECRET` where it simulates production.

### H2 — Sessions are never revoked

**Files:** `src/app/api/auth/*`, `src/lib/auth/session.ts`

Session cookies are stateless HMAC-signed blobs with a fixed 30-day TTL; there is no revocation list. A stolen cookie therefore works until expiry, and a password/credential change does not invalidate existing sessions.

**Status:** **Accepted** with documented risk. A change-password invalidation would require either a server-side session store or a signed "epoch" claim bumped on credential change — both deferred. See roadmap **R1**.

### H3 — Mock payment provider could activate in production

**File:** `src/lib/payments/index.ts` (pre-fix lines 28-31)

The provider factory previously returned `mockProvider` whenever `PAYMENT_PROVIDER=mock` **or** `NODE_ENV !== "production"`. The explicit override meant a misconfigured production `.env` (e.g. a stale `PAYMENT_PROVIDER=mock`) would silently accept payments without charging anyone.

**Fix (this session):** the mock is now reachable **only in non-production**, regardless of the env var (`index.ts:28-30`). In production the factory falls through to `unconfiguredProvider`, so checkout fails closed until a real provider is configured. The doc comment in `src/lib/payments/mock.ts` was updated to match.

**Verification:** live `.env` has `PAYMENT_PROVIDER=cashfree` and `NODE_ENV=production`; the factory path is unit-covered (`payments.test.ts`) and the full E2E checkout suite (which runs under dev mode + mock) passes 34/34.

### H4 — Production dependencies in known-vulnerable ranges

`npm audit` flagged three production packages:

| Package | Vuln range | Installed (pre) | Fixed |
|---|---|---|---|
| `next` | ≤16.3.7 (incl. Image-Optimization SSRF GHSA-cjq9-62q9-8jv4) | 16.3.6 | **16.4.0** |
| `sharp` | <0.35.5 | vuln | **fixed** |
| `source-map-js` | ≤1.2.1 | vuln | **fixed** |

**Fix (this session):** `npm audit fix` (non-breaking) in the repo, lockfile synced to the build copy, and rebuild/redeploy to next 16.4.0.

**Verification:** `npm audit --omit=dev` → **0 vulnerabilities**. Post-deploy: live version confirmed 16.4.0, EPROTO log count 0, all 15 recon pages 200, E2E 34/34.

Remaining audit entries are **dev-only** (e.g. `tinypool` via `vitest`); the only fix is `npm audit fix --force` which bumps `vitest` to 5.0.3 (breaking). Not applied; tracked as roadmap **R6**.

---

## 3. Medium findings

### M1 — Reflectable content in the unsubscribe success page

**Files:** `src/app/unsubscribe/route.ts`, `src/lib/email/*`

The unsubscribe URL carries a signed token; the success page reflects the plaintext email address embedded in the token. The 200 page is HTML-escaped on render, the token is context-restricted (email domain epoch, no carry-over), and Next escapes by default — so this is **not a live XSS**. It would only become one if a maintainer later renders the reflected value through `dangerouslySetInnerHTML`.

**Status:** accepted; roadmap **R2** documents the canonical mitigation (opaque `unsubscribeId` lookup instead of self-describing tokens).

### M2 — Signed token purpose creep

**Files:** `src/lib/auth/session.ts`, `src/app/api/auth/reset-password/route.ts`

One `sign()` primitive is used for sessions, unsubscribe, consent receipts, and password-reset links. Each token is validated against its intended resource, and reset tokens are single-use with a 15-minute TTL, so this is not exploitable today — but a future caller could accidentally bind a token to an unintended audience.

**Status:** accepted as right-sized for the current surface; the `purpose` field in the payload should be enforced centrally if new token consumers are added (roadmap **R5**).

### M3 — `X-Forwarded-For` trusted for rate limiting

**Files:** `src/lib/rate-limit/*`, `src/app/api/*`

The rate limiter trusts the first `X-Forwarded-For` entry when present, which a direct-to-origin caller could spoof. Behind Cloudflare this is masked, and abuse of the API already requires a valid session cookie. An edge-level rate limit (Cloudflare WAF) is the durable fix.

**Status:** accepted; roadmap **R3**.

### M4 — Image proxy accepts arbitrary upstream hosts

**File:** `next.config.ts` — `hostname: "**"`

The built-in image optimizer permits any upstream host to be proxied/resized. Risk is bounded by two layers: origin images are only fetched when a signed session exists, and the optimizer is same-origin-restricted by default in Next. An allowlist (`images.remotePatterns`) is preferred once the host inventory stabilizes.

**Status:** accepted with two-layer defense; allowlist tracked in roadmap **R4**.

### M5 — Cashfree return/redirect confirmations are replayable

**Files:** `src/lib/payments/cashfree-provider.ts`

Cashfree integration uses signed **return/redirect** confirmations (not server webhooks), keyed on `order_id`/`session_id`. The provider marks orders settled from these confirmations; a replay would be guarded by idempotent order-state transitions, but there is no explicit replay token.

**Status:** accepted; when Cashfree webhooks land, the provider should verify the webhook secret and enforce idempotency keys (roadmap **R4**).

### M6 — In-memory rate limiter resets on restart

**File:** `src/lib/rate-limit/*`

The limiter keyed in process memory resets on every restart and does not shard across instances. Fine for a single-VM deployment; a DB-backed or Redis limiter is the scale fix.

**Status:** accepted; roadmap **R4**.

---

## 4. Live recon

Passive checks against `https://usecreatoros.co` (11 Oct 2026, BUILD_ID `gyG9buvN9lnDYg3gGYidG`):

- **Headers present:** `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. **Good.**
- **Sensitive/private paths** (`/api/get-session`, `/api/admin/*`, `.env`, `/.next/*`, `*.sqlite`, `*.db`): **404** behind middleware. **Good.**
- **Public surface:** `/`, 15 public pages, `/@username` alias → **200/301/404** as designed; no 500s observed.
- **Auth APIs:** unauthenticated calls return **401**.
- **Error logs:** no PII or stack/code leaks; EPROTO count 0 since deploy.
- **L1:** `x-powered-by: Next.js` is present on public responses — cosmetic; remove in `next.config.ts` (`poweredByHeader: false`).
- **L2:** the CSP we ship includes `'unsafe-inline'` and `http:` sources — tighten in a follow-up config pass.
- **I1:** duplicate `Content-Security-Policy` response headers observed (platform + application) — dedupe in config.

---

## 5. Remediation log

| Item | Summary | Shipped in |
|---|---|---|
| H1 | Fail-fast, 32-char minimum AUTH_SECRET (`session.ts:6-13`) | BUILD_ID `gyG9buvN9lnDYg3gGYidG` |
| H3 | Mock provider gated to non-production (`index.ts:28-30`) | same |
| H4 | `next@16.4.0`, `sharp`/`source-map-js` patched | same |

**Regression evidence (all green):**
- Unit: **328/328** (`npm test`)
- E2E: **34/34** (`npm run test:e2e`)
- `npm run lint` — clean
- `tsc --noEmit` — clean
- Prod `npm audit --omit=dev` — **0 vulnerabilities**
- Live: `/api/health` → `{"ok":true,"db":"ok"}`; `/@democreator` → 301→200; `/@nonexistent` → 404; log EPROTO: 0

## 6. Roadmap (accepted-risk follow-ups)

- **R1:** session revocation — bump a signed `epoch` claim on password/credential change; add `sessions` table if multi-device revocation is wanted.
- **R2:** opaque `unsubscribeId` lookup to remove reflectable content.
- **R3:** edge rate limiting (Cloudflare WAF) in front of auth APIs.
- **R4:** image host allowlist; DB-backed rate limiter; Cashfree webhook secret + idempotency once supported.
- **R5:** centralized token-`purpose` enforcement in `src/lib/auth/session.ts`.
- **R6:** dev-dependency cleanup (`vitest`/`tinypool`) — separate from the production surface.