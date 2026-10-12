import { NextRequest } from "next/server";
import { consumeVerifyToken } from "@/lib/auth/email-verify";
import { ok, fail, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

/**
 * Redeems an email verification link. Consuming the token also stamps
 * users.email_verified, which is what admins on the allow-list need before
 * platform-admin access is granted.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("verify-email", ip), 30, 15 * 60_000);
  if (!rl.allowed) return fail("Too many attempts. Try again later.", 429, "rate_limited");

  const body = await readJson(req);
  const token = typeof body?.token === "string" ? body.token : "";

  const verified = consumeVerifyToken(token);
  if (!verified) return fail("This verification link is invalid or has expired", 400, "invalid_token");

  audit({ userId: verified.userId, action: "auth.email_verified", meta: { email: verified.email }, ip });
  return ok({ verified: true, email: verified.email });
}
