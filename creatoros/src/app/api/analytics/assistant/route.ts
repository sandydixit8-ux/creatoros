import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { row } from "@/lib/db/db";
import { aiConfigured, complete } from "@/lib/ai/client";
import { getLimits } from "@/lib/plans";
import { refundUsage, reserveUsage } from "@/lib/usage";
import { checkFlag } from "@/lib/admin/engine";
import { buildAnalyticsContext, buildAnalyticsPrompt } from "@/lib/analytics/assistant";
import { RANGE_KEYS, type RangeKey } from "@/lib/analytics/reporting";

export const dynamic = "force-dynamic";

/**
 * POST, not GET: this spends a metered AI credit and a provider call, so it must
 * not be triggerable by a prefetcher, crawler or link preview.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  if (!checkFlag("ai_assistant")) {
    return fail("The analytics assistant is unavailable right now.", 503, "ai_disabled");
  }
  if (!aiConfigured()) {
    return fail("The analytics assistant is unavailable right now.", 503, "ai_unavailable");
  }

  const body = await readJson(req);
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3) return fail("Please ask a question.", 400, "invalid_question");
  if (question.length > 500) return fail("Please keep your question under 500 characters.", 400, "question_too_long");

  const requested = typeof body.range === "string" ? body.range : "";
  const rangeKey: RangeKey = (RANGE_KEYS as string[]).includes(requested) ? (requested as RangeKey) : "30d";

  const orgPlan = row<{ plan?: string }>("SELECT plan FROM organizations WHERE id = ?", s.org.id)?.plan ?? "free";
  const limits = getLimits(orgPlan);

  const usedAfter = reserveUsage(s.org.id, "aiCredits", limits.aiCredits);
  if (usedAfter === null) {
    return fail(
      "You have used all AI credits for this month. Upgrade for more, or wait for your next billing period.",
      402,
      "ai_quota_exhausted"
    );
  }

  const context = buildAnalyticsContext(s.org.id, rangeKey);

  try {
    const res = await complete(buildAnalyticsPrompt(question, context), { temperature: 0.3, maxTokens: 400 });
    const answer = res.text.trim();
    if (!answer) throw new Error("empty response");
    return ok({ answer, range: rangeKey, creditsRemaining: remaining(orgPlan, usedAfter) });
  } catch (e) {
    console.error("[analytics.assistant] failed", (e as Error).message);
    refundUsage(s.org.id, "aiCredits");
    return fail("The assistant couldn't answer just now. Please try again.", 502, "ai_failed");
  }
}

function remaining(plan: string, used: number): number | null {
  const limit = getLimits(plan).aiCredits;
  return limit === -1 ? null : Math.max(0, limit - used);
}
