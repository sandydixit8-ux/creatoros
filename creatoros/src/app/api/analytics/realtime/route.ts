import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { realtime } from "@/lib/analytics/reporting";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  return ok(realtime(s.org.id, 30));
}
