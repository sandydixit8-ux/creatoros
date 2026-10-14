import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { generateBackupCodes, verifyTotp } from "@/lib/auth/totp";
import { replaceBackupCodes } from "@/lib/auth/mfa";
import { err, fail, ok, readJson, getClientIp } from "@/lib/http";
import { nowIso, row, run, tx } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({ code: z.string().min(1).max(16) });

/**
 * Turn on 2FA after a correct code from the app. On success a fresh set of
 * one-time backup codes is issued and returned once, in the clear, to be stored
 * by the user — the server keeps only their hashes.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-2fa-enable", s.user.id), 10, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const user = row<{ totp_secret: string | null; totp_enabled: number }>(
    "SELECT totp_secret, totp_enabled FROM users WHERE id = ?",
    s.user.id
  );
  if (!user || !user.totp_secret) return fail("Start the two-factor setup again", 400, "no_pending_setup");
  if (user.totp_enabled === 1) return fail("Two-factor authentication is already on", 409, "already_enabled");
  if (!verifyTotp(user.totp_secret, parsed.data.code)) {
    audit({ userId: s.user.id, action: "account.2fa_enable_failed", ip });
    return fail("That code is not valid. Check your app and try again", 400, "invalid_code");
  }

  const backupCodes = generateBackupCodes(10);
  tx(() => {
    run("UPDATE users SET totp_enabled = 1, totp_confirmed_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), s.user.id);
    replaceBackupCodes(s.user.id, backupCodes);
  });

  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.2fa_enabled", ip });
  return ok({ enabled: true, backupCodes });
}
