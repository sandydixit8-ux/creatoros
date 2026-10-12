import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { deleteCampaign, updateCampaign } from "@/lib/analytics/links";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const result = updateCampaign(s.org.id, id, {
    name: parsed.data.name,
    utmSource: parsed.data.utm_source,
    utmMedium: parsed.data.utm_medium,
    utmCampaign: parsed.data.utm_campaign,
    active: parsed.data.active,
  });
  if (!result.ok) return fail(result.message, result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 400, result.code);
  return ok({ campaign: result.data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  if (!deleteCampaign(s.org.id, id)) return err.notFound();
  return ok({ deleted: true });
}
