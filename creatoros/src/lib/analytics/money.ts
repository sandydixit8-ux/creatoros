import { all, row, type SQLParam } from "@/lib/db/db";
import { PLAN_PRICES } from "@/lib/plans";
import { normalizeCurrency, type MoneyAmount } from "@/lib/money-format";

export type { MoneyAmount };

export interface RevenueSource {
  label: string;
  count: number;
  byCurrency: MoneyAmount[];
}

export interface RevenueSnapshot {
  /** Monthly recurring revenue, split by currency. Never a single blended figure. */
  mrr: MoneyAmount[];
  lifeTime: MoneyAmount[];
  period: MoneyAmount[];
  subscriptionsActive: number;
  sources: RevenueSource[];
}

export interface RevenueMonthPoint {
  month: string;
  byCurrency: MoneyAmount[];
  /**
   * Sum across currencies, used only to scale bar height. It is NOT a real
   * amount and must never be formatted or labelled as one.
   */
  scale: number;
}

function finalize(totals: Map<string, number>): MoneyAmount[] {
  return [...totals.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([currency, cents]) => ({ currency, cents }))
    .sort((a, b) => b.cents - a.cents || a.currency.localeCompare(b.currency));
}

export function mergeAmounts(...groups: MoneyAmount[][]): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const g of groups) {
    for (const a of g) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.cents);
  }
  return finalize(totals);
}

/** Groups a currency-column query result into per-currency buckets. */
function groupByCurrency(sql: string, ...params: SQLParam[]): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const r of all<{ currency: string; c: number | string }>(sql, ...params)) {
    const currency = normalizeCurrency(r.currency);
    totals.set(currency, (totals.get(currency) ?? 0) + Number(r.c ?? 0));
  }
  return finalize(totals);
}

/**
 * Recurring revenue from active paid subscriptions (MRR), split by the currency
 * each mandate was actually created in.
 *
 * A plan with no list price in a subscription's own currency is skipped rather
 * than costed at the other currency's price. That cross-currency guess is what
 * let rupee-backed mandates report as dollars.
 */
export function mrrByCurrency(tenantId: string): MoneyAmount[] {
  const active = all<{ plan: string; currency: string }>(
    "SELECT plan, currency FROM subscriptions WHERE tenant_id = ? AND status = 'active' AND plan != 'free'",
    tenantId
  );
  const totals = new Map<string, number>();
  for (const sub of active) {
    const currency = normalizeCurrency(sub.currency);
    const price = PLAN_PRICES[sub.plan]?.[currency as "usd" | "inr"];
    if (typeof price !== "number") continue;
    totals.set(currency, (totals.get(currency) ?? 0) + price * 100);
  }
  return finalize(totals);
}

// Each query filters in the WHERE clause. Appending a condition to a finished
// query would land it after GROUP BY, where SQLite reads it as an extra join
// predicate on the grouping column rather than a date filter.
const paymentsQuery = (clause = ""): string =>
  `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c
   FROM payments WHERE tenant_id = ? AND status = 'succeeded' ${clause}
   GROUP BY currency`;
const ordersQuery = (clause = ""): string =>
  `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c
   FROM orders WHERE tenant_id = ? AND status = 'paid' ${clause}
   GROUP BY currency`;
const bookingsQuery = (clause = ""): string =>
  `SELECT s.currency AS currency, COALESCE(SUM(s.price_cents), 0) AS c
   FROM bookings b JOIN services s ON s.id = b.service_id
   WHERE b.tenant_id = ? AND b.status = 'confirmed' ${clause}
   GROUP BY s.currency`;

export function revenueSnapshot(tenantId: string, days = 30): RevenueSnapshot {
  const since = `AND created_at >= '${new Date(Date.now() - days * 86400000).toISOString()}'`;

  const period = mergeAmounts(
    groupByCurrency(paymentsQuery(since), tenantId),
    groupByCurrency(ordersQuery(since), tenantId)
  );
  const lifeTime = mergeAmounts(
    groupByCurrency(paymentsQuery(), tenantId),
    groupByCurrency(ordersQuery(), tenantId)
  );
  const subscriptionsActive = Number(
    all<{ c: number | string }>(
      "SELECT COUNT(*) AS c FROM subscriptions WHERE tenant_id = ? AND status = 'active' AND plan != 'free'",
      tenantId
    )[0]?.c ?? 0
  );
  const ordersPaid = Number(
    all<{ c: number | string }>(
      "SELECT COUNT(*) AS c FROM orders WHERE tenant_id = ? AND status = 'paid'",
      tenantId
    )[0]?.c ?? 0
  );
  const bookingsConfirmed = Number(
    all<{ c: number | string }>(
      "SELECT COUNT(*) AS c FROM bookings WHERE tenant_id = ? AND status = 'confirmed'",
      tenantId
    )[0]?.c ?? 0
  );

  return {
    mrr: mrrByCurrency(tenantId),
    lifeTime,
    period,
    subscriptionsActive,
    sources: [
      { label: "Recurring (subscriptions)", count: subscriptionsActive, byCurrency: mrrByCurrency(tenantId) },
    { label: "One-time (orders)", count: ordersPaid, byCurrency: groupByCurrency(ordersQuery(), tenantId) },
    { label: "Bookings", count: bookingsConfirmed, byCurrency: groupByCurrency(bookingsQuery(), tenantId) },
    ],
  };
}

export function revenueMonthlySeries(tenantId: string, months = 6): RevenueMonthPoint[] {
  const since = new Date(Date.now() - months * 31 * 86400000).toISOString();
  type MonthRow = { month: string; currency: string; cents: number | string };
  const buckets = new Map<string, Map<string, number>>();

  const collect = (rows: MonthRow[]): void => {
    for (const r of rows) {
      const month = new Map(buckets.get(r.month) ?? []);
      const currency = normalizeCurrency(r.currency);
      month.set(currency, (month.get(currency) ?? 0) + Number(r.cents ?? 0));
      buckets.set(r.month, month);
    }
  };

  collect(
    all<MonthRow>(
      `SELECT substr(created_at, 1, 7) AS month, currency, SUM(amount_cents) AS cents
       FROM payments WHERE tenant_id = ? AND status = 'succeeded' AND created_at >= ?
       GROUP BY month, currency ORDER BY month`,
      tenantId,
      since
    )
  );
  collect(
    all<MonthRow>(
      `SELECT substr(created_at, 1, 7) AS month, currency, SUM(amount_cents) AS cents
       FROM orders WHERE tenant_id = ? AND status = 'paid' AND created_at >= ?
       GROUP BY month, currency ORDER BY month`,
      tenantId,
      since
    )
  );

  const now = new Date();
  const out: RevenueMonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const byCurrency = finalize(buckets.get(key) ?? new Map());
    out.push({
      month: key,
      byCurrency,
      scale: byCurrency.reduce((s, a) => s + a.cents, 0),
    });
  }
  return out;
}

export function lastChargeAt(tenantId: string): string | null {
  const r = row<{ created_at: string }>(
    "SELECT created_at FROM payments WHERE tenant_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  return r?.created_at ?? null;
}
