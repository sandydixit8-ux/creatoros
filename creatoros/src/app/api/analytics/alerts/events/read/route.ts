import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { markAlertRead, markAllAlertsRead, unreadAlertCount } from "@/lib/analytics/alerts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  const body = await readJson(req);
  const id = typeof body.id === "string" ? body.id : "";
  const changed = id ? (markAlertRead(s.org.id, id) ? 1 : 0) : markAllAlertsRead(s.org.id);
  return ok({ changed, unread: unreadAlertCount(s.org.id) });
}
