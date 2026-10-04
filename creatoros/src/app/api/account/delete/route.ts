import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { clearSessionCookie } from "@/lib/auth/session";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { deleteOrganization } from "@/lib/account/gdpr";

// Deleting a workspace is irreversible and cascades to every tenant table, so
// the caller must be the owner and must type the workspace slug to confirm.
// Members who only want to remove themselves should use POST /api/account/leave.
const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
  orgSlug: z.string().min(1).max(60),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  if (s.role !== "owner") {
    return err.forbidden("Only the workspace owner can delete the workspace");
  }

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-delete", ip), 3, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return err.validation({
      confirm: 'Type "DELETE" to confirm',
      orgSlug: "The workspace slug is required",
    });
  }

  if (parsed.data.orgSlug !== s.org.slug) {
    return err.validation({ orgSlug: "Workspace slug does not match" });
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "organization.delete",
    ip,
    meta: { slug: s.org.slug },
  });
  deleteOrganization(s.org.id, s.user.id);

  return ok({ deleted: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
