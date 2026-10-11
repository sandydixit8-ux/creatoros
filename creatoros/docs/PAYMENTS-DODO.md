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
