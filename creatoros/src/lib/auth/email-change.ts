import crypto from "node:crypto";
import { nowIso, row, run, tx } from "@/lib/db/db";

/**
 * Dual-confirmed login-email changes.
 *
 * A change is only applied once BOTH the current and the new mailbox have
 * followed their emailed link. That stops a stolen session from silently moving
 * the login to an attacker's address (the current owner would have to approve
 * too) and stops a mistyped address from locking the owner out (the new mailbox
 * would never confirm). Both raw tokens are emailed; the database holds only
 * their SHA-256 hashes, and a request is one-shot via `used_at`.
 */

const TTL_MINUTES = 60;

export function hashChangeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface CreatedChange {
  currentToken: string;
  newToken: string;
  expiresAt: string;
}

export interface ChangeRow {
  id: string;
  user_id: string;
  current_email: string;
  new_email: string;
  current_token_hash: string;
  new_token_hash: string;
  current_confirmed_at: string | null;
  new_confirmed_at: string | null;
  expires_at: string;
  used_at: string | null;
}

/** Retires any earlier pending request so only one change is ever in flight. */
export function createEmailChange(userId: string, currentEmail: string, newEmail: string): CreatedChange {
  run("UPDATE email_change_requests SET used_at = ? WHERE user_id = ? AND used_at IS NULL", nowIso(), userId);

  const currentToken = crypto.randomBytes(32).toString("base64url");
  const newToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();
  run(
    "INSERT INTO email_change_requests (id, user_id, current_email, new_email, current_token_hash, new_token_hash, current_confirmed_at, new_confirmed_at, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)",
    `ecr_${crypto.randomBytes(12).toString("hex")}`,
    userId,
    currentEmail,
    newEmail,
    hashChangeToken(currentToken),
    hashChangeToken(newToken),
    expiresAt,
    nowIso()
  );
  return { currentToken, newToken, expiresAt };
}

export interface ChangeConfirmResult {
  applied: boolean;
  side: "current" | "new";
  newEmail: string;
  /** The side was already confirmed before this call (a repeated link click). */
  alreadyConfirmed: boolean;
}

/**
 * Redeems one side's token and, once both sides are in, moves the login email in
 * a single transaction. Returns null for an unknown, expired or already-applied
 * link so a replayed URL cannot re-run the change.
 */
export function confirmEmailChange(token: string): ChangeConfirmResult | null {
  if (!token) return null;
  const tokenHash = hashChangeToken(token);
  const rec = row<ChangeRow>(
    "SELECT * FROM email_change_requests WHERE current_token_hash = ? OR new_token_hash = ?",
    tokenHash,
    tokenHash
  );
  if (!rec || rec.used_at) return null;
  if (new Date(rec.expires_at).getTime() <= Date.now()) return null;

  const side: "current" | "new" = rec.current_token_hash === tokenHash ? "current" : "new";
  const alreadyConfirmed = side === "current" ? Boolean(rec.current_confirmed_at) : Boolean(rec.new_confirmed_at);

  if (!alreadyConfirmed) {
    run(
      side === "current"
        ? "UPDATE email_change_requests SET current_confirmed_at = ? WHERE id = ? AND current_confirmed_at IS NULL"
        : "UPDATE email_change_requests SET new_confirmed_at = ? WHERE id = ? AND new_confirmed_at IS NULL",
      nowIso(),
      rec.id
    );
  }

  const fresh = row<{ current_confirmed_at: string | null; new_confirmed_at: string | null }>(
    "SELECT current_confirmed_at, new_confirmed_at FROM email_change_requests WHERE id = ?",
    rec.id
  );
  if (!fresh?.current_confirmed_at || !fresh.new_confirmed_at) {
    return { applied: false, side, newEmail: rec.new_email, alreadyConfirmed };
  }

  // Both sides confirmed. Claim the request and move the login in one
  // transaction; the conditional `used_at` write means two concurrent clicks
  // cannot both apply it.
  const applied = tx(() => {
    const claim = run("UPDATE email_change_requests SET used_at = ? WHERE id = ? AND used_at IS NULL", nowIso(), rec.id);
    if (claim.changes !== 1) return false;
    run(
      "UPDATE users SET email = ?, email_verified = 1, auth_version = auth_version + 1, updated_at = ? WHERE id = ?",
      rec.new_email,
      nowIso(),
      rec.user_id
    );
    return true;
  });
  if (!applied) return null;

  return { applied: true, side, newEmail: rec.new_email, alreadyConfirmed };
}

export function changeTokenTtlMinutes(): number {
  return TTL_MINUTES;
}
