import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { resolveRange } from "@/lib/analytics/reporting";
import { linkPerformance, listCampaigns, listTrackedLinks } from "@/lib/analytics/links";
import { LinksManager } from "@/components/analytics/links-manager";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TrackedLinksPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  if (!can(s.role as never, "analytics:read")) redirect("/app");

  const sp = await searchParams;
  const range = resolveRange(sp.range);
  const org = s.org.id;

  const campaigns = listCampaigns(org);
  const links = listTrackedLinks(org);
  const performance = linkPerformance(org, range);
  const canWrite = can(s.role as never, "analytics:write");

  return (
    <div className="space-y-6 rounded-3xl bg-night-950 p-5 text-night-100 shadow-card sm:p-7">
      <div>
        <Link href={`/app/analytics?range=${range.key}`} className="inline-flex items-center gap-1 text-xs font-medium text-night-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to analytics
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Campaigns &amp; tracked links</h1>
        <p className="mt-1 text-sm text-night-400">
          Create short links that measure clicks and attribute traffic to a campaign. Clicks are recorded only for visitors who
          accepted analytics.
        </p>
      </div>

      {canWrite ? (
        <LinksManager campaigns={campaigns} links={links} performance={performance} shortBase={SITE_URL} />
      ) : (
        <div className="rounded-2xl border border-night-700 bg-night-900 p-5">
          <p className="text-sm text-night-400">You have read-only access. Ask an owner or editor to manage tracked links.</p>
          <ul className="mt-4 divide-y divide-night-800">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-night-100">{l.label || l.slug}</span>
                <span className="text-night-400">{performance.find((p) => p.linkId === l.id)?.clicks ?? 0} clicks</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-night-500">
        Tip: open <Link href="/app/bio" className="text-brand-300 hover:text-brand-200">your bio page</Link> and point a link block at{" "}
        {SITE_URL}/l/&lt;slug&gt; to measure clicks from your audience.
      </p>
    </div>
  );
}
