import { z } from "zod";
import { ok, err, readJson, getClientIp, userAgentInfo, clientCountry, isLikelyBot } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { recordSiteVisit } from "@/lib/site/traffic";

/**
 * First-party page-view beacon for the product's OWN marketing pages.
 *
 * Unlike `/api/track`, there is no consent gate here: nothing is stored on the
 * visitor's device and no identifier leaves the server - `recordSiteVisit`
 * writes an aggregate view with a daily-rotating salted hash. There is simply no
 * personal data to consent to.
 */
const schema = z.object({
  path: z.string().max(500).default("/"),
  ref: z.string().max(500).default(""),
});

// The app/creator surface, short links and internal endpoints are not marketing
// traffic even if a beacon fires there (e.g. a client-side navigation into /app).
const IGNORED_PREFIXES = ["/app", "/u", "/api", "/l"];

export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const path = parsed.data.path;
  if (IGNORED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return ok({ tracked: false });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("site-view", ip), 120);
  if (!rl.allowed) return err.rateLimited();

  // Crawler hits are acknowledged but not recorded, so bots do not inflate the
  // traffic totals or the country table.
  if (isLikelyBot(req)) return ok({ tracked: false, bot: true });

  const { device } = userAgentInfo(req);
  recordSiteVisit({
    path: parsed.data.path,
    ref: parsed.data.ref || req.headers.get("referer") || "",
    country: clientCountry(req),
    device,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") || "",
  });

  return ok({ tracked: true });
}
