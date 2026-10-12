import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, fail, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { createTrackedLink, listTrackedLinks } from "@/lib/analytics/links";

const createSchema = z.object({
  label: z.string().max(120).optional(),
  slug: z.string().max(64).optional(),
  destination: z.string().min(1).max(500),
  campaignId: z.string().max(60).nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();
  return ok({ links: listTrackedLinks(s.org.id) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:write")) return err.forbidden();

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const result = createTrackedLink(s.org.id, {
    label: parsed.data.label,
    slug: parsed.data.slug,
    destination: parsed.data.destination,
    campaignId: parsed.data.campaignId,
    active: parsed.data.active,
  });
  if (!result.ok) return fail(result.message, result.code === "conflict" ? 409 : 400, result.code);
  return ok({ link: result.data });
}
