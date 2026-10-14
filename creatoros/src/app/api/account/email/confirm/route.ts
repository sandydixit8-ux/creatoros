import { NextRequest } from "next/server";
import { confirmEmailChange } from "@/lib/auth/email-change";
import { fail, ok, readJson, getClientIp } from "@/lib/http";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

/**
 * Redeem one side of a pending email change. Deliberately unauthenticated: the
 * click may happen on another device, and the single-use token is what proves
 * control of the mailbox. Only when both sides have been confirmed does the
 * change land, at which point every session is retired (auth_version bumped).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-email-confirm", ip), 30, 15 * 60_000);
  if (!rl.allowed) return fail("Too many attempts. Try again later.", 429, "rate_limited");

  const body = await readJson(req);
  const token = typeof body.token === "string" ? body.token : "";

  const result = confirmEmailChange(token);
  if (!result) return fail("This link is invalid or has expired", 400, "invalid_token");

  audit({
    action: result.applied ? "account.email_change_confirmed" : "account.email_change_side_confirmed",
    meta: { side: result.side, applied: result.applied, newEmail: result.newEmail },
    ip,
  });
  return ok({ applied: result.applied, side: result.side, newEmail: result.newEmail, alreadyConfirmed: result.alreadyConfirmed });
}
