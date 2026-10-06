import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Link2, Sparkles, Users } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { summary, timeSeries, breakdownBy } from "@/lib/analytics/engine";
import { revenueSnapshot } from "@/lib/analytics/money";
import { all, row } from "@/lib/db/db";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { ViewsChart, DonutChart } from "@/components/analytics/charts";
import { getProfileForUser } from "@/lib/bio/page";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const [summ, series, sources, profile] = [
    summary(s.org.id),
    timeSeries(s.org.id, 30).slice(-14),
    breakdown(s.org.id, "ref"),
    getProfileForUser(s.org.id, s.user.id),
  ];

  const revenue = revenueSnapshot(s.org.id, 30);

  const serviceCount = (row("SELECT COUNT(*) AS c FROM services WHERE tenant_id = ? AND active = 1", s.org.id) as { c: number })?.c ?? 0;
  const recentLeads = all<{ id: string; email: string; name: string; created_at: string }>(
    "SELECT id, email, name, created_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5",
    s.org.id
  );
  const recentBookings = all<{ id: string; attendee_name: string; starts_at: string }>(
    "SELECT id, attendee_name, starts_at FROM bookings WHERE tenant_id = ? AND status = 'confirmed' ORDER BY starts_at ASC LIMIT 5",
    s.org.id
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Dashboard</h1>
          <p className="mt-1 text-sm text-navy-500">Your creator business at a glance.</p>
        </div>
        <div className="flex gap-3">
          {profile?.username && (
            <Link href={`/u/${profile.username}`} target="_blank" className="btn-secondary">
              <Link2 className="h-4 w-4" /> View bio page
            </Link>
          )}
          <Link href="/app/bio" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Build bio page
          </Link>
        </div>
      </div>

      <SummaryCards initial={summ} revenue={revenue.period} />

      {!profile?.username && (
        <div className="card border-brand-200 bg-brand-50 p-6">
          <h2 className="font-semibold text-navy-900">Let&apos;s set up your public page</h2>
          <p className="mt-1 text-sm text-navy-600">Choose a username to start capturing traffic, leads and bookings.</p>
          <Link href="/app/settings" className="btn-primary mt-4">
            Set up profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Traffic over time</h2>
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
          <DonutChart parts={sources} />
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Recent leads</h2>
              <Link href="/app/leads" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</Link>
            </div>
            {recentLeads.length === 0 ? (
              <p className="py-4 text-sm text-navy-400">No leads yet. Add an email capture block to start collecting them.</p>
            ) : (
              <ul className="space-y-2">
                {recentLeads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2 text-sm">
                    <span><Users className="mr-2 inline h-3.5 w-3.5 text-brand-500" />{l.email}</span>
                    <span className="text-navy-400">{new Date(l.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Upcoming bookings</h2>
              <Link href="/app/booking" className="text-xs font-medium text-brand-600 hover:text-brand-700">Manage</Link>
            </div>
            {recentBookings.length === 0 ? (
              <p className="py-4 text-sm text-navy-400">No bookings yet. Add a booking service to your bio page.</p>
            ) : (
              <ul className="space-y-2">
                {recentBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2 text-sm">
                    <span><CalendarCheck className="mr-2 inline h-3.5 w-3.5 text-indigo-500" />{b.attendee_name}</span>
                    <span className="text-navy-400">{formatWhen(b.starts_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {serviceCount === 0 && (
              <Link href="/app/booking" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
                Create your first service →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function breakdown(tenantId: string, col: "ref" | "utm_source" | "device" | "country") {
  return breakdownBy(tenantId, col);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}