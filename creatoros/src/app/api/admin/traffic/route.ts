import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { siteTrafficSummary } from "@/lib/site/traffic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();

  const raw = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 365) : 30;

  return ok({ traffic: siteTrafficSummary(days) });
}
