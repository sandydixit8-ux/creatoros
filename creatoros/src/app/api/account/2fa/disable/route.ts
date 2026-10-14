import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { clearBackupCodes, consumeBackupCode } from "@/lib/auth/mfa";
import { err, fail, ok, readJson, getClientIp } from "@/lib/http";
import { nowIso, row, run } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({
  password: z.string().min(1),
  code: z.string().min(1).max(16),
});

/**
 * Turn 2FA off. Requires both the account password and a current code (or a
 * backup code), so a hijacked session alone cannot silently remove the factor.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-2fa-disable", s.user.id), 10, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const user = row<{ password_hash: string; totp_secret: string | null; totp_enabled: number }>(
    "SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = ?",
    s.user.id
  );
  if (!user) return err.auth();
  if (user.totp_enabled !== 1) return fail("Two-factor authentication is not on", 409, "not_enabled");

  const passwordOk = verifyPassword(parsed.data.password, user.password_hash);
  const codeOk =
    Boolean(user.totp_secret && verifyTotp(user.totp_secret, parsed.data.code)) ||
    consumeBackupCode(s.user.id, parsed.data.code);
  if (!passwordOk || !codeOk) {
    audit({ userId: s.user.id, action: "account.2fa_disable_failed", ip });
    return fail("Password or code is incorrect", 400, "invalid_credentials");
  }

  run(
    "UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_confirmed_at = NULL, updated_at = ? WHERE id = ?",
    nowIso(),
    s.user.id
  );
  clearBackupCodes(s.user.id);

  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.2fa_disabled", ip });
  return ok({ enabled: false });
}
