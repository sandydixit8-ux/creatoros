import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { summary, timeSeries, breakdownBy } from "@/lib/analytics/engine";
import { all, row } from "@/lib/db/db";
import { aiConfigured, complete, extractJson } from "@/lib/ai/client";
import { getUsage, hasQuota } from "@/lib/usage";
import { getLimits } from "@/lib/plans";
import { bumpUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

/**
 * POST, not GET.
 *
 * This route spends money: one metered AI credit plus a paid provider call. A
 * GET is defined as safe and idempotent, so prefetchers, crawlers and browser
 * reloads could each trigger a billed call. The panel was the only caller.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  if (!aiConfigured()) {
    // 503, not 200. Returning success with `configured: false` meant monitoring
    // could not tell a working feature from a dead one, and a health check that
    // only looked for 200 would pass while the feature never worked.
    return fail("AI Coach is not available right now. Please try again later.", 503, "ai_unavailable");
  }

  const orgPlan = (row<{ plan?: string }>("SELECT plan FROM organizations WHERE id = ?", s.org.id))?.plan ?? "free";
  const limits = getLimits(orgPlan);
  const used = getUsage(s.org.id, "aiCredits");

  // Quota is checked and consumed BEFORE the provider call (D-7). The previous
  // order checked after, so an over-quota tenant still received a full paid
  // analysis and only the counter stopped incrementing - the meter recorded
  // nothing while the spend continued.
  if (!hasQuota(used, limits.aiCredits)) {
    return fail(
      "You have used all AI Coach credits for this month. Upgrade for more, or wait for your next billing period.",
      402,
      "ai_quota_exhausted"
    );
  }

  const days = clamp(parseInt(req.nextUrl.searchParams.get("days") || "30", 10));
  const summ = summary(s.org.id, days);
  const series = timeSeries(s.org.id, days).slice(-days);
  const refs = breakdownBy(s.org.id, "ref", days);
  const sources = breakdownBy(s.org.id, "utm_source", days);

  const serviceStats = all<{ name: string; bookings: number }>(
    `SELECT svc.name, COUNT(b.id) AS bookings
     FROM services svc LEFT JOIN bookings b
       ON b.service_id = svc.id AND b.tenant_id = svc.tenant_id AND b.status = 'confirmed' AND b.created_at >= ?
     WHERE svc.tenant_id = ?
     GROUP BY svc.id ORDER BY bookings DESC`,
    new Date(Date.now() - days * 86400000).toISOString(),
    s.org.id
  );

  const recentLeads = all<{ email: string; captured_at: string }>(
    "SELECT email, created_at AS captured_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5",
    s.org.id
  );

  const context = {
    summary: summ,
    days,
    recentViews: series.slice(-7).map((p) => ({ day: p.date, views: p.views, leads: p.leads })),
    topRefs: refs.slice(0, 5),
    topSources: sources.slice(0, 5),
    serviceStats,
    recentLeads,
  };

  const system = `You are the AI growth coach inside CreatorOS, a creator monetization operating system.
Analyze the creator's real data below and return STRICT JSON with exactly this shape:
{
  "score": 0-100 (overall growth score),
  "summary": "2-3 sentence overall assessment",
  "wins": ["2-4 things working well, specific to their data"],
  "opportunities": ["2-4 specific growth opportunities"],
  "quickWins": ["2-3 low-effort actions they can do today"],
  "nextTarget": "one headline metric to focus on next 30 days"
}
Be concrete and reference actual numbers. No markdown, pure JSON.`;

  try {
    const res = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(context) },
      ],
      { temperature: 0.4, maxTokens: 900 }
    );

    const parsed = extractJson(res.text) as unknown;

    // Consume the credit only once a usable answer exists, so a provider outage
    // does not silently spend a metered credit the tenant never received value
    // from. Combined with the pre-check above this keeps both halves honest.
    bumpUsage(s.org.id, "aiCredits");

    return ok({ insights: parsed, creditsRemaining: remaining(orgPlan, used + 1) });
  } catch (e) {
    // Never forward a provider error verbatim: the prompt carries the tenant's
    // recent leads and their email addresses.
    console.error("[coach] analysis failed", (e as Error).message);
    return fail("We couldn't complete your analysis just now. Please try again.", 502, "ai_failed");
  }
}

function remaining(plan: string, used: number): number | null {
  const limit = getLimits(plan).aiCredits;
  return limit === -1 ? null : Math.max(0, limit - used);
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 30;
  return Math.min(90, Math.max(7, n));
}
