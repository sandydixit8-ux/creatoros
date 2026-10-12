import type { OverviewMetrics } from "@/lib/analytics/reporting";

export function ConversionFunnel({ current }: { current: OverviewMetrics }) {
  const steps = [
    { label: "Visited a page", value: current.visitors },
    { label: "Clicked a link", value: current.clicks },
    { label: "Left details", value: current.leads },
    { label: "Booked a call", value: current.bookings },
    { label: "Purchased", value: current.purchases },
  ];
  const top = Math.max(1, steps[0].value);

  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        const prev = i > 0 ? steps[i - 1].value : s.value;
        const stepPct = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-night-100">{s.label}</span>
              <span className="text-night-400">
                <span className="font-semibold text-white">{s.value}</span>
                {i > 0 ? <span className="ml-2 text-xs">{stepPct}% of previous</span> : null}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-night-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
