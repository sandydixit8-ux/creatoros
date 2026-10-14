import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { err, fail, ok, readJson, getClientIp } from "@/lib/http";
import { nowIso, row, run } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

/**
 * Change the password from inside an authenticated session. Requires the current
 * password so a hijacked cookie cannot rotate the credential, and refuses to
 * reuse the existing one. Bumping auth_version retires every other session; the
 * caller's own cookie is re-issued so they are not logged out of the device they
 * are using.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-password", s.user.id), 10, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const { currentPassword, newPassword } = parsed.data;

  const user = row<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", s.user.id);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    audit({ userId: s.user.id, action: "account.password_change_failed", ip });
    return fail("Your current password is incorrect", 400, "invalid_password");
  }
  if (verifyPassword(newPassword, user.password_hash)) {
    return fail("Choose a password you have not used before", 400, "reused_password");
  }

  const nextVersion = s.user.authVersion + 1;
  run(
    "UPDATE users SET password_hash = ?, auth_version = ?, updated_at = ? WHERE id = ?",
    hashPassword(newPassword),
    nextVersion,
    nowIso(),
    s.user.id
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.password_changed", ip });

  const cookie = setSessionCookie(s.user.id, s.org.id, nextVersion);
  return ok({ changed: true }, { headers: { "Set-Cookie": cookie } });
}
