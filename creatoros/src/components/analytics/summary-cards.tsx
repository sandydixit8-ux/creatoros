"use client";

import { useState } from "react";
import { formatMoneyBreakdown, type MoneyAmount } from "@/lib/money-format";

interface Summary {
  visitors: number;
  pageViews: number;
  leads: number;
  bookings: number;
  conversions: number;
  conversionRate: number;
}

export function SummaryCards({ initial, revenue }: { initial: Summary; revenue: MoneyAmount[] }) {
  const [data] = useState(initial);

  const cards = [
    { label: "Visitors", value: fmt(data.visitors), accent: "text-brand-600" },
    { label: "Page views", value: fmt(data.pageViews), accent: "text-navy-600" },
    { label: "Leads", value: fmt(data.leads), accent: "text-emerald-600" },
    { label: "Bookings", value: fmt(data.bookings), accent: "text-indigo-600" },
    { label: "Conversion", value: `${data.conversionRate}%`, accent: "text-amber-600" },
    { label: "Revenue", value: revenueValue(revenue), accent: "text-navy-900" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <div className="text-xs font-medium text-navy-500">{c.label}</div>
          <div className={`mt-1 text-2xl font-bold ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * Per-currency figures, side by side.
 *
 * No conversion and no blending: an INR tenant must not see their revenue
 * labelled with a `$`. `formatMoneyBreakdown` returns "$0.00" when there is
 * nothing to show, which would assert USD for a tenant who has never earned
 * anything - a dash claims nothing about a currency we cannot know.
 */
function revenueValue(revenue: MoneyAmount[]): string {
  const hasRevenue = revenue.some((a) => Number.isFinite(a.cents) && a.cents !== 0);
  return hasRevenue ? formatMoneyBreakdown(revenue) : "—";
}