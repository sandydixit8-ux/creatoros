import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { issueMfaToken } from "@/lib/auth/mfa-token";
import { ok, fail, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { row } from "@/lib/db/db";
import { audit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("login", ip), 15);
  if (!rl.allowed) return fail("Too many attempts. Try again later.", 429, "rate_limited");

  const body = await readJson(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid login data", 400, "validation");

  const { email, password } = parsed.data;
  const user = row<{ id: string; email: string; password_hash: string; name: string; auth_version: number; totp_enabled: number }>(
    "SELECT id, email, password_hash, name, auth_version, totp_enabled FROM users WHERE email = ?",
    email.toLowerCase()
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    audit({ action: "auth.login_failed", meta: { email }, ip });
    return fail("Invalid email or password", 401, "invalid_credentials");
  }

  const membership = row<{ tenant_id: string }>(
    "SELECT tenant_id FROM memberships WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
    user.id
  );
  if (!membership) return fail("No organization found for this account", 403, "forbidden");

  // Password was right, but when 2FA is on that is only the first factor. Hand
  // back a short-lived token instead of a session; the cookie is only issued
  // once the second factor checks out (POST /api/auth/login/mfa).
  if (user.totp_enabled === 1) {
    audit({ tenantId: membership.tenant_id, userId: user.id, action: "auth.login_mfa_required", ip });
    return ok({ mfaRequired: true, mfaToken: issueMfaToken({ userId: user.id, orgId: membership.tenant_id }) });
  }

  audit({ tenantId: membership.tenant_id, userId: user.id, action: "auth.login", meta: { email }, ip });

  const cookie = setSessionCookie(user.id, membership.tenant_id, user.auth_version);
  return ok({ userId: user.id, orgId: membership.tenant_id }, { headers: { "Set-Cookie": cookie } });
}