import { cookies } from "next/headers";
import { sessionExpired, sessionVersion, verify } from "./session";
import { row } from "@/lib/db/db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** True once the mailbox has been proven; gates platform-admin access. */
  emailVerified: boolean;
  /** Mirrors users.auth_version, re-issued into any replacement cookie. */
  authVersion: number;
}

export interface SessionOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface SessionResult {
  user: SessionUser;
  org: SessionOrg;
  role: string;
}

export async function getSession(): Promise<SessionResult | null> {
  const store = await cookies();
  const token = store.get("creatoros_session")?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.userId || !payload?.orgId) return null;

  // A cookie past its signed expiry, or signed before the account's last
  // password reset, is no longer valid. Legacy cookies issued before these
  // claims existed carry neither and stay valid until their Max-Age elapses.
  if (sessionExpired(payload)) return null;

  const member = row<{ role: string }>(
    "SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?",
    payload.userId,
    payload.orgId
  );
  if (!member) return null;

  const user = row<{ id: string; email: string; name: string; email_verified: number; auth_version: number }>(
    "SELECT id, email, name, email_verified, auth_version FROM users WHERE id = ?",
    payload.userId
  );
  if (!user) return null;

  if (sessionVersion(payload) !== user.auth_version) return null;

  const org = row<SessionOrg>(
    "SELECT id, name, slug, plan FROM organizations WHERE id = ?",
    payload.orgId
  );
  if (!org) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified === 1,
      authVersion: user.auth_version,
    },
    org,
    role: member.role,
  };
}

export async function requireSession(): Promise<SessionResult> {
  const s = await getSession();
  if (!s) throw new Error("auth_required");
  return s;
}