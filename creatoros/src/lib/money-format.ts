export interface MoneyAmount {
  currency: string;
  cents: number;
}

/** Currencies the product can actually bill in. Keeps Intl from throwing. */
const SUPPORTED = new Set(["usd", "inr"]);

export function normalizeCurrency(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return SUPPORTED.has(raw) ? raw : "usd";
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  const key = SUPPORTED.has(currency) ? currency : "usd";
  const cached = FORMATTERS.get(key);
  if (cached) return cached;
  const built = new Intl.NumberFormat(key === "inr" ? "en-IN" : "en-US", {
    style: "currency",
    currency: key.toUpperCase(),
    currencyDisplay: key === "inr" ? "narrowSymbol" : "symbol",
    maximumFractionDigits: 2,
  });
  FORMATTERS.set(key, built);
  return built;
}

/** Formats an amount in the one currency it is denominated in. */
export function formatMoneyCents(cents: number, currency = "usd"): string {
  return formatter(normalizeCurrency(currency)).format(cents / 100);
}

/**
 * Renders a multi-currency total as separate figures.
 *
 * This deliberately does NOT convert between currencies. An earlier version
 * multiplied every amount by a hardcoded `RATE = 84` to print a rupee
 * equivalent next to the dollar figure, which produced a confident, entirely
 * fictional number. Amounts in different currencies cannot be added or
 * converted without a rate, a timestamp and a rounding policy, so they are
 * reported side by side instead.
 */
export function formatMoneyBreakdown(amounts: MoneyAmount[]): string {
  const shown = amounts.filter((a) => Number.isFinite(a.cents) && a.cents !== 0);
  if (shown.length === 0) return formatMoneyCents(0, "usd");
  return shown.map((a) => formatMoneyCents(a.cents, a.currency)).join(" · ");
}
