import { NextRequest } from "next/server";
import { z } from "zod";
import { run, nowIso } from "@/lib/db/db";
import { ok, fail, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { consumeResetToken } from "@/lib/auth/password-reset";
import { audit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(10).max(200),
});

/**
 * Completes a password reset.
 *
 * The token is single-use: it is consumed before the new hash is written, so a
 * link that leaks after use (shared mail, browser history) cannot reset again.
 * Existing sessions for the account are dropped so any stolen cookie is
 * invalidated at the same time.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("reset-password", ip), 10, 15 * 60_000);
  if (!rl.allowed) return fail("Too many attempts. Try again later.", 429, "rate_limited");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid reset link or password too short", 400, "validation");

  const { token, password } = parsed.data;

  const claimed = consumeResetToken(token);
  if (!claimed) return fail("This reset link is invalid or has expired", 400, "invalid_token");

  // Bumping auth_version invalidates every cookie already issued for this
  // account: each carries the version it was signed with, and getSession now
  // refuses anything below the current value. This is the real revocation —
  // the old DELETE FROM sessions touched a table no session ever used.
  run(
    "UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = ? WHERE id = ?",
    hashPassword(password),
    nowIso(),
    claimed.userId
  );

  audit({ userId: claimed.userId, action: "auth.password_reset_completed", meta: { email: claimed.email, sessionsRevoked: "auth_version" }, ip });

  return ok({ reset: true });
}
