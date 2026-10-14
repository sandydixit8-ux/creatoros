import { NextRequest } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyMfaToken } from "@/lib/auth/mfa-token";
import { verifyTotp } from "@/lib/auth/totp";
import { consumeBackupCode } from "@/lib/auth/mfa";
import { fail, ok, readJson, getClientIp } from "@/lib/http";
import { row } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(1).max(16),
});

/**
 * Second step of a 2FA login. The token issued by /api/auth/login proves the
 * password already checked out; here a TOTP code (or a one-time backup code)
 * completes the sign-in and only then is the session cookie issued.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("login-mfa", ip), 20, 5 * 60_000);
  if (!rl.allowed) return fail("Too many attempts. Try again later.", 429, "rate_limited");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter the 6-digit code from your app", 400, "validation");

  const claims = verifyMfaToken(parsed.data.mfaToken);
  if (!claims) return fail("This sign-in attempt expired. Please log in again.", 401, "mfa_expired");

  const membership = row<{ tenant_id: string }>(
    "SELECT tenant_id FROM memberships WHERE user_id = ? AND tenant_id = ?",
    claims.userId,
    claims.orgId
  );
  if (!membership) return fail("No organization found for this account", 403, "forbidden");

  const user = row<{ totp_secret: string | null; totp_enabled: number; auth_version: number }>(
    "SELECT totp_secret, totp_enabled, auth_version FROM users WHERE id = ?",
    claims.userId
  );
  if (!user || user.totp_enabled !== 1 || !user.totp_secret) {
    return fail("Two-factor authentication is not active on this account", 400, "mfa_not_active");
  }

  const codeOk = verifyTotp(user.totp_secret, parsed.data.code) || consumeBackupCode(claims.userId, parsed.data.code);
  if (!codeOk) {
    audit({ tenantId: claims.orgId, userId: claims.userId, action: "auth.login_mfa_failed", ip });
    return fail("That code is not valid", 401, "invalid_code");
  }

  audit({ tenantId: claims.orgId, userId: claims.userId, action: "auth.login", meta: { mfa: true }, ip });
  const cookie = setSessionCookie(claims.userId, claims.orgId, user.auth_version);
  return ok({ userId: claims.userId, orgId: claims.orgId }, { headers: { "Set-Cookie": cookie } });
}
