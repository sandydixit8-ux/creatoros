import type { AdminRevenue } from "@/lib/admin/engine";
import { formatMoneyBreakdown } from "@/lib/money-format";

/**
 * Platform-wide revenue reporting. Server-rendered: it reads figures the admin
 * already has and there is nothing to interact with. Amounts in different
 * currencies are shown side by side, never converted.
 */
export function RevenuePanel({ revenue, days }: { revenue: AdminRevenue; days: number }) {
  const cards = [
    { label: "Recurring (MRR)", value: formatMoneyBreakdown(revenue.mrr) },
    { label: `Revenue (${days}d)`, value: formatMoneyBreakdown(revenue.period) },
    { label: "Lifetime", value: formatMoneyBreakdown(revenue.lifeTime) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-navy-950">{c.value}</div>
          </div>
        ))}
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
