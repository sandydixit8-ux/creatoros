import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { row } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { sendCampaign } from "@/lib/email/engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row<{ id: string; status: string }>(
    "SELECT id, status FROM email_campaigns WHERE id = ? AND tenant_id = ?",
    id,
    s.org.id
  );
  if (!owned) return err.notFound();
  if (owned.status === "sending") return err.conflict("Campaign is already sending");
  // A partial campaign already delivered to part of the audience. Re-running it
  // would send a second copy to those recipients, so resume is not offered yet.
  if (owned.status === "partial") {
    return err.conflict(
      "This campaign was partially delivered. Sending it again would email recipients a second time."
    );
  }

  try {
    const result = await sendCampaign(id);
    audit({ tenantId: s.org.id, userId: s.user.id, action: "email.campaign_send", resource: id });
    return ok(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "email_automation_requires_plan") return err.forbidden();
    if (msg === "campaign_not_found") return err.notFound();
    return err.server();
  }
}