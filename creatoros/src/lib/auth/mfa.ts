import { newId, nowIso, row, run } from "@/lib/db/db";
import { hashBackupCode } from "./totp";

/**
 * One-time TOTP backup codes. Stored as SHA-256 hashes like every other
 * credential; a code is spent by stamping `used_at`, so a leaked list entry
 * works at most once.
 */

/** Swap in a fresh set, retiring every previously issued code for the user. */
export function replaceBackupCodes(userId: string, codes: string[]): void {
  run("DELETE FROM mfa_backup_codes WHERE user_id = ?", userId);
  for (const code of codes) {
    run(
      "INSERT INTO mfa_backup_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
      newId("mbc"),
      userId,
      hashBackupCode(code),
      nowIso()
    );
  }
}

/** Redeem a backup code. Returns false if it is unknown or already spent. */
export function consumeBackupCode(userId: string, code: string): boolean {
  const hash = hashBackupCode(code);
  const rec = row<{ id: string }>(
    "SELECT id FROM mfa_backup_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL",
    userId,
    hash
  );
  if (!rec) return false;
  // Conditional update makes redemption atomic: a concurrent second attempt
  // matches no row because `used_at` is no longer NULL.
  const spent = run("UPDATE mfa_backup_codes SET used_at = ? WHERE id = ? AND used_at IS NULL", nowIso(), rec.id);
  return spent.changes === 1;
}

export function clearBackupCodes(userId: string): void {
  run("DELETE FROM mfa_backup_codes WHERE user_id = ?", userId);
}

export function countUnusedBackupCodes(userId: string): number {
  const r = row<{ c: number }>(
    "SELECT COUNT(*) AS c FROM mfa_backup_codes WHERE user_id = ? AND used_at IS NULL",
    userId
  );
  return r ? Number(r.c) : 0;
}
