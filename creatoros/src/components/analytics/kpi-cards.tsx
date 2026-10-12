import type { OverviewMetrics } from "@/lib/analytics/reporting";
import type { TrafficPoint } from "@/components/analytics/traffic-chart";

interface Card {
  label: string;
  value: string;
  current: number;
  previous: number;
  series?: number[];
  accent: string;
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function pct(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

function engagement(ms: number): string {
  if (!ms) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function delta(cur: number, prev: number): { text: string; tone: "up" | "down" | "flat" } {
  if (prev <= 0 && cur <= 0) return { text: "0%", tone: "flat" };
  if (prev <= 0) return { text: "new", tone: "up" };
  const change = ((cur - prev) / prev) * 100;
  if (Math.abs(change) < 0.05) return { text: "0%", tone: "flat" };
  return { text: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`, tone: change > 0 ? "up" : "down" };
}

function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 32;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCards({ current, previous, series }: { current: OverviewMetrics; previous: OverviewMetrics; series: TrafficPoint[] }) {
  const cards: Card[] = [
    { label: "Visitors", value: compact(current.visitors), current: current.visitors, previous: previous.visitors, series: series.map((p) => p.visitors), accent: "#8b5cf6" },
    { label: "Page views", value: compact(current.pageViews), current: current.pageViews, previous: previous.pageViews, series: series.map((p) => p.pageViews), accent: "#22d3ee" },
    { label: "Link clicks", value: compact(current.clicks), current: current.clicks, previous: previous.clicks, series: series.map((p) => p.clicks), accent: "#f59e0b" },
    { label: "Click-through rate", value: pct(current.ctr), current: current.ctr, previous: previous.ctr, accent: "#eab308" },
    { label: "Conversions", value: compact(current.conversions), current: current.conversions, previous: previous.conversions, series: series.map((p) => p.conversions), accent: "#10b981" },
    { label: "Conversion rate", value: pct(current.conversionRate), current: current.conversionRate, previous: previous.conversionRate, accent: "#34d399" },
    { label: "Avg. engagement", value: engagement(current.avgEngagementMs), current: current.avgEngagementMs, previous: previous.avgEngagementMs, accent: "#a78bfa" },
    { label: "Bounce rate", value: pct(current.bounceRate), current: current.bounceRate, previous: previous.bounceRate, accent: "#f472b6" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const d = delta(c.current, c.previous);
        const tone = d.tone === "up" ? "text-emerald-400" : d.tone === "down" ? "text-rose-400" : "text-night-400";
        // Bounce rate going up is not "good"; colour stays neutral-agnostic and
        // the arrow only communicates direction.
        return (
          <div key={c.label} className="rounded-2xl border border-night-700 bg-night-900 p-4">
            <div className="text-xs font-medium text-night-400">{c.label}</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-white">{c.value}</span>
              <span className={`text-xs font-semibold ${tone}`}>
                {d.tone === "up" ? "▲" : d.tone === "down" ? "▼" : "•"} {d.text}
              </span>
            </div>
            <div className="mt-2">{c.series ? <Sparkline values={c.series} accent={c.accent} /> : <div className="h-8" />}</div>
          </div>
        );
      })}
    </div>
  );
}
