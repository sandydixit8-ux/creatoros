import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Download, Link2 } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { row } from "@/lib/db/db";
import {
  clickTable,
  countryTable,
  deviceTable,
  overview,
  realtime,
  resolveRange,
  RANGE_KEYS,
  sourceTable,
  topPages,
  trafficSeries,
  type RangeKey,
} from "@/lib/analytics/reporting";
import { lastChargeAt, revenueSnapshot } from "@/lib/analytics/money";
import { formatMoneyBreakdown, formatMoneyCents } from "@/lib/money-format";
import { KpiCards } from "@/components/analytics/kpi-cards";
import { TrafficChart } from "@/components/analytics/traffic-chart";
import { WorldMap } from "@/components/analytics/world-map";
import { CountryTable } from "@/components/analytics/country-table";
import { ClicksTable } from "@/components/analytics/clicks-table";
import { SourcePanel } from "@/components/analytics/source-panel";
import { RealtimePanel } from "@/components/analytics/realtime-panel";
import { ConversionFunnel } from "@/components/analytics/funnel";
import { AlertsPanel } from "@/components/analytics/alerts-panel";
import { AnalyticsAssistant } from "@/components/analytics/analytics-assistant";
import { listAlertEvents, listAlertRules, unreadAlertCount } from "@/lib/analytics/alerts";
import { aiConfigured } from "@/lib/ai/client";
import { checkFlag } from "@/lib/admin/engine";

export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

const card = "rounded-2xl border border-night-700 bg-night-900 p-5";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  if (!can(s.role as never, "analytics:read")) redirect("/app");

  const sp = await searchParams;
  const range = resolveRange(sp.range);
  const org = s.org.id;
  const days = RANGE_DAYS[range.key];

  const ov = overview(org, range);
  const series = trafficSeries(org, range);
  const countries = countryTable(org, range, 40);
  const clicks = clickTable(org, range, 40);
  const sources = sourceTable(org, range, "ref");
  const campaigns = sourceTable(org, range, "utm_campaign");
  const devices = deviceTable(org, range);
  const rt = realtime(org, 30);
  const pages = topPages(org, range, 8);
  const revenue = revenueSnapshot(org, days);
  const lastCharge = lastChargeAt(org);
  const pageCount = (row("SELECT COUNT(*) AS c FROM bio_pages WHERE tenant_id = ?", org) as { c: number } | undefined)?.c ?? 0;
  const assistantAvailable = aiConfigured() && checkFlag("ai_assistant");

  const alertRules = listAlertRules(org);
  const alertEvents = listAlertEvents(org, 8);
  const alertUnread = unreadAlertCount(org);
  const canWriteAnalytics = can(s.role as never, "analytics:write");

  const exportHref = (dataset: string) => `/api/analytics/export?dataset=${dataset}&range=${range.key}`;

  return (
    <div className="space-y-6 rounded-3xl bg-night-950 p-5 text-night-100 shadow-card sm:p-7">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Traffic &amp; click analytics</h1>
          <p className="mt-1 text-sm text-night-400">Visitors, clicks, countries and conversions across your pages.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-night-600 p-0.5">
            {RANGE_KEYS.map((k) => (
              <Link
                key={k}
                href={`/app/analytics?range=${k}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  k === range.key ? "bg-brand-600 text-white" : "text-night-400 hover:text-white"
                }`}
              >
                {RANGE_LABELS[k]}
              </Link>
            ))}
          </div>
          <Link
            href="/app/analytics/links"
            className="flex items-center gap-2 rounded-xl border border-night-600 px-3 py-1.5 text-sm font-medium text-night-100 hover:border-night-500"
          >
            <Link2 className="h-4 w-4" /> Links
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-night-600 px-3 py-1.5 text-sm font-medium text-night-100 hover:border-night-500">
              <Download className="h-4 w-4" /> Export
            </summary>            <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-night-600 bg-night-900 p-1.5 shadow-card">
              {[
                ["countries", "Countries"],
                ["clicks", "Link clicks"],
                ["sources", "Sources"],
                ["devices", "Devices"],
                ["pages", "Pages"],
              ].map(([d, label]) => (
                <a key={d} href={exportHref(d)} className="block rounded-lg px-3 py-1.5 text-sm text-night-100 hover:bg-night-800">
                  {label} CSV
                </a>
              ))}
            </div>
          </details>
        </div>
      </div>

      {pageCount === 0 && (
        <div className="rounded-2xl border border-brand-500/40 bg-brand-500/10 p-6">
          <h2 className="font-semibold text-white">No data to show yet</h2>
          <p className="mt-1 text-sm text-night-300">Publish a bio page first — that&apos;s where your audience lands and your analytics starts.</p>
          <Link href="/app/bio" className="btn-primary mt-4">
            Create your bio page <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <KpiCards current={ov.current} previous={ov.previous} series={series} />

      <AnalyticsAssistant range={range.key} available={assistantAvailable} />

      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Growth</h2>
          <span className="text-xs text-night-400">{RANGE_LABELS[range.key]}</span>
        </div>
        <TrafficChart data={series} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-3 font-semibold text-white">Traffic by country</h2>
          <WorldMap data={countries.map((c) => ({ country: c.country, name: c.name, visitors: c.visitors, share: c.share }))} />
        </section>
        <section className={card}>
          <h2 className="mb-3 font-semibold text-white">Realtime</h2>
          <RealtimePanel initial={rt} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 font-semibold text-white">Countries</h2>
          <CountryTable rows={countries} exportHref={exportHref("countries")} />
        </section>
        <section className={card}>
          <h2 className="mb-3 font-semibold text-white">Top links</h2>
          <ClicksTable rows={clicks} exportHref={exportHref("clicks")} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={card}>
          <h2 className="mb-4 font-semibold text-white">Conversion funnel</h2>
          <ConversionFunnel current={ov.current} />
        </section>
        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-4 font-semibold text-white">Sources &amp; devices</h2>
          <SourcePanel sources={sources} campaigns={campaigns} devices={devices} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-3 font-semibold text-white">Top pages</h2>
          {pages.length === 0 ? (
            <div className="py-6 text-center text-sm text-night-400">No page views in this range</div>
          ) : (
            <ul className="divide-y divide-night-800">
              {pages.map((p) => (
                <li key={`${p.slug}-${p.label}`} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate text-night-100">{p.label}{p.slug ? <span className="ml-2 text-night-500">/{p.slug}</span> : null}</span>
                  <span className="shrink-0 text-night-400">{p.pageViews} views · {p.clicks} clicks</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={card}>
          <h2 className="mb-3 font-semibold text-white">Revenue</h2>
          <div className="text-xs text-night-400">MRR</div>
          <div className="text-xl font-bold text-white">{revenue.mrr.length ? formatMoneyBreakdown(revenue.mrr) : formatMoneyCents(0)}</div>
          <div className="mt-3 text-xs text-night-400">This period</div>
          <div className="text-lg font-semibold text-white">
            {revenue.period.some((a) => a.cents !== 0) ? formatMoneyBreakdown(revenue.period) : "—"}
          </div>
          <div className="mt-3 text-xs text-night-400">
            {revenue.subscriptionsActive} active subscription{revenue.subscriptionsActive === 1 ? "" : "s"} ·{" "}
            {lastCharge ? `last charge ${new Date(lastCharge).toLocaleDateString()}` : "no charges yet"}
          </div>
          <div className="mt-4">
            <Link href="/app/billing" className="text-xs font-medium text-brand-300 hover:text-brand-200">
              Manage plan &amp; billing →
            </Link>
          </div>
        </section>
      </div>

      <AlertsPanel rules={alertRules} events={alertEvents} unread={alertUnread} canWrite={canWriteAnalytics} />
    </div>
  );
}
