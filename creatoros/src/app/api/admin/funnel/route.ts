import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { funnelSummary } from "@/lib/funnel";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();

  const raw = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 365) : 30;

  return ok({ funnel: funnelSummary(days) });
}