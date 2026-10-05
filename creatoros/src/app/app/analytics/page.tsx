import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarCheck, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { summary, timeSeries, breakdownBy, pageBreakdown } from "@/lib/analytics/engine";
import { revenueSnapshot, revenueMonthlySeries, lastChargeAt } from "@/lib/analytics/money";
import { row } from "@/lib/db/db";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { ViewsChart, DonutChart } from "@/components/analytics/charts";
import { SourcesExplorer } from "@/components/analytics/sources-explorer";
import { RevenueChart, RevenueBreakdown } from "@/components/analytics/revenue-chart";
import { formatMoneyBreakdown, formatMoneyCents } from "@/lib/money-format";

export const dynamic = "force-dynamic";

const DAY_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const sp = await searchParams;
  const days = clampDays(Number(sp.days) || 30);

  const rangeInfo = DAY_RANGES.find((d) => d.days === days) ?? { label: `Last ${days} days`, days };

  const summ = summary(s.org.id, days);
  const series = timeSeries(s.org.id, days);
  const refs = breakdownBy(s.org.id, "ref", days);
  const sources = breakdownBy(s.org.id, "utm_source", days);
  const devices = breakdownBy(s.org.id, "device", days);
  const countries = breakdownBy(s.org.id, "country", days);
  const pages = pageBreakdown(s.org.id, days);

  const pageCount = (row("SELECT COUNT(*) AS c FROM bio_pages WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const recentBookings = (row("SELECT COUNT(*) AS c FROM bookings WHERE tenant_id = ? AND status = 'confirmed'", s.org.id) as { c: number })?.c ?? 0;

  const revenue = revenueSnapshot(s.org.id, days);
  const revenueSeries = revenueMonthlySeries(s.org.id, 6);
  const lastCharge = lastChargeAt(s.org.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Analytics</h1>
          <p className="mt-1 text-sm text-navy-500">What&apos;s driving traffic, leads and bookings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAY_RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/app/analytics?days=${r.days}`}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                r.days === days ? "bg-brand-600 text-white" : "border border-navy-200 text-navy-700 hover:bg-navy-50"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <SummaryCards initial={summ} />

      {pageCount === 0 && (
        <div className="card border-brand-200 bg-brand-50 p-6">
          <h2 className="font-semibold text-navy-900">No data to show yet</h2>
          <p className="mt-1 text-sm text-navy-600">Publish a bio page first — that&apos;s where your audience lands and your analytics starts.</p>
          <Link href="/app/bio" className="btn-primary mt-4">
            Create your bio page <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Traffic &amp; conversions ({rangeInfo.label})</h2>
          <div className="flex items-center gap-3 text-xs text-navy-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-500" /> Views</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Leads</span>
          </div>
        </div>
        <ViewsChart data={series} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-navy-900">Traffic sources</h2>
          <DonutChart parts={refs} />
        </div>
          <SourcesExplorer sources={sources} devices={devices} countries={countries} pages={pages} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Leads captured ({rangeInfo.label})</h2>
            <UserPlus className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-navy-950">{summ.leads}</div>
          <Link href="/app/leads" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
            See all leads <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Bookings ({rangeInfo.label})</h2>
            <CalendarCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-navy-950">{summ.bookings}</div>
          <p className="mt-3 text-sm text-navy-500">{recentBookings} total confirmed</p>
        </div>
      </div>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy-900">Revenue</h2>
            <p className="mt-1 text-sm text-navy-500">Monthly recurring and one-time income.</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-navy-400">MRR</div>
              <div className="text-xl font-bold text-navy-950">
                {revenue.mrr.length ? formatMoneyBreakdown(revenue.mrr) : formatMoneyCents(0)}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-navy-900">{revenue.subscriptionsActive} active subscription{revenue.subscriptionsActive === 1 ? "" : "s"}</div>
              <div className="text-xs text-navy-400">
                {lastCharge ? `Last charge ${new Date(lastCharge).toLocaleDateString()}` : "No charges yet"}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <RevenueChart data={revenueSeries} />
          <RevenueBreakdown sources={revenue.sources} />
        </div>
      </section>
    </div>
  );
}

function clampDays(n: number): number {
  if (Number.isNaN(n)) return 30;
  return Math.min(90, Math.max(7, n));
}