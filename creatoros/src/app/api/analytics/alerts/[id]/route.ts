import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { updateAlertRule, deleteAlertRule } from "@/lib/analytics/alerts";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  const body = await readJson(req);
  const result = updateAlertRule(s.org.id, id, {
    name: body.name as never,
    metric: body.metric as never,
    comparator: body.comparator as never,
    threshold: body.threshold as never,
    windowDays: body.windowDays as never,
    channel: body.channel as never,
    cooldownMinutes: body.cooldownMinutes as never,
    active: body.active as never,
  });
  if (!result.ok) return fail(result.message, result.code === "not_found" ? 404 : 400, result.code);
  return ok({ rule: result.data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  const removed = deleteAlertRule(s.org.id, id);
  if (!removed) return fail("Alert rule not found", 404, "not_found");
  return ok({ deleted: true });
}
