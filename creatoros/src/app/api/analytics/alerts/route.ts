import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { listAlertRules, listAlertEvents, unreadAlertCount, createAlertRule } from "@/lib/analytics/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();
  return ok({
    rules: listAlertRules(s.org.id),
    events: listAlertEvents(s.org.id),
    unread: unreadAlertCount(s.org.id),
  });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const body = await readJson(req);
  const result = createAlertRule(s.org.id, {
    name: String(body.name ?? ""),
    metric: body.metric as never,
    comparator: body.comparator as never,
    threshold: Number(body.threshold ?? 0),
    windowDays: body.windowDays as never,
    channel: body.channel as never,
    cooldownMinutes: body.cooldownMinutes as never,
    active: body.active as never,
  });
  if (!result.ok) return fail(result.message, 400, result.code);
  return ok({ rule: result.data });
}
