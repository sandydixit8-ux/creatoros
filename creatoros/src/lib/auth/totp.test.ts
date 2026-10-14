import { describe, it, expect } from "vitest";
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUrl,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  normalizeBackupCode,
  totpCode,
  verifyTotp,
} from "./totp";

// RFC 6238 test secret: the ASCII bytes "12345678901234567890" in base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP (RFC 6238)", () => {
  it("matches the published SHA-1 test vectors (truncated to 6 digits)", () => {
    expect(totpCode(RFC_SECRET, 59 * 1000)).toBe("287082"); // 94287082
    expect(totpCode(RFC_SECRET, 1111111109 * 1000)).toBe("081804"); // 07081804
    expect(totpCode(RFC_SECRET, 1234567890 * 1000)).toBe("005924"); // 89005924
  });

  it("accepts the current code and one step of drift either side", () => {
    const now = 1_000_000_000_000;
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, totpCode(secret, now), { atMs: now })).toBe(true);
    // 30s earlier or later still passes with the default window of 1.
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), { atMs: now })).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), { atMs: now })).toBe(true);
    // Two steps away is outside the window.
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), { atMs: now })).toBe(false);
  });

  it("rejects a wrong, short or non-numeric code", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const good = totpCode(secret, now);
    const wrong = good === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong, { atMs: now })).toBe(false);
    expect(verifyTotp(secret, "123", { atMs: now })).toBe(false);
    expect(verifyTotp(secret, "abcdef", { atMs: now })).toBe(false);
    expect(verifyTotp("", good, { atMs: now })).toBe(false);
  });

  it("tolerates spaces in a submitted code", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const good = totpCode(secret, now);
    expect(verifyTotp(secret, `${good.slice(0, 3)} ${good.slice(3)}`, { atMs: now })).toBe(true);
  });

  it("base32 round-trips arbitrary bytes", () => {
    const buf = Buffer.from([0, 1, 2, 250, 255, 128, 64]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("builds an otpauth URL carrying the secret and issuer", () => {
    const url = buildOtpAuthUrl("ABCDEF234567", "me@example.com");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("secret=ABCDEF234567");
    expect(url).toContain("issuer=CreatorOS");
  });
});

describe("backup codes", () => {
  it("issues unique, human-friendly codes", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("hashes case- and separator-insensitively, and never stores the raw code", () => {
    const [code] = generateBackupCodes(1);
    expect(hashBackupCode(code)).toBe(hashBackupCode(code.toLowerCase()));
    expect(normalizeBackupCode("4f7k-9q2m")).toBe("4F7K9Q2M");
    expect(hashBackupCode(code)).not.toContain(code.replace("-", ""));
  });
});

describe("otpauth url", () => {
  it("encodes the account label", () => {
    const url = buildOtpAuthUrl("ABCDEF234567", "a+b@example.com");
    expect(url).toContain(encodeURIComponent("CreatorOS:a+b@example.com"));
  });
});
