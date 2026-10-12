"use client";

import { useEffect, useState } from "react";

interface RecentEvent {
  at: string;
  type: string;
  country: string;
  device: string;
  ref: string;
}

interface Realtime {
  activeVisitors: number;
  recent: RecentEvent[];
}

const LABELS: Record<string, string> = {
  page_view: "Viewed a page",
  link_click: "Clicked a link",
  lead: "Left details",
  booking: "Booked a call",
  purchase: "Purchased",
  checkout_started: "Started checkout",
  engagement: "Engaged",
  course_started: "Started a course",
  course_completed: "Completed a course",
};

function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function RealtimePanel({ initial }: { initial: Realtime }) {
  const [data, setData] = useState<Realtime>(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/analytics/realtime", { cache: "no-store" });
        const j = await res.json();
        if (alive && j.ok) setData(j.data);
      } catch {
        // transient; keep the last snapshot
      }
    };
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
        <div>
          <div className="text-2xl font-bold text-white">{data.activeVisitors}</div>
          <div className="text-xs text-night-400">active visitors (last 5 min)</div>
        </div>
      </div>
      {data.recent.length === 0 ? (
        <div className="py-6 text-center text-sm text-night-400">No recent activity</div>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {data.recent.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-night-800/60 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-night-100">
                <span className="text-xs">{e.country ? flag(e.country) : "🌐"}</span>
                {LABELS[e.type] ?? e.type}
              </span>
              <span className="shrink-0 text-xs text-night-400">{ago(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));
}
