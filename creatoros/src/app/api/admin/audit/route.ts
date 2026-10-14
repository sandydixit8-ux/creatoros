import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { listAudit } from "@/lib/admin/engine";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();

  const action = req.nextUrl.searchParams.get("action")?.trim() || undefined;
  const tenantId = req.nextUrl.searchParams.get("tenantId")?.trim() || undefined;
  return ok({ entries: listAudit({ action, tenantId, limit: 200 }) });
}
