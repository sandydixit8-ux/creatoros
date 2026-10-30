import type { AdminRevenue } from "@/lib/admin/engine";
import { formatMoneyBreakdown } from "@/lib/money-format";

function amount(rows: { currency: string; cents: number }[]): string {
  return rows.length ? formatMoneyBreakdown(rows) : "—";
}

/**
 * Platform-wide revenue reporting. Server-rendered: it reads figures the admin
 * already has and there is nothing to interact with. Amounts in different
 * currencies are shown side by side, never converted.
 *
 * Gross, refunds and net are deliberately separate. A single "revenue" figure
 * that quietly absorbs refunds hides both how much was sold and how much came
 * back; these are different questions with different answers.
 */
export function RevenuePanel({ revenue, days }: { revenue: AdminRevenue; days: number }) {
  const cards = [
    { label: "Recurring (MRR)", value: amount(revenue.mrr) },
    { label: `Gross (${days}d)`, value: amount(revenue.gross) },
    { label: `Refunds (${days}d)`, value: amount(revenue.refunds) },
    { label: `Net (${days}d)`, value: amount(revenue.net) },
    { label: "Lifetime (net)", value: amount(revenue.lifeTime) },
  ];

  const movement = [
    { label: "New MRR", value: amount(revenue.movement.new) },
    { label: "Expansion", value: amount(revenue.movement.expansion) },
    { label: "Contraction", value: amount(revenue.movement.contraction) },
    { label: "Churned", value: amount(revenue.movement.churned) },
    { label: "Net movement", value: amount(revenue.movement.net) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-navy-950">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-navy-400">
          MRR movement ({days}d)
        </div>
        <dl className="mt-2 grid gap-2 sm:grid-cols-5">
          {movement.map((m) => (
            <div key={m.label}>
              <dt className="text-xs text-navy-400">{m.label}</dt>
              <dd className="text-sm font-semibold text-navy-950">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-navy-400">Active paid subscriptions</div>
          <div className="mt-1 text-2xl font-bold text-navy-950">{revenue.activeSubscriptions}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-navy-400">Paid orders</div>
          <div className="mt-1 text-2xl font-bold text-navy-950">{revenue.paidOrders}</div>
        </div>
      </div>
    </div>
  );
}
