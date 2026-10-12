import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { deleteTrackedLink, updateTrackedLink } from "@/lib/analytics/links";

const patchSchema = z.object({
  label: z.string().max(120).optional(),
  slug: z.string().max(64).optional(),
  destination: z.string().min(1).max(500).optional(),
  campaignId: z.string().max(60).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const result = updateTrackedLink(s.org.id, id, {
    label: parsed.data.label,
    slug: parsed.data.slug,
    destination: parsed.data.destination,
    campaignId: parsed.data.campaignId,
    active: parsed.data.active,
  });
  if (!result.ok) return fail(result.message, result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 400, result.code);
  return ok({ link: result.data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const { id } = await params;
  if (!deleteTrackedLink(s.org.id, id)) return err.notFound();
  return ok({ deleted: true });
}
