"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Plus, Trash2 } from "lucide-react";
import type { AlertRule, AlertEvent, AlertMetric, AlertComparator, AlertChannel } from "@/lib/analytics/alerts";

const METRICS: { value: AlertMetric; label: string }[] = [
  { value: "page_views", label: "Page views" },
  { value: "visitors", label: "Visitors" },
  { value: "link_clicks", label: "Link clicks" },
  { value: "leads", label: "Leads" },
  { value: "bookings", label: "Bookings" },
];

const COMPARATORS: { value: AlertComparator; label: string }[] = [
  { value: "gt", label: "is above" },
  { value: "lt", label: "is below" },
  { value: "pct_up", label: "is up by %" },
  { value: "pct_down", label: "is down by %" },
];

const CHANNELS: { value: AlertChannel; label: string }[] = [
  { value: "email", label: "Email + in-app" },
  { value: "inapp", label: "In-app only" },
];

const WINDOWS = [1, 7, 30];

export function AlertsPanel(props: {
  rules: AlertRule[];
  events: AlertEvent[];
  unread: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [metric, setMetric] = useState<AlertMetric>("page_views");
  const [comparator, setComparator] = useState<AlertComparator>("pct_up");
  const [threshold, setThreshold] = useState("20");
  const [windowDays, setWindowDays] = useState(1);
  const [channel, setChannel] = useState<AlertChannel>("email");

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(j?.error?.message || "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    const done = await send("POST", "/api/analytics/alerts", {
      name,
      metric,
      comparator,
      threshold: Number(threshold),
      windowDays,
      channel,
    });
    if (done) {
      setName("");
      setThreshold("20");
    }
  }

  const label = (m: string) => METRICS.find((x) => x.value === m)?.label ?? m;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <Bell className="h-4 w-4" /> Alerts
          {props.unread > 0 && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{props.unread} new</span>
          )}
        </h2>
        {props.unread > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => send("POST", "/api/analytics/alerts/events/read", {})}
          >
            Mark all read
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {props.canWrite && (
        <form onSubmit={addRule} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input className="input" placeholder="Alert name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="input" value={metric} onChange={(e) => setMetric(e.target.value as AlertMetric)} aria-label="Metric">
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select className="input" value={comparator} onChange={(e) => setComparator(e.target.value as AlertComparator)} aria-label="Condition">
            {COMPARATORS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input className="input w-20" type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-label="Threshold" required />
          <select className="input" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} aria-label="Window">
            {WINDOWS.map((w) => (
              <option key={w} value={w}>last {w}d</option>
            ))}
          </select>
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as AlertChannel)} aria-label="Channel">
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy || !name.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {props.rules.length === 0 && <p className="text-xs text-navy-400">No alerts yet. Add one to get notified when your traffic moves.</p>}
        {props.rules.map((rule) => (
          <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 px-3 py-2 text-sm">
            <span className="font-medium text-navy-800">{rule.name}</span>
            <span className="text-xs text-navy-500">
              {label(rule.metric)} {COMPARATORS.find((c) => c.value === rule.comparator)?.label} {rule.threshold}
              {rule.comparator.startsWith("pct") ? "%" : ""} · last {rule.windowDays}d
            </span>
            {props.canWrite && (
              <span className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  className={`text-xs font-medium disabled:opacity-50 ${rule.active ? "text-emerald-600" : "text-navy-400"}`}
                  disabled={busy}
                  onClick={() => send("PATCH", `/api/analytics/alerts/${rule.id}`, { active: !rule.active })}
                >
                  {rule.active ? "Active" : "Paused"}
                </button>
                <button
                  type="button"
                  aria-label="Delete alert"
                  className="text-navy-400 hover:text-red-600 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => send("DELETE", `/api/analytics/alerts/${rule.id}`)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {props.events.length > 0 && (
        <div className="mt-5 border-t border-navy-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Recent alerts</h3>
          <ul className="mt-2 space-y-2">
            {props.events.slice(0, 8).map((ev) => (
              <li key={ev.id} className={`rounded-xl px-3 py-2 text-xs ${ev.readAt ? "bg-navy-50 text-navy-500" : "bg-brand-50 text-navy-800"}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{ev.ruleName || label(ev.metric)}</span>
                  {ev.delivery === "failed" && <span className="text-red-600">email failed</span>}
                  {ev.delivery === "skipped" && <span className="text-amber-600">email skipped</span>}
                  {!ev.readAt && (
                    <button
                      type="button"
                      className="ml-auto text-navy-400 hover:text-navy-700 disabled:opacity-50"
                      aria-label="Mark read"
                      disabled={busy}
                      onClick={() => send("POST", "/api/analytics/alerts/events/read", { id: ev.id })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5">{ev.message}</p>
                <p className="mt-0.5 text-[10px] text-navy-400">{new Date(ev.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
