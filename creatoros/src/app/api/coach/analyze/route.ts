import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { summary, timeSeries, breakdownBy } from "@/lib/analytics/engine";
import { revenueSnapshot } from "@/lib/analytics/money";
import { all, row } from "@/lib/db/db";
import { aiConfigured, complete, extractJson } from "@/lib/ai/client";
import { getLimits } from "@/lib/plans";
import { refundUsage, reserveUsage } from "@/lib/usage";
import { checkFlag } from "@/lib/admin/engine";

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

  // The kill switch. The admin panel already exposes an `ai_coach` toggle
  // (components/admin/flags-panel.tsx), but nothing read it, so flipping it did
  // nothing: turning a paid provider off meant a full redeploy. Checked before
  // the key so that disabling the feature works even while a key is configured.
  if (!checkFlag("ai_coach")) {
    return fail("AI Coach is not available right now. Please try again later.", 503, "ai_disabled");
  }

  if (!aiConfigured()) {
    // 503, not 200. Returning success with `configured: false` meant monitoring
    // could not tell a working feature from a dead one, and a health check that
    // only looked for 200 would pass while the feature never worked.
    return fail("AI Coach is not available right now. Please try again later.", 503, "ai_unavailable");
  }

  const orgPlan = (row<{ plan?: string }>("SELECT plan FROM organizations WHERE id = ?", s.org.id))?.plan ?? "free";
  const limits = getLimits(orgPlan);

  // Reserve the credit before the paid call, atomically, and refund it if the
  // call fails. See reserveUsage() for why the read-then-bump sequence was not
  // enough (D-7: two concurrent requests could both pass the check and both be
  // served while only one credit was recorded).
  const usedAfter = reserveUsage(s.org.id, "aiCredits", limits.aiCredits);
  if (usedAfter === null) {
    return fail(
      "You have used all AI Coach credits for this month. Upgrade for more, or wait for your next billing period.",
      402,
      "ai_quota_exhausted"
    );
  }

  const days = clamp(parseInt(req.nextUrl.searchParams.get("days") || "30", 10));
  const revenue = revenueSnapshot(s.org.id, days);
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

  // Lead *timing*, never lead *identity*.
  //
  // This used to send the five most recent contacts' email addresses to a
  // third-party model. The coach has no use for an address - it reasons about
  // momentum, so all it needs is when leads arrived - but the addresses are
  // customer PII, and sending them put tenant customer data in the provider's
  // request logs for nothing. Dropping the email also means no personal data
  // crosses the boundary at all, which keeps the privacy disclosure simple.
  const leadRecency = all<{ captured_at: string }>(
    "SELECT created_at AS captured_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5",
    s.org.id
  );

  const context = {
    // `summ` no longer carries a blended revenue figure; revenue arrives
    // separately and split by currency.
    traffic: summ,
    revenue: revenue.period,
    days,
    recentViews: series.slice(-7).map((p) => ({ day: p.date, views: p.views, leads: p.leads })),
    topRefs: refs.slice(0, 5),
    topSources: sources.slice(0, 5),
    serviceStats,
    leadRecency,
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
Be concrete and reference actual numbers. No markdown, pure JSON.

Money rules, and follow them exactly:
- Amounts are integer minor units grouped by currency, e.g. {"currency":"usd","cents":12500} means $125.00 and {"currency":"inr","cents":74900} means Rs 749.00.
- NEVER add, convert or compare amounts in different currencies. Do not invent an exchange rate. Do not describe a total as a single figure if more than one currency is present - report each currency separately.
- If revenue is an empty list, the creator has earned nothing in this period. Say so plainly rather than estimating.`;

  try {
    const res = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(context) },
      ],
      { temperature: 0.4, maxTokens: 900 }
    );

    const parsed = extractJson(res.text) as unknown;

    return ok({
      insights: parsed,
      // From the reservation itself, not from a stale pre-call read. `used + 1`
      // reported the wrong number whenever anything else consumed a credit
      // between the two statements.
      creditsRemaining: remaining(orgPlan, usedAfter),
    });
  } catch (e) {
    // Never forward a provider error verbatim: the prompt carries the tenant's
    // own business data.
    console.error("[coach] analysis failed", (e as Error).message);
    // The credit was taken before the call, so give it back. A provider outage
    // must not quietly spend a metered unit the tenant never got value from.
    refundUsage(s.org.id, "aiCredits");
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
