# Dodo Payments integration (US/UK + international billing)

Dodo Payments is wired as a fourth `PaymentProvider` alongside Cashfree, Stripe
and the dev mock (`src/lib/payments/dodo-provider.ts`). It is a **Merchant of
Record (MoR)**: Dodo is the seller of record and handles sales tax/VAT and
remittance, which is why an Indian entity can bill US/UK customers without a
foreign subsidiary.

INR stays on Cashfree. Dodo serves the currencies it is enabled for
(`DODO_CURRENCIES`, default `usd,gbp,eur`). Currency routing is automatic:
`getPaymentProviderForCurrency()` returns whichever configured provider supports
the order's currency, preferring `PAYMENT_PROVIDER`.

## 1. Create products in the dashboard

Unlike Stripe, Dodo has **no inline pricing**: every checkout line references a
product that already exists in the dashboard. Create one product per plan under
**Products**, priced in the currency you will bill. Dodo is per-currency, so if
you sell USD and GBP at different price points, create a product per currency.

| Plan | Suggested product name | Env var |
| --- | --- | --- |
| Starter | CreatorOS Starter | `DODO_PRODUCT_STARTER` |
| Creator | CreatorOS Creator | `DODO_PRODUCT_CREATOR` |
| Pro | CreatorOS Pro | `DODO_PRODUCT_PRO` |
| Business | CreatorOS Business | `DODO_PRODUCT_BUSINESS` |

Copy each product id (`pdt_...`) from **Products → View Details**.

> Subscription products: set the subscription **period longer than the payment
> frequency** (e.g. 20-year period, monthly frequency). A period equal to the
> frequency expires after one cycle instead of renewing.

## 2. API key and webhook secret

1. **Developer → API Keys** → copy the key into `DODO_PAYMENTS_API_KEY`.
2. **Developer → Webhooks** → create an endpoint:
   - URL: `https://usecreatoros.co/api/webhooks/stripe`
   - Events: `payment.succeeded`, `payment.failed`, `subscription.active`,
     `subscription.renewed`, `subscription.updated`, `subscription.plan_changed`,
     `subscription.on_hold`, `subscription.past_due`, `subscription.cancelled`,
     `subscription.expired`, `subscription.failed`.
   - Copy the signing secret (`whsec_...`) into `DODO_PAYMENTS_WEBHOOK_KEY`.

The webhook route (`src/app/api/webhooks/stripe/route.ts`) already accepts Dodo
deliveries: it reads the Standard Webhooks headers (`webhook-id`,
`webhook-timestamp`, `webhook-signature`), verifies the HMAC, then maps the event
onto the neutral events the fulfilment code handles.

## 3. Environment

```
PAYMENT_PROVIDER=dodo
DODO_PAYMENTS_API_KEY=...
DODO_PAYMENTS_WEBHOOK_KEY=whsec_...
DODO_ENV=test          # switch to live for production
DODO_CURRENCIES=usd,gbp,eur
DODO_PRODUCT_STARTER=pdt_...
DODO_PRODUCT_CREATOR=pdt_...
DODO_PRODUCT_PRO=pdt_...
DODO_PRODUCT_BUSINESS=pdt_...
BILLING_CURRENCY=usd
```

Until `DODO_PAYMENTS_API_KEY` is set, `isConfigured()` is false and behaviour is
unchanged (callers show their existing "not available yet" state).

## 4. How events map

`mapDodoEvent()` (`src/lib/payments/dodo-provider.ts`) converts Dodo payloads to
the provider-neutral shapes:

| Dodo event | Neutral event | Effect |
| --- | --- | --- |
| `payment.succeeded` | `checkout.session.completed` (mode `payment`) | fulfil the one-time order |
| `payment.failed` | `checkout.session.expired` | close the pending order |
| `subscription.active` / `.renewed` / `.plan_changed` / `.updated` | `customer.subscription.updated` (active) | grant/extend the plan |
| `subscription.on_hold` / `.past_due` | `customer.subscription.updated` (past_due) | keep the record, flag for dunning |
| `subscription.cancelled` / `.expired` / `.failed` | `customer.subscription.deleted` | drop the plan |

Signature verification is Standard Webhooks: HMAC-SHA256 over
`${webhook-id}.${webhook-timestamp}.${rawBody}`, keyed by the base64-decoded
`whsec_` secret, with a 5-minute tolerance. Covered by
`src/lib/payments/dodo-webhook.test.ts`.

## 5. Open items to verify in test mode before go-live

These are the parts that cannot be verified without a Dodo account. Confirm each
with a real test-mode checkout before enabling live keys:

- **Metadata propagation.** Correlation relies on the checkout `metadata`
  (`tenantId`, `plan`, `orderId`) being echoed on the payment/subscription
  objects. Dodo documents `metadata` on both objects and the subscription
  webhook example reads `subscription.metadata`, but propagation of
  *session-level* metadata is not explicitly documented. Verify that a test
  subscription carries `metadata.tenantId`/`metadata.plan`; if not, correlate by
  `customer_id` or PATCH the metadata onto the subscription at creation.
- **Refund endpoint.** `refundPayment()` calls `POST /refunds` with
  `{ payment_id, amount? }`. Confirm the path/field names against the live API.
- **Cancel endpoint.** `cancelSubscription()` calls
  `PATCH /subscriptions/{id}` with `{ status: "cancelled", cancel_reason:
  "cancelled_by_merchant" }`. Confirm this matches the account's cancellation
  settings.
- **One-time store products.** The store/course path has no per-product Dodo id
  yet. `createCheckoutSession()` requires `metadata.dodoProductId` (or
  `metadata.productKey` mapped via `DODO_PRODUCT_<KEY>`) and throws otherwise.
  Selling creator products through Dodo needs a `dodo_product_id` column on
  `products`/`courses` (follow-up work). Platform plan subscriptions are fully
  wired; USD one-time store sales are not.
- **Plan price parity.** The charged amount comes from the dashboard product,
  not `PLAN_PRICES`. Keep the Dodo product prices in sync with
  `src/lib/plans.ts`.
- **Minimums.** Dodo subscriptions have a $1.00 minimum; a lower total is
  rejected with `TOTAL_PAYMENT_AMOUNT_BELOW_MINIMUM_AMOUNT`.

## 6. Tests

```
npm test -- dodo-webhook
```

Covers signature accept/reject (wrong secret, tampered body, stale timestamp,
wrong delivery id, rotation), event mapping, currency support and plan→product
mapping.

## 7. Go-live runbook (test → live)

Run the whole thing in **test mode locally first**. Do not flip the production box
until 7.1 passes: `BILLING_CURRENCY=usd` on the box changes the live billing page
for every tenant, so a broken checkout there is customer-visible.

### 7.1 Verify in test mode (local, no money)

1. `.env.local` (never the box) with test-mode values:
   ```
   PAYMENT_PROVIDER=dodo
   DODO_PAYMENTS_API_KEY=<test key>
   DODO_PAYMENTS_WEBHOOK_KEY=whsec_<test webhook secret>
   DODO_ENV=test
   DODO_CURRENCIES=usd,gbp,eur
   DODO_PRODUCT_STARTER=pdt_...
   DODO_PRODUCT_CREATOR=pdt_...
   DODO_PRODUCT_PRO=pdt_...
   DODO_PRODUCT_BUSINESS=pdt_...
   BILLING_CURRENCY=usd
   ```
2. Forward test webhooks to the local route (Dodo CLI, test-mode key only):
   ```
   dodo login "<test key>" test
   dodo wh listen http://localhost:3000/api/webhooks/stripe
   ```
   (No CLI? Expose the local port with a tunnel and add that URL as a test-mode
   webhook endpoint instead.)
3. `npm run dev`, register a throwaway account, open `/app/billing`, upgrade to
   **Creator**, pay with a Dodo test card (see *Testing Process* docs).
4. Confirm the redirect returns to the app, then check fulfilment:
   ```sql
   select type, processed_at from webhook_events order by rowid desc limit 5;
   select plan from organizations where id = '<org>';
   select provider, provider_subscription_id, status from subscriptions where tenant_id = '<org>';
   ```
   Pass = a `customer.subscription.*` event with `processed_at` set and the org
   moved to `creator`.
5. Verify the §5 open items by inspecting the stored delivery JSON (metadata
   propagation) and exercising refund + cancel:
   - Metadata: the subscription webhook payload should carry
     `data.metadata.tenantId` / `data.metadata.plan`. If it does not, stop and
     correlate by `customer_id` before going live.
   - Refund: admin refund route on the newest order → `POST /refunds` succeeds.
   - Cancel: `/api/billing/cancel` → `PATCH /subscriptions/{id}` succeeds and a
     `customer.subscription.deleted` (mapped) event downgrades the org.

### 7.2 Flip to live

1. Recreate the products in **Live mode** (the dashboard "Copy to live" option) →
   new `pdt_` ids.
2. Create a **live** API key and a **live** webhook endpoint
   (`https://usecreatoros.co/api/webhooks/stripe`, same event list) → live
   `whsec_`.
3. On the box, set the live values and switch billing currency:
   ```bash
   sed -i '/^DODO_/d;/^BILLING_CURRENCY=/d' /home/ubuntu/app/.env
   cat >> /home/ubuntu/app/.env <<'EOF'
   BILLING_CURRENCY=usd
   DODO_ENV=live
   DODO_PAYMENTS_API_KEY=<live key>
   DODO_PAYMENTS_WEBHOOK_KEY=whsec_<live secret>
   DODO_CURRENCIES=usd,gbp,eur
   DODO_PRODUCT_STARTER=pdt_...
   DODO_PRODUCT_CREATOR=pdt_...
   DODO_PRODUCT_PRO=pdt_...
   DODO_PRODUCT_BUSINESS=pdt_...
   EOF
   systemctl restart creatoros
   ```
   `PAYMENT_PROVIDER` stays `cashfree`; routing is per-currency.
4. Live smoke test: one real purchase at the cheapest plan, confirm the plan is
   applied, then refund it from the admin refund route. Keep the receipt.

## 8. Live checkout audit (2026-10-27)

The code path is correct end to end on production: `POST /api/auth/register` (200),
`POST /api/auth/login` (200, `creatoros_session` cookie), `GET /api/auth/me` (200)
and `POST /api/billing/checkout` with `{plan:"creator"}` returns

```json
{"provider":"dodo","sessionId":"cks_…","url":"https://checkout.dodopayments.com/session/cks_…"}
```

That hosted page loads (200) and the amount matches the plan, but it exposed two
real problems — and one earlier misreading, corrected here on 27 Oct by testing
three billing addresses through `POST /checkouts` and reading the totals off the
returned page:

| Buyer address | Subtotal | Tax line | Total |
|---|---|---|---|
| US (San Francisco, CA) | $19.00 | Tax $0.00 | **$19.00** |
| UK (London) | £14.26 | VAT £2.85 (20%) | **£17.11** |
| IN (Bengaluru) | ₹1,879.76 | GST ₹338.35 (18%) | **₹2,218.12** |

- **The 18% "GST" is not a bug.** An earlier audit fetch came from an Indian IP,
  so Dodo correctly applied Indian GST to that session. A US buyer pays exactly
  $19.00 with no tax. Do not change the Indian tax rules.
- **The GBP price is a currency conversion, not our list price.** All four
  products are USD-only (`price.currency = USD`, `tax_inclusive = false`,
  `tax_category = saas`, `brand_id` = the business id). Dodo's checkout takes the
  price from the product, and the provider call only sends `product_cart`, so the
  `amountCents` our route computes is not used for Dodo. UK buyers therefore see
  £14.26 (a live FX conversion of $19) plus 20% VAT, while the pricing page
  advertises £15.
- **Tax is added on top of the advertised price** because `tax_inclusive` is
  false. For a UK buyer that means £17.11 against a £15 headline. Turning
  `price.tax_inclusive` on makes the displayed price the charged price (the
  seller then nets £12.50 of a £15 sale before Dodo's fee).
- **The merchant name shown at checkout is the legal entity** ("Ridhyansh Tech
  Infra Private Limited"), because `brand_id` points at the business rather than
  a brand. Create a CreatorOS brand and assign the four products to it so the
  checkout header matches what the visitor clicked.

The first three are product settings (dashboard → Products → edit → Pricing:
per-currency price and the Tax Inclusive Pricing toggle); the last is dashboard →
Brands. Verify any change by creating one session per address and reading
`Subtotal` / `Tax` / `Total` off the page:

```bash
curl -s -c /tmp/ck -H "content-type: application/json" \
  -d '{"email":"you@example.com","password":"…"}' https://usecreatoros.co/api/auth/login
curl -s -b /tmp/ck -H "content-type: application/json" \
  -d '{"plan":"creator"}' https://usecreatoros.co/api/billing/checkout
# open the returned url with a configured billing address and check the totals
```

Delete any throwaway account created for the audit
(`users`, `organizations`, `memberships`, `profiles` rows for that email) so it
never shows up in signup or funnel reporting.

