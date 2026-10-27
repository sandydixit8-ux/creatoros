/**
 * Etsy fee maths for the public calculator at /etsy-fee-calculator.
 *
 * The rates are Etsy's published 2026 numbers, the same ones the blog posts
 * quote (see src/lib/blog.ts, "how-much-does-etsy-take-uk"). Keep the two in
 * sync: the blog's worked example is asserted in etsy-fees.test.ts, so a rate
 * change fails the test rather than silently contradicting the article.
 */

export type FeeCurrency = "gbp" | "usd";

export interface EtsyRates {
  /** Flat listing fee charged per item sold (and on every auto-renew). */
  listing: number;
  /** Etsy transaction fee, % of item + shipping + gift wrap. */
  transactionPct: number;
  /** Payment processing %, applied to the order total. */
  processingPct: number;
  /** Payment processing flat charge per order. */
  processingFixed: number;
  /** Offsite Ads commission when the sale is attributed to an ad. */
  offsiteAdsPct: number;
  /** VAT Etsy adds on top of its own fees (UK only). */
  feeVatPct: number;
  /** Typical card fee for a self-hosted store (Stripe standard pricing). */
  ownStorePct: number;
  ownStoreFixed: number;
}

export const ETSY_RATES: Record<FeeCurrency, EtsyRates> = {
  gbp: {
    listing: 0.16,
    transactionPct: 0.065,
    processingPct: 0.04,
    processingFixed: 0.2,
    offsiteAdsPct: 0.15,
    feeVatPct: 0.2,
    ownStorePct: 0.029,
    ownStoreFixed: 0.3,
  },
  usd: {
    listing: 0.2,
    transactionPct: 0.065,
    processingPct: 0.03,
    processingFixed: 0.25,
    offsiteAdsPct: 0.15,
    // Etsy does not add VAT to fees for US sellers.
    feeVatPct: 0,
    ownStorePct: 0.029,
    ownStoreFixed: 0.3,
  },
};

export interface FeeInput {
  currency: FeeCurrency;
  /** Item price, excluding shipping. */
  price: number;
  /** Shipping charged to the buyer (0 for digital downloads). */
  shipping?: number;
  /** Charge the Offsite Ads commission on this sale. */
  offsiteAds?: boolean;
  /** Add VAT on Etsy's fees (UK sellers only). */
  feeVat?: boolean;
}

export interface FeeBreakdown {
  gross: number;
  listing: number;
  transaction: number;
  processing: number;
  offsiteAds: number;
  feeVat: number;
  totalFees: number;
  net: number;
  /** Total fees as a share of the order total, e.g. 0.123 for 12.3%. */
  effectivePct: number;
  ownStoreFees: number;
  ownStoreNet: number;
  /** net - ownStoreNet: what the marketplace costs on this one sale. */
  marketplaceDelta: number;
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Clamp hostile or empty input to a sane, non-negative amount. */
function amount(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function calculateFees(input: FeeInput): FeeBreakdown {
  const rates = ETSY_RATES[input.currency] ?? ETSY_RATES.gbp;
  const item = amount(input.price);
  const shipping = amount(input.shipping);
  const gross = item + shipping;

  if (gross === 0) {
    return {
      gross: 0,
      listing: 0,
      transaction: 0,
      processing: 0,
      offsiteAds: 0,
      feeVat: 0,
      totalFees: 0,
      net: 0,
      effectivePct: 0,
      ownStoreFees: 0,
      ownStoreNet: 0,
      marketplaceDelta: 0,
    };
  }

  const listing = rates.listing;
  const transaction = gross * rates.transactionPct;
  const processing = gross * rates.processingPct + rates.processingFixed;
  const offsiteAds = input.offsiteAds ? gross * rates.offsiteAdsPct : 0;
  const beforeVat = listing + transaction + processing + offsiteAds;
  // Etsy charges VAT on its own fees, not on the item price.
  const feeVat = input.feeVat && rates.feeVatPct > 0 ? beforeVat * rates.feeVatPct : 0;
  const totalFees = beforeVat + feeVat;

  const ownStoreFees = gross * rates.ownStorePct + rates.ownStoreFixed;
  const net = gross - totalFees;

  return {
    gross: money(gross),
    listing: money(listing),
    transaction: money(transaction),
    processing: money(processing),
    offsiteAds: money(offsiteAds),
    feeVat: money(feeVat),
    totalFees: money(totalFees),
    net: money(net),
    // Derived from the rounded figure so the percentage on screen always
    // reconciles with the money on screen.
    effectivePct: money(totalFees) / gross,
    ownStoreFees: money(ownStoreFees),
    ownStoreNet: money(gross - ownStoreFees),
    marketplaceDelta: money(money(net) - money(gross - ownStoreFees)),
  };
}

/** Scale a single-sale breakdown to a monthly volume. */
export function projectMonth(breakdown: FeeBreakdown, orders: number): {
  orders: number;
  gross: number;
  fees: number;
  net: number;
  ownStoreNet: number;
  delta: number;
} {
  const n = Math.max(0, Math.min(100000, Math.floor(amount(orders))));
  return {
    orders: n,
    gross: money(breakdown.gross * n),
    fees: money(breakdown.totalFees * n),
    net: money(breakdown.net * n),
    ownStoreNet: money(breakdown.ownStoreNet * n),
    delta: money(breakdown.marketplaceDelta * n),
  };
}

export function formatMoney(value: number, currency: FeeCurrency): string {
  return new Intl.NumberFormat(currency === "gbp" ? "en-GB" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}
