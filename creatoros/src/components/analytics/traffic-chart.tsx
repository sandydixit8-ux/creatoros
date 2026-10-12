"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrafficPoint {
  bucket: string;
  visitors: number;
  pageViews: number;
  clicks: number;
  conversions: number;
}

type Metric = "visitors" | "pageViews" | "clicks" | "conversions";

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: "visitors", label: "Visitors", color: "#8b5cf6" },
  { key: "pageViews", label: "Page views", color: "#22d3ee" },
  { key: "clicks", label: "Clicks", color: "#f59e0b" },
  { key: "conversions", label: "Conversions", color: "#10b981" },
];

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  const [metric, setMetric] = useState<Metric>("visitors");

  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-navy-400">No data in this range</div>;
  }

  const isHourly = data[0].bucket.length === 13;
  const chartData = data.map((p) => ({
    ...p,
    label: isHourly ? `${p.bucket.slice(11, 13)}:00` : p.bucket.slice(5),
  }));
  const config = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              metric === m.key ? "bg-brand-600 text-white" : "border border-night-600 text-night-400 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#202943" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#56648a", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#202943" }} minTickGap={24} />
            <YAxis tick={{ fill: "#56648a", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <Tooltip
              contentStyle={{ background: "#10172a", border: "1px solid #29344d", borderRadius: 12, color: "#e5e9f5", fontSize: 12 }}
              labelStyle={{ color: "#9aa6c4" }}
              formatter={(value) => [value as number, config.label]}
            />
            <Area type="monotone" dataKey={metric} stroke={config.color} strokeWidth={2.5} fill="url(#trafficFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
