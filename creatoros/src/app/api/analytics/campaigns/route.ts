import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { createCampaign, listCampaigns } from "@/lib/analytics/links";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();
  return ok({ campaigns: listCampaigns(s.org.id) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const result = createCampaign(s.org.id, {
    name: parsed.data.name,
    utmSource: parsed.data.utm_source,
    utmMedium: parsed.data.utm_medium,
    utmCampaign: parsed.data.utm_campaign,
    active: parsed.data.active,
  });
  if (!result.ok) return fail(result.message, result.code === "conflict" ? 409 : 400, result.code);
  return ok({ campaign: result.data });
}
