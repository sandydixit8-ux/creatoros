import { all, row, type SQLParam } from "@/lib/db/db";
import { PLAN_PRICES, type PriceCurrency } from "@/lib/plans";
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
  /** Net revenue for the window (`net`). Kept for existing callers. */
  period: MoneyAmount[];
  /** Money collected in the window, before refunds. */
  gross: MoneyAmount[];
  /** Money returned to customers in the window. Always a positive figure. */
  refunds: MoneyAmount[];
  /**
   * Money retained: collected minus refunds. This is the only figure that may be
   * labelled "revenue". `gross` and `refunds` are shown separately because a
   * refund that silently shrinks the headline number hides how much was sold.
   */
  net: MoneyAmount[];
  subscriptionsActive: number;
  sources: RevenueSource[];
}

/**
 * Per-currency MRR movement over a window.
 *
 * Every bucket is a positive magnitude in its own currency; `net` applies the
 * signs. Expansion and contraction are only defined for a plan change that keeps
 * the subscription paid — a move to `free` is churn, not contraction, even
 * though both reduce MRR.
 */
export interface MrrMovement {
  new: MoneyAmount[];
  expansion: MoneyAmount[];
  contraction: MoneyAmount[];
  churned: MoneyAmount[];
  /** new + expansion - contraction - churned, per currency. */
  net: MoneyAmount[];
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
    const price = PLAN_PRICES[sub.plan]?.[currency as PriceCurrency];
    if (typeof price !== "number") continue;
    totals.set(currency, (totals.get(currency) ?? 0) + price * 100);
  }
  return finalize(totals);
}

// Each query filters in the WHERE clause. Appending a condition to a finished
// query would land it after GROUP BY, where SQLite reads it as an extra join
// predicate on the grouping column rather than a date filter.
//
// A store sale writes BOTH an order and the payment row that settles it
// (store/orders.ts). Summing both tables therefore counted every store sale
// twice. Payments are now restricted to rows not attached to an order, and the
// order table is the single source of truth for store revenue.
const paymentsQuery = (clause = "", statuses = "('succeeded')"): string =>
  `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c
   FROM payments WHERE tenant_id = ? AND status IN ${statuses} AND COALESCE(order_id, '') = '' ${clause}
   GROUP BY currency`;
/** Net of refunds: a partially refunded order keeps status `paid`. */
const ordersQuery = (clause = ""): string =>
  `SELECT currency, COALESCE(SUM(amount_cents - COALESCE(refunded_cents, 0)), 0) AS c
   FROM orders WHERE tenant_id = ? AND status = 'paid' ${clause}
   GROUP BY currency`;
/** Everything ever collected, including orders that were later fully refunded. */
const ordersGrossQuery = (clause = ""): string =>
  `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c
   FROM orders WHERE tenant_id = ? AND status IN ('paid', 'refunded') ${clause}
   GROUP BY currency`;
/** The authoritative refund ledger. */
const refundsQuery = (clause = ""): string =>
  `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c
   FROM refunds WHERE tenant_id = ? AND status = 'succeeded' ${clause}
   GROUP BY currency`;
const bookingsQuery = (clause = ""): string =>
  `SELECT s.currency AS currency, COALESCE(SUM(s.price_cents), 0) AS c
   FROM bookings b JOIN services s ON s.id = b.service_id
   WHERE b.tenant_id = ? AND b.status = 'confirmed' ${clause}
   GROUP BY s.currency`;

export function revenueSnapshot(tenantId: string, days = 30): RevenueSnapshot {
  const since = `AND created_at >= '${new Date(Date.now() - days * 86400000).toISOString()}'`;

  const net = mergeAmounts(
    groupByCurrency(paymentsQuery(since), tenantId),
    groupByCurrency(ordersQuery(since), tenantId)
  );
  const gross = mergeAmounts(
    groupByCurrency(paymentsQuery(since, "('succeeded', 'refunded')"), tenantId),
    groupByCurrency(ordersGrossQuery(since), tenantId)
  );
  const refunds = groupByCurrency(refundsQuery(since), tenantId);
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
    period: net,
    gross,
    refunds,
    net,
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
       FROM payments WHERE tenant_id = ? AND status IN ('succeeded', 'refunded')
         AND COALESCE(order_id, '') = '' AND created_at >= ?
       GROUP BY month, currency ORDER BY month`,
      tenantId,
      since
    )
  );
  // Orders stay in the month they were sold. A later refund lands in the month
  // the money went back, which is what an accounting view should show.
  collect(
    all<MonthRow>(
      `SELECT substr(created_at, 1, 7) AS month, currency, SUM(amount_cents) AS cents
       FROM orders WHERE tenant_id = ? AND status IN ('paid', 'refunded') AND created_at >= ?
       GROUP BY month, currency ORDER BY month`,
      tenantId,
      since
    )
  );
  collect(
    all<MonthRow>(
      `SELECT substr(created_at, 1, 7) AS month, currency, -SUM(amount_cents) AS cents
       FROM refunds WHERE tenant_id = ? AND status = 'succeeded' AND created_at >= ?
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
      // Bars cannot be drawn from a negative month (more refunded than sold), so
      // the scale floor is zero while the real figure stays visible in `byCurrency`.
      scale: Math.max(0, byCurrency.reduce((s, a) => s + a.cents, 0)),
    });
  }
  return out;
}

/** Statuses that still represent a paid (or grace-paid) mandate when costing MRR. */
const MRR_PAID_STATUSES = new Set(["active", "trialing", "past_due", "on_hold"]);

function planMonthlyCents(plan: string, currency: string): number {
  if (!plan || plan === "free") return 0;
  const price = PLAN_PRICES[plan]?.[normalizeCurrency(currency) as PriceCurrency];
  return typeof price === "number" ? price * 100 : 0;
}

/**
 * New, expansion, contraction and churned MRR over a window, from the
 * `subscription_events` history that `applySubscription` appends.
 *
 * Rules, stated so the numbers can be defended:
 *  - value is the plan's list price in the mandate's own currency; no FX guess
 *  - a status that still entitles (active/trialing/past_due/on_hold) counts as
 *    paid, so a grace-period account is not reported as churn
 *  - 0 -> paid is `new`; paid -> higher paid is `expansion`; paid -> lower paid
 *    is `contraction`; paid -> 0 is `churned`
 *  - buckets are positive magnitudes; `net` applies the signs
 */
export function mrrMovement(opts: { tenantId?: string; days?: number } = {}): MrrMovement {
  const days = Math.max(1, Math.floor(opts.days ?? 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = opts.tenantId
    ? all<{ from_plan: string; to_plan: string; from_status: string; to_status: string; currency: string }>(
        `SELECT from_plan, to_plan, from_status, to_status, currency
         FROM subscription_events WHERE tenant_id = ? AND created_at >= ?`,
        opts.tenantId,
        since
      )
    : all<{ from_plan: string; to_plan: string; from_status: string; to_status: string; currency: string }>(
        `SELECT from_plan, to_plan, from_status, to_status, currency
         FROM subscription_events WHERE created_at >= ?`,
        since
      );

  const buckets = {
    new: new Map<string, number>(),
    expansion: new Map<string, number>(),
    contraction: new Map<string, number>(),
    churned: new Map<string, number>(),
  };

  for (const e of rows) {
    const currency = normalizeCurrency(e.currency);
    const before = MRR_PAID_STATUSES.has(e.from_status) ? planMonthlyCents(e.from_plan, currency) : 0;
    const after = MRR_PAID_STATUSES.has(e.to_status) ? planMonthlyCents(e.to_plan, currency) : 0;
    const delta = after - before;
    if (delta === 0) continue;

    const kind = delta > 0 ? (before === 0 ? "new" : "expansion") : after === 0 ? "churned" : "contraction";
    buckets[kind].set(currency, (buckets[kind].get(currency) ?? 0) + Math.abs(delta));
  }

  const net = new Map<string, number>();
  const signed: Array<[keyof typeof buckets, number]> = [
    ["new", 1],
    ["expansion", 1],
    ["contraction", -1],
    ["churned", -1],
  ];
  for (const [kind, sign] of signed) {
    for (const [currency, cents] of buckets[kind]) {
      net.set(currency, (net.get(currency) ?? 0) + sign * cents);
    }
  }

  return {
    new: finalize(buckets.new),
    expansion: finalize(buckets.expansion),
    contraction: finalize(buckets.contraction),
    churned: finalize(buckets.churned),
    net: finalize(net),
  };
}

export function lastChargeAt(tenantId: string): string | null {
  const r = row<{ created_at: string }>(
    "SELECT created_at FROM payments WHERE tenant_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  return r?.created_at ?? null;
}
