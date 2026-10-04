import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { ok, err, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { leaveOrganization } from "@/lib/account/gdpr";

/**
 * Leave the current workspace. Removes only the caller's membership — never
 * another member's data. If the caller holds no other membership, their user
 * record is removed as well (Art. 17 erasure).
 *
 * Workspace deletion is a separate, owner-only act: POST /api/account/delete.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-leave", ip), 5, 60_000);
  if (!rl.allowed) return err.rateLimited();

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "organization.leave",
    ip,
  });
  const result = leaveOrganization(s.org.id, s.user.id);

  // The old session names a workspace the user is no longer a member of, and
  // getSession rejects that. Re-point it at a workspace they still belong to so
  // leaving one team does not log them out of the product entirely.
  let headers: Record<string, string> | undefined;
  if (result.userDeleted) {
    headers = { "Set-Cookie": clearSessionCookie() };
  } else if (result.nextOrgId) {
    headers = { "Set-Cookie": setSessionCookie(s.user.id, result.nextOrgId) };
  }

  return ok(
    {
      left: true,
      removedMembership: result.removedMembership,
      accountDeleted: result.userDeleted,
      remainingWorkspaces: result.remainingOrgs,
    },
    { headers }
  );
}
