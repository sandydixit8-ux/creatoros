import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { overview, resolveRange } from "@/lib/analytics/reporting";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  const range = resolveRange(req.nextUrl.searchParams.get("range"));
  return ok({ range: range.key, since: range.since, until: range.until, ...overview(s.org.id, range) });
}
