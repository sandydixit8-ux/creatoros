import crypto from "node:crypto";
import { run, row, nowIso } from "@/lib/db/db";

/**
 * Email verification links.
 *
 * Modelled on password_reset_tokens: only the SHA-256 hash of the raw token is
 * stored, each link is single-use via `used_at`, and issuing a new link retires
 * the old ones. Proving the mailbox matters because platform-admin access is an
 * email allow-list (see lib/admin/access) — without this, anyone who entered an
 * allow-listed address first would hold admin with no proof they own it.
 */

const TTL_MINUTES = 60 * 48;
const MAX_ACTIVE_PER_USER = 3;

export function hashVerifyToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Invalidates any outstanding verification links for a user. */
export function revokeVerifyTokens(userId: string): void {
  run("UPDATE email_verify_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL", nowIso(), userId);
}

/**
 * Creates a token and returns the raw value for emailing. Returns null if the
 * user is unknown so callers can avoid leaking which emails exist.
 */
export function createVerifyToken(userId: string): { token: string; expiresAt: string } | null {
  if (!row("SELECT id FROM users WHERE id = ?", userId)) return null;

  // Keep the table small: drop anything spent or expired, then trim to leave
  // room for the token about to be inserted.
  run("DELETE FROM email_verify_tokens WHERE used_at IS NOT NULL OR expires_at < ?", nowIso());
  run(
    `DELETE FROM email_verify_tokens
      WHERE id IN (
        SELECT id FROM email_verify_tokens
         WHERE user_id = ? AND used_at IS NULL
         ORDER BY created_at DESC
         LIMIT -1 OFFSET ${MAX_ACTIVE_PER_USER - 1}
      )`,
    userId
  );

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();
  run(
    "INSERT INTO email_verify_tokens (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    `evt_${crypto.randomBytes(12).toString("hex")}`,
    userId,
    hashVerifyToken(token),
    expiresAt,
    nowIso()
  );
  return { token, expiresAt };
}

export interface ValidVerify {
  userId: string;
  email: string;
}

/**
 * Resolves a raw token to its user, provided the link is unexpired, unused and
 * the account still exists. Does not consume it.
 */
export function resolveVerifyToken(token: string): ValidVerify | null {
  if (!token) return null;
  const rec = row<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM email_verify_tokens WHERE token_hash = ?",
    hashVerifyToken(token)
  );
  if (!rec || rec.used_at) return null;
  if (new Date(rec.expires_at).getTime() <= Date.now()) return null;

  const user = row<{ id: string; email: string }>("SELECT id, email FROM users WHERE id = ?", rec.user_id);
  if (!user) return null;
  return { userId: user.id, email: user.email };
}

/**
 * Consumes a token must have its user marked verified in one step. Returns null
 * if the token was already spent so a replayed link cannot re-verify, and only
 * stamps `email_verified` for a token that was valid at this instant.
 */
export function consumeVerifyToken(token: string): ValidVerify | null {
  const valid = resolveVerifyToken(token);
  if (!valid) return null;

  // Conditional update makes consumption atomic: a second concurrent request
  // finds `used_at` set and matches no row.
  const consumed = run(
    "UPDATE email_verify_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL",
    nowIso(),
    hashVerifyToken(token)
  );
  if (consumed.changes === 0) return null;

  run("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?", nowIso(), valid.userId);
  return valid;
}

export function verifyTokenTtlMinutes(): number {
  return TTL_MINUTES;
}
