import { sign, verify } from "./session";

/**
 * Short-lived token issued after a correct password but before the 2FA code.
 *
 * It is a signed, stateless claim (same HMAC secret as the session cookie) so
 * step one of a 2FA login does not need a server-side pending-login row. It
 * expires in minutes and is only usable for the MFA step, never as a session.
 */

const MFA_SCOPE = "mfa";
const TTL_MS = 5 * 60_000;

export interface MfaClaims {
  userId: string;
  orgId: string;
}

export function issueMfaToken(claims: MfaClaims, now = Date.now()): string {
  return sign({
    scope: MFA_SCOPE,
    userId: claims.userId,
    orgId: claims.orgId,
    exp: String(now + TTL_MS),
  });
}

export function verifyMfaToken(token: string, now = Date.now()): MfaClaims | null {
  if (!token) return null;
  const payload = verify(token);
  if (!payload || payload.scope !== MFA_SCOPE) return null;
  if (!payload.userId || !payload.orgId) return null;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || now > exp) return null;
  return { userId: payload.userId, orgId: payload.orgId };
}

export function mfaTokenTtlMs(): number {
  return TTL_MS;
}
