import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/get-session";
import { buildOtpAuthUrl, generateTotpSecret } from "@/lib/auth/totp";
import { err, fail, ok, getClientIp } from "@/lib/http";
import { nowIso, row, run } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

/**
 * Begin TOTP setup. Stores a fresh secret but does not enable 2FA: that only
 * happens once the user proves the secret with a live code (see /enable). An
 * abandoned setup therefore leaves a secret that is never trusted.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-2fa-setup", s.user.id), 10, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited();

  const user = row<{ totp_enabled: number }>("SELECT totp_enabled FROM users WHERE id = ?", s.user.id);
  if (!user) return err.auth();
  if (user.totp_enabled === 1) return fail("Two-factor authentication is already on", 409, "already_enabled");

  const secret = generateTotpSecret();
  run("UPDATE users SET totp_secret = ?, updated_at = ? WHERE id = ?", secret, nowIso(), s.user.id);

  const otpauthUrl = buildOtpAuthUrl(secret, s.user.email);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });

  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.2fa_setup_started", ip });
  return ok({ secret, otpauthUrl, qrDataUrl });
}
