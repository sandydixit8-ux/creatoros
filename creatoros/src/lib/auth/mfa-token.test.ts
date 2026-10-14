import { describe, it, expect, beforeEach } from "vitest";
import { issueMfaToken, mfaTokenTtlMs, verifyMfaToken } from "./mfa-token";
import { sign, verify } from "./session";

describe("MFA hand-off token", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-1234";
  });

  it("round-trips the user and org", () => {
    const token = issueMfaToken({ userId: "usr_1", orgId: "org_1" });
    expect(verifyMfaToken(token)).toEqual({ userId: "usr_1", orgId: "org_1" });
  });

  it("rejects a tampered token", () => {
    const token = issueMfaToken({ userId: "usr_1", orgId: "org_1" });
    expect(verifyMfaToken(`${token}x`)).toBeNull();
    expect(verifyMfaToken("")).toBeNull();
  });

  it("rejects a token signed for another purpose", () => {
    const other = sign({ scope: "email_unsubscribe", userId: "usr_1", orgId: "org_1" });
    expect(verifyMfaToken(other)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = issueMfaToken({ userId: "usr_1", orgId: "org_1" }, now);
    expect(verifyMfaToken(token, now + mfaTokenTtlMs() - 1)).not.toBeNull();
    expect(verifyMfaToken(token, now + mfaTokenTtlMs() + 1)).toBeNull();
  });

  it("produces a token the session verifier can read", () => {
    const token = issueMfaToken({ userId: "usr_1", orgId: "org_1" });
    expect(verify(token)?.scope).toBe("mfa");
  });
});
