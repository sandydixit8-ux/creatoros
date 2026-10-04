import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { setConsentCookie } from "@/lib/consent-receipt";

const decisionSchema = z.object({
  analytics: z.boolean(),
  source: z.enum(["banner", "preferences", "withdrawn"]).default("banner"),
});

/**
 * Records a consent decision (D-5).
 *
 * The only way a visitor can obtain a consent receipt. Minting it here, rather
 * than accepting a flag on the tracking endpoint, is what makes the receipt
 * meaningful: the decision is captured server-side with a timestamp at the point
 * it was expressed, and `/api/track` will only honour a receipt from here.
 *
 * Withdrawing posts `analytics: false` rather than clearing the cookie, so the
 * decision (including a refusal) is remembered and the banner does not reappear
 * on every visit.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("consent", ip), 60);
  if (!rl.allowed) return err.rateLimited();

  const parsed = decisionSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const res: NextResponse = ok({
    saved: true,
    analytics: parsed.data.analytics,
  });
  res.headers.append("Set-Cookie", setConsentCookie(parsed.data.analytics, parsed.data.source));
  return res;
}