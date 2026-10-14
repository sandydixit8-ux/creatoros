import crypto from "node:crypto";

/**
 * RFC 6238 TOTP plus one-time backup codes, built on node:crypto so account
 * 2FA needs no third-party dependency. Only the secret is ever stored; the
 * current code is derived on demand, so nothing time-sensitive is persisted.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD_SECONDS = 30;
const STEP_MS = PERIOD_SECONDS * 1000;

/** A 160-bit base32 secret, the width RFC 4226 recommends for HMAC-SHA1. */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** The 6-digit code for the step containing `atMs` (defaults to now). */
export function totpCode(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return hotp(secret, counter);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  // Dynamic truncation (RFC 4228 §5.3): the low nibble of the last byte picks
  // the 4-byte window, and the top bit is masked so the value stays positive.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Constant-time check of a submitted code against the secret. `window` allows
 * that many 30s steps of clock drift either side of now (default 1, so the
 * previous, current and next steps all pass).
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { window?: number; atMs?: number } = {}
): boolean {
  const submitted = normalizeCode(code);
  if (!secret || submitted.length !== DIGITS) return false;
  const window = opts.window ?? 1;
  const now = opts.atMs ?? Date.now();
  let match = false;
  // Compare every candidate so timing does not reveal which step matched.
  for (let i = -window; i <= window; i++) {
    const candidate = totpCode(secret, now + i * PERIOD_SECONDS * 1000);
    if (timingSafeEqualStr(candidate, submitted)) match = true;
  }
  return match;
}

/** otpauth:// URI an authenticator app scans. */
export function buildOtpAuthUrl(secret: string, account: string, issuer = "CreatorOS"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(6),
    period: String(30),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Keep only the digits of a submitted code. */
export function normalizeCode(input: string): string {
  return (input || "").replace(/\D/g, "");
}

// ---- Backup codes -----------------------------------------------------------

// Ambiguous glyphs (0/O, 1/I) are left out so a code can be read and typed
// from paper without guessing.
const BACKUP_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Human-friendly one-time codes, e.g. 4F7K-9Q2M. */
export function generateBackupCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let raw = "";
    for (let i = 0; i < 8; i++) raw += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
    codes.add(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return [...codes];
}

/** Hashed before storage: the database never holds a usable code. */
export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

/** Uppercase and strip separators so `4f7k-9q2m` matches `4F7K9Q2M`. */
export function normalizeBackupCode(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ---- base32 (RFC 4648) ----

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = (input || "").toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
