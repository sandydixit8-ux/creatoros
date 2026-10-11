/**
 * Shared currency-preference primitives for the per-visitor currency picker.
 *
 * The preference is a `cc` cookie written by the browser: the billing page and
 * the plan checkout route both read it, so what a visitor sees priced today is
 * exactly what they get charged. GBP/EUR are accepted in the cookie/labels but
 * only become selectable once a plan price exists for them (see
 * `planCurrencies()` in `src/lib/payments`).
 */
export const CURRENCY_COOKIE = "cc";

export const CURRENCY_LABELS: Record<string, string> = {
  inr: "INR (₹)",
  usd: "USD ($)",
  gbp: "GBP (£)",
  eur: "EUR (€)",
};

export function setCurrencyCookie(currency: string): void {
  document.cookie = `${CURRENCY_COOKIE}=${encodeURIComponent(currency)}; path=/; max-age=31536000; samesite=lax`;
}